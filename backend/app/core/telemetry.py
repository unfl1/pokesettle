"""Bounded operational telemetry: never record URLs, bodies, cookies or exceptions."""

import json
import logging
import time
from contextlib import contextmanager
from logging.handlers import RotatingFileHandler
from uuid import uuid4

from prometheus_client import CollectorRegistry, Counter, Histogram, start_http_server
from starlette.requests import Request

from backend.app.core.exception_handlers import internal_error

METHODS = {"GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH", "DELETE"}
PURPOSES = {"generate", "discovery", "queries", "selection", "battle_state"}


class Telemetry:
    def __init__(self):
        self.registry = CollectorRegistry()
        self.requests = Counter(
            "poketact_http_requests", "Completed HTTP requests", ["method", "route", "status"],
            registry=self.registry,
        )
        self.latency = Histogram(
            "poketact_http_duration_seconds", "HTTP response duration", ["method", "route"],
            buckets=(.01, .05, .1, .25, .5, 1, 2.5, 5, 15, 30, 60, 120, 180),
            registry=self.registry,
        )
        self.model_calls = Counter(
            "poketact_model_calls", "Structured model attempts, including retries", ["purpose", "outcome"],
            registry=self.registry,
        )
        self.model_latency = Histogram(
            "poketact_model_duration_seconds", "Structured model attempt duration", ["purpose"],
            buckets=(.1, .5, 1, 5, 15, 30, 60, 120, 180), registry=self.registry,
        )
        self.usage_denied = Counter(
            "poketact_usage_denied", "Admission or model reservations denied", ["reason"],
            registry=self.registry,
        )
        self.reserved_tokens = Counter(
            "poketact_reserved_tokens", "Conservative reserved tokens, not billed usage",
            registry=self.registry,
        )
        self.model_tokens = Counter(
            "poketact_model_tokens", "Provider reported tokens, including invalid structured responses",
            ["purpose", "direction"], registry=self.registry,
        )
        # A dedicated logger avoids collecting third-party logs or raw provider errors.
        self.logger = logging.Logger("poketact.operational", level=logging.INFO)
        self.server = None
        self.thread = None

    def start(self, directory, port=9000):
        directory.mkdir(parents=True, exist_ok=True, mode=0o700)
        handler = RotatingFileHandler(directory / "events.jsonl", maxBytes=5_000_000, backupCount=2)
        handler.setFormatter(logging.Formatter("%(message)s"))
        self.logger.addHandler(handler)
        try:
            self.server, self.thread = start_http_server(port, addr="0.0.0.0", registry=self.registry)
        except Exception:
            self.close()
            raise

    def close(self):
        if self.server:
            self.server.shutdown()
            self.server.server_close()
            self.thread.join(timeout=5)
            self.server = None
        for handler in self.logger.handlers[:]:
            handler.close()
            self.logger.removeHandler(handler)

    def emit(self, **fields):
        self.logger.info(json.dumps({"timestamp": time.time(), **fields}, separators=(",", ":")))

    def record_model_usage(self, purpose, usage):
        if not isinstance(usage, dict):
            return
        counts = [usage.get(key) for key in ("input_tokens", "output_tokens", "total_tokens")]
        if any(type(value) is not int or value < 0 for value in counts):
            return
        if counts[2] <= 0 or counts[0] + counts[1] != counts[2]:
            return
        purpose = purpose if purpose in PURPOSES else "other"
        for direction, count in zip(("input", "output"), counts):
            self.model_tokens.labels(purpose, direction).inc(count)

    @contextmanager
    def model_attempt(self, purpose):
        purpose = purpose if purpose in PURPOSES else "other"
        started, outcome = time.monotonic(), "success"
        try:
            yield
        except Exception:
            outcome = "failure"
            raise
        finally:
            duration = time.monotonic() - started
            self.model_calls.labels(purpose, outcome).inc()
            self.model_latency.labels(purpose).observe(duration)
            self.emit(event="model", purpose=purpose, outcome=outcome, duration_seconds=round(duration, 4))


class TelemetryMiddleware:
    def __init__(self, app, telemetry):
        self.app, self.telemetry = app, telemetry

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        started = time.monotonic()
        status, sent, recorded = 500, False, False

        def observe():
            nonlocal recorded
            recorded = True
            method = scope["method"] if scope["method"] in METHODS else "OTHER"
            route = getattr(scope.get("route"), "path", "unmatched")
            duration = time.monotonic() - started
            self.telemetry.requests.labels(method, route, str(status)).inc()
            self.telemetry.latency.labels(method, route).observe(duration)
            self.telemetry.emit(
                event="http", method=method, route=route, status=status,
                request_id=scope.get("state", {}).get("request_id", ""),
                duration_seconds=round(duration, 4),
            )

        async def measured_send(message):
            nonlocal status, sent
            if message["type"] == "http.response.start":
                status, sent = message["status"], True
            await send(message)
            if message["type"] == "http.response.body" and not message.get("more_body", False):
                # Background jobs run after the response; exclude them from HTTP latency.
                observe()

        try:
            await self.app(scope, receive, measured_send)
        except Exception as error:
            # Handle before Uvicorn can print exception text, request bodies or provider details.
            status = 500
            request = Request(scope)
            if not getattr(request.state, "request_id", None):
                request.state.request_id = str(uuid4())
            response = await internal_error(request, error)
            if not sent:
                response.headers["X-Request-ID"] = request.state.request_id
                await response(scope, receive, measured_send)
        finally:
            if not recorded:
                observe()
