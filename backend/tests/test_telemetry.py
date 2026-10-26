import logging
from types import SimpleNamespace

import pytest
from fastapi import BackgroundTasks
from fastapi.testclient import TestClient
from prometheus_client import generate_latest

from backend.app.core.config import Settings
from backend.app.core.telemetry import Telemetry
from backend.app.main import create_app
from backend.app.rag.model import StructuredModel


def app_with_routes():
    service = SimpleNamespace(store=SimpleNamespace(recover_jobs=lambda: None))
    app = create_app(Settings(), service=service, usage=object())

    @app.get("/test/items/{item_id}")
    def item(item_id: str):
        return {"ok": True}

    @app.post("/test/fail")
    def fail():
        raise RuntimeError("PRIVATE_PROVIDER_PAYLOAD")

    return app


def capture(telemetry):
    events = []

    class Handler(logging.Handler):
        def emit(self, record):
            events.append(record.getMessage())

    telemetry.logger.addHandler(Handler())
    return events


def test_metrics_and_logs_never_contain_question_url_cookie_or_identifier():
    app = app_with_routes()
    events = capture(app.state.telemetry)
    with TestClient(app) as client:
        response = client.get("/test/items/PRIVATE_IDENTIFIER?question=PRIVATE_QUESTION",
                              headers={"Cookie": "pokecoach_session=PRIVATE_COOKIE"})
        assert response.status_code == 200
        client.get("/missing/PRIVATE_MISSING")
        # The scrape port is separate from the public application.
        assert client.get("/metrics").status_code == 404
        assert client.get("/internal/metrics").status_code == 404
    metrics = generate_latest(app.state.telemetry.registry).decode()
    output = metrics + "\n".join(events)
    for secret in ("PRIVATE_IDENTIFIER", "PRIVATE_QUESTION", "PRIVATE_COOKIE", "PRIVATE_MISSING"):
        assert secret not in output
    assert 'route="/test/items/{item_id}"' in metrics
    assert 'route="unmatched"' in metrics
    assert '"request_id":' in output


def test_unhandled_error_is_sanitized_before_reaching_uvicorn(caplog):
    app = app_with_routes()
    events = capture(app.state.telemetry)
    with TestClient(app) as client:
        response = client.post("/test/fail", json={"question": "PRIVATE_QUESTION"})
    assert response.status_code == 500
    assert response.json()["error"]["code"] == "INTERNAL_ERROR"
    assert response.headers["X-Request-ID"]
    assert "PRIVATE_PROVIDER_PAYLOAD" not in response.text + caplog.text + "".join(events)
    assert 'status="500"' in generate_latest(app.state.telemetry.registry).decode()


def test_rejected_origin_counted_and_path_is_not_logged():
    app = app_with_routes()
    events = capture(app.state.telemetry)
    with TestClient(app) as client:
        response = client.post("/test/fail?question=PRIVATE_QUESTION", headers={"Origin": "https://untrusted.example"})
    assert response.status_code == 403
    assert 'status="403"' in generate_latest(app.state.telemetry.registry).decode()
    assert "PRIVATE_QUESTION" not in "".join(events)


def test_model_attempts_record_retries_without_provider_content(monkeypatch):
    telemetry = Telemetry()
    events = capture(telemetry)
    attempts = []

    class Client:
        def __init__(self, **kwargs):
            pass

        def with_structured_output(self, *args, **kwargs):
            return self

        def invoke(self, messages):
            attempts.append(1)
            if len(attempts) == 1:
                raise RuntimeError("PRIVATE_PROVIDER_PAYLOAD")
            return {"parsed": "success", "raw": None, "parsing_error": None}

    monkeypatch.setattr("backend.app.rag.model.ChatOpenAI", Client)
    model = StructuredModel(Settings(api_key="synthetic-test-key", chat_model="test"), telemetry)
    from backend.app.core.usage import active_usage
    from backend.app.schemas import Generation
    token = active_usage.set((SimpleNamespace(reserve=lambda *args: None, settle=lambda *args: None), "test"))
    try:
        assert model.invoke("generate", "PRIVATE_SYSTEM", {"question": "PRIVATE_QUESTION"}, Generation) == "success"
    finally:
        active_usage.reset(token)
    metrics = generate_latest(telemetry.registry).decode()
    assert 'outcome="failure",purpose="generate"} 1.0' in metrics
    assert 'outcome="success",purpose="generate"} 1.0' in metrics
    assert not any(value in metrics + "".join(events) for value in ("PRIVATE_SYSTEM", "PRIVATE_QUESTION", "PRIVATE_PROVIDER_PAYLOAD"))


def test_model_purpose_cardinality_and_file_rotation(tmp_path):
    telemetry = Telemetry()
    telemetry.start(tmp_path / "telemetry", port=0)
    try:
        with pytest.raises(RuntimeError), telemetry.model_attempt("PRIVATE_PURPOSE"):
            raise RuntimeError("PRIVATE_ERROR")
        handler = telemetry.logger.handlers[0]
        assert handler.maxBytes == 5_000_000 and handler.backupCount == 2
        text = (tmp_path / "telemetry/events.jsonl").read_text()
        assert '"purpose":"other"' in text
        assert "PRIVATE_" not in text
    finally:
        telemetry.close()
    assert not telemetry.logger.handlers


def test_http_observation_finishes_before_background_job():
    app = app_with_routes()
    observed = []

    def job():
        observed.append(generate_latest(app.state.telemetry.registry).decode())

    @app.get("/test/background")
    def background(tasks: BackgroundTasks):
        tasks.add_task(job)
        return {"ok": True}

    with TestClient(app) as client:
        assert client.get("/test/background").status_code == 200
    assert 'route="/test/background",status="200"} 1.0' in observed[0]
