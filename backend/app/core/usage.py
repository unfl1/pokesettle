"""Persistent, fail-closed admission and conservative token reservations.

Successful calls settle against provider usage; unknown outcomes keep their reservation.
Only opaque session/IP digests and aggregate counters are stored here, never prompts.
"""

import hashlib
import hmac
import ipaddress
import json
import secrets
from contextlib import contextmanager
from contextvars import ContextVar
from uuid import uuid4

from backend.app.core.config import DAILY_MODEL_TOKEN_CAP
from backend.app.core.errors import ServiceError

active_usage = ContextVar("active_usage", default=None)


def denied(code="USAGE_LIMIT", message="사용 한도에 도달했습니다. 잠시 후 다시 시도해 주세요."):
    return ServiceError(code, message, 429)


def request_subjects(request, session_id, settings):
    address = request.client.host if request.client else "unknown"
    # This header is overwritten by our authenticated Nginx origin, never accepted by default.
    if settings.trust_usage_proxy:
        candidate = request.headers.get("x-poketact-viewer-ip", "")
        try:
            address = str(ipaddress.ip_address(candidate))
        except ValueError:
            raise ServiceError(
                "CLIENT_ADDRESS_MISSING", "접속 경로를 확인해 주세요.", 503
            ) from None
    try:
        ip = ipaddress.ip_address(address)
        # IPv6 privacy addresses within one /64 share a quota.
        address = (
            str(ipaddress.ip_network(f"{ip}/64", strict=False)) if ip.version == 6 else str(ip)
        )
    except ValueError:
        pass  # Test clients and local tools can have a non-IP transport name.
    return [
        hmac.new(request.app.state.usage.salt.encode(), value.encode(), hashlib.sha256).hexdigest()
        for value in ("session:" + session_id, "ip:" + address)
    ]


class UsageGuard:
    def __init__(self, store, settings, telemetry=None):
        self.store, self.settings, self.telemetry = store, settings, telemetry
        with store.connect() as db:
            db.execute(
                "CREATE TABLE IF NOT EXISTS usage_secret (id INTEGER PRIMARY KEY CHECK(id=1), value TEXT NOT NULL)"
            )
            db.execute(
                "INSERT INTO usage_secret VALUES (1,%s) ON CONFLICT DO NOTHING",
                (secrets.token_hex(32),),
            )
            self.salt = db.execute("SELECT value FROM usage_secret WHERE id=1").fetchone()["value"]
            db.execute("""CREATE TABLE IF NOT EXISTS usage_counters (
                bucket TEXT NOT NULL, subject TEXT NOT NULL, amount BIGINT NOT NULL,
                PRIMARY KEY(bucket,subject))""")
            db.execute("""CREATE TABLE IF NOT EXISTS usage_leases (
                id TEXT PRIMARY KEY, subjects TEXT NOT NULL, calls INTEGER NOT NULL DEFAULT 0,
                expires_at TIMESTAMPTZ NOT NULL)""")
            db.execute("""CREATE TABLE IF NOT EXISTS usage_reservations (
                id TEXT PRIMARY KEY, bucket TEXT NOT NULL, tokens BIGINT NOT NULL)""")

    @contextmanager
    def locked(self):
        with self.store.connect() as db:
            # All admission/reservation changes share one transaction lock across workers.
            db.execute("SELECT pg_advisory_xact_lock(733041827)")
            try:
                yield db
            except ServiceError as error:
                if self.telemetry:
                    self.telemetry.usage_denied.labels(error.code).inc()
                raise

    @staticmethod
    def charge(db, bucket, subject, amount, limit):
        row = db.execute(
            "SELECT amount FROM usage_counters WHERE bucket=%s AND subject=%s", (bucket, subject)
        ).fetchone()
        if amount + (row["amount"] if row else 0) > limit:
            if subject == "global":
                raise denied(
                    "MODEL_BUDGET_EXHAUSTED",
                    "오늘의 서비스 전체 AI 처리 예산이 부족해 새 요청을 시작할 수 없습니다. 다음 이용은 한국 시간 오전 9시 이후 가능합니다. 기본 도감 조회는 계속 이용할 수 있습니다.",
                )
            raise denied()
        db.execute(
            """INSERT INTO usage_counters VALUES (%s,%s,%s)
            ON CONFLICT(bucket,subject) DO UPDATE SET amount=usage_counters.amount+excluded.amount""",
            (bucket, subject, amount),
        )

    def begin(self, subjects):
        s = self.settings
        lease = uuid4().hex
        with self.locked() as db:
            # DB time prevents worker clock skew; buckets use UTC, not local server time.
            clock = db.execute(
                "SELECT to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD') AS day, to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI') AS minute"
            ).fetchone()
            db.execute("DELETE FROM usage_leases WHERE expires_at <= now()")
            db.execute("DELETE FROM usage_counters WHERE left(bucket,10) < %s", (clock["day"],))
            db.execute("DELETE FROM usage_reservations WHERE left(bucket,10) < %s", (clock["day"],))
            leases = db.execute("SELECT subjects FROM usage_leases").fetchall()
            if len(leases) >= s.usage_global_concurrency or any(
                set(subjects) & set(json.loads(r["subjects"])) for r in leases
            ):
                raise denied("USAGE_BUSY", "진행 중인 질문이 있습니다. 완료 후 다시 시도해 주세요.")
            for index, subject in enumerate(subjects):
                self.charge(
                    db, clock["minute"] + ":requests", subject, 1, s.usage_requests_per_minute
                )
                self.charge(
                    db,
                    clock["day"] + ":requests",
                    subject,
                    1,
                    s.usage_requests_per_day if index == 0 else s.usage_ip_requests_per_day,
                )
            db.execute(
                "INSERT INTO usage_leases (id,subjects,expires_at) VALUES (%s,%s,now()+interval '15 minutes')",
                (lease, json.dumps(subjects)),
            )
        return lease

    def finish(self, lease):
        with self.locked() as db:
            db.execute("DELETE FROM usage_leases WHERE id=%s", (lease,))

    @contextmanager
    def scope(self, lease):
        token = active_usage.set((self, lease))
        try:
            yield
        finally:
            active_usage.reset(token)
            self.finish(lease)

    def reserve(self, lease, tokens):
        s = self.settings
        reservation = uuid4().hex
        if tokens <= 0 or tokens > s.model_max_input_tokens + s.model_max_output_tokens:
            raise ValueError("Invalid model reservation")
        with self.locked() as db:
            row = db.execute(
                "SELECT calls FROM usage_leases WHERE id=%s AND expires_at>now()", (lease,)
            ).fetchone()
            if not row or row["calls"] >= s.usage_calls_per_job:
                raise denied("MODEL_CALL_LIMIT", "질문당 모델 호출 한도에 도달했습니다.")
            day = db.execute(
                "SELECT to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD') AS day"
            ).fetchone()["day"]
            self.charge(
                db, day + ":tokens", "global", tokens,
                min(s.usage_daily_tokens, DAILY_MODEL_TOKEN_CAP),
            )
            self.charge(db, day + ":calls", "global", 1, s.usage_daily_calls)
            db.execute(
                "INSERT INTO usage_reservations VALUES (%s,%s,%s)",
                (reservation, day + ":tokens", tokens),
            )
            db.execute(
                "UPDATE usage_leases SET calls=calls+1, expires_at=now()+interval '15 minutes' WHERE id=%s",
                (lease,),
            )
        if self.telemetry:
            self.telemetry.reserved_tokens.inc(tokens)
        return reservation

    def settle(self, reservation, usage):
        # Missing, malformed or incomplete metadata must never reopen budget.
        if not isinstance(usage, dict):
            return
        counts = [usage.get(key) for key in ("input_tokens", "output_tokens", "total_tokens")]
        if any(type(value) is not int or value < 0 for value in counts):
            return
        if counts[2] <= 0 or counts[0] + counts[1] != counts[2]:
            return
        with self.locked() as db:
            row = db.execute(
                "DELETE FROM usage_reservations WHERE id=%s RETURNING bucket,tokens",
                (reservation,),
            ).fetchone()
            if row:
                # Use the original day, including across UTC midnight. A deleted old
                # bucket stays deleted. Consuming the ticket makes settlement idempotent.
                db.execute(
                    "UPDATE usage_counters SET amount=amount+%s WHERE bucket=%s AND subject='global'",
                    (counts[2] - row["tokens"], row["bucket"]),
                )
