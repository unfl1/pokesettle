from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from backend.app.core.config import DAILY_MODEL_TOKEN_CAP, Settings
from backend.app.core.errors import ServiceError
from backend.app.core.usage import UsageGuard, active_usage, request_subjects
from backend.app.main import create_app
from backend.app.rag.model import StructuredModel
from backend.app.schemas import Generation


def test_concurrent_reservations_are_atomic_and_survive_restart(pg_store):
    settings = Settings(usage_daily_tokens=100, usage_global_concurrency=20)
    guard = UsageGuard(pg_store, settings)
    leases = [guard.begin([f"session-{i}", f"ip-{i}"]) for i in range(12)]

    def reserve(lease):
        try:
            guard.reserve(lease, 25)
            return True
        except ServiceError:
            return False

    with ThreadPoolExecutor(max_workers=12) as pool:
        assert sum(pool.map(reserve, leases)) == 4
    restarted = UsageGuard(pg_store, settings)
    with pytest.raises(ServiceError):
        restarted.reserve(leases[0], 1)
    assert guard.salt == restarted.salt


def test_free_allowance_cap_cannot_be_raised_and_resets_on_utc_day(pg_store):
    guard = UsageGuard(pg_store, Settings(usage_daily_tokens=500_000, usage_calls_per_job=10))
    with guard.scope(guard.begin(["first", "ip-first"])):
        lease = active_usage.get()[1]
        for _ in range(10):
            guard.reserve(lease, 23_000)
    restarted = UsageGuard(pg_store, guard.settings)
    with restarted.scope(restarted.begin(["next", "ip-next"])):
        lease = active_usage.get()[1]
        with pytest.raises(ServiceError) as error:
            restarted.reserve(lease, 1)
        assert error.value.code == "MODEL_BUDGET_EXHAUSTED"
        assert "오전 9시" in error.value.message
    with pg_store.connect() as db:
        assert db.execute(
            "SELECT amount FROM usage_counters WHERE subject='global' AND bucket LIKE '%%:tokens'"
        ).fetchone()["amount"] == DAILY_MODEL_TOKEN_CAP
        # Simulate the previous UTC day's persisted reservation without changing the host clock.
        db.execute(
            "UPDATE usage_counters SET bucket='2000-01-01:tokens' WHERE subject='global' AND bucket LIKE '%%:tokens'"
        )
    with restarted.scope(restarted.begin(["tomorrow", "ip-tomorrow"])):
        restarted.reserve(active_usage.get()[1], 25_000)


def test_next_full_model_reservation_is_blocked_before_crossing_cap(pg_store, monkeypatch):
    s = Settings(api_key="synthetic", chat_model="gpt-6-luna")
    guard = UsageGuard(pg_store, s)
    reached_provider = []

    class Client:
        def __init__(self, **kwargs):
            pass

        def with_structured_output(self, *args, **kwargs):
            reached_provider.append(True)
            raise AssertionError("Must reserve the entire next call before contacting provider")

    monkeypatch.setattr("backend.app.rag.model.ChatOpenAI", Client)
    with guard.scope(guard.begin(["one", "ip-one"])):
        with pg_store.connect() as db:
            db.execute(
                """INSERT INTO usage_counters VALUES (
                to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD') || ':tokens', 'global', %s)""",
                (DAILY_MODEL_TOKEN_CAP - 1000,),
            )
        with pytest.raises(ServiceError) as error:
            StructuredModel(s).invoke("generate", "test", {}, Generation)
        assert error.value.code == "MODEL_BUDGET_EXHAUSTED"
        assert not reached_provider
        with pg_store.connect() as db:
            assert db.execute(
                "SELECT amount FROM usage_counters WHERE subject='global' AND bucket LIKE '%%:tokens'"
            ).fetchone()["amount"] == DAILY_MODEL_TOKEN_CAP - 1000


def test_sessions_cannot_bypass_ip_and_slots_release(pg_store):
    guard = UsageGuard(pg_store, Settings(usage_requests_per_minute=1))
    lease = guard.begin(["session-1", "ip-shared"])
    with pytest.raises(ServiceError, match="진행 중"):
        guard.begin(["session-2", "ip-shared"])
    guard.finish(lease)
    with pytest.raises(ServiceError):
        guard.begin(["session-2", "ip-shared"])
    # A rejected admission rolls back every charged subject, not just the failing IP.
    with pg_store.connect() as db:
        assert (
            db.execute("SELECT 1 FROM usage_counters WHERE subject='session-2'").fetchone() is None
        )


def test_global_concurrency_call_limit_expiration_and_utc_rollover(pg_store):
    s = Settings(usage_global_concurrency=1, usage_calls_per_job=1, usage_daily_calls=1)
    guard = UsageGuard(pg_store, s)
    lease = guard.begin(["one", "ip-one"])
    with pytest.raises(ServiceError):
        guard.begin(["two", "ip-two"])
    guard.reserve(lease, 1)
    with pytest.raises(ServiceError) as error:
        guard.reserve(lease, 1)
    assert error.value.code == "MODEL_CALL_LIMIT"
    guard.finish(lease)
    second = guard.begin(["two", "ip-two"])
    with pytest.raises(ServiceError):
        guard.reserve(second, 1)
    with pg_store.connect() as db:
        db.execute(
            "UPDATE usage_counters SET bucket='2000-01-01:calls' WHERE subject='global' AND bucket LIKE '%%:calls'"
        )
    guard.reserve(second, 1)
    with pg_store.connect() as db:
        db.execute("UPDATE usage_leases SET expires_at=now()-interval '1 second'")
    with pytest.raises(ServiceError):
        guard.reserve(second, 1)
    guard.begin(["three", "ip-three"])


def test_model_failures_and_retries_reserve_before_every_attempt(pg_store, monkeypatch):
    settings = Settings(api_key="synthetic", chat_model="test")
    guard = UsageGuard(pg_store, settings)
    attempts = []

    class Client:
        def __init__(self, **kwargs):
            assert kwargs["max_retries"] == 0
            assert kwargs["max_completion_tokens"] == 2000

        def with_structured_output(self, *args, **kwargs):
            return self

        def invoke(self, messages):
            attempts.append(1)
            raise RuntimeError("private-provider-content")

    monkeypatch.setattr("backend.app.rag.model.ChatOpenAI", Client)
    with guard.scope(guard.begin(["one", "ip-one"])):
        with pytest.raises(ServiceError) as error:
            StructuredModel(settings).invoke("generate", "test", {}, Generation)
        assert error.value.code == "GENERATION_INVALID"
    assert len(attempts) == 2
    with pg_store.connect() as db:
        counts = {
            r["bucket"].split(":")[-1]: r["amount"]
            for r in db.execute(
                "SELECT bucket,amount FROM usage_counters WHERE subject='global'"
            ).fetchall()
        }
        assert counts["calls"] == 2
        assert counts["tokens"] > 4000
        assert db.execute("SELECT count(*) AS n FROM usage_leases").fetchone()["n"] == 0


def test_model_no_context_oversize_and_exhausted_budget_never_call_provider(pg_store, monkeypatch):
    constructed = []
    monkeypatch.setattr("backend.app.rag.model.ChatOpenAI", lambda **kw: constructed.append(kw))
    s = Settings(api_key="synthetic", chat_model="test", usage_daily_tokens=1)
    model = StructuredModel(s)
    with pytest.raises(ServiceError) as error:
        model.invoke("generate", "test", {}, Generation)
    assert error.value.code == "USAGE_CONTEXT_MISSING"
    guard = UsageGuard(pg_store, s)
    with guard.scope(guard.begin(["one", "ip-one"])):
        with pytest.raises(ServiceError):
            model.invoke("generate", "test", {}, Generation)
        with pytest.raises(ServiceError) as error:
            model.invoke("generate", "x" * 25000, {}, Generation)
        assert error.value.code == "MODEL_INPUT_LIMIT"
    # Creating a client is harmless; its invoke must never be reached when reserve fails.
    assert len(constructed) == 1


def test_proxy_identity_ignores_spoofed_headers_and_groups_ipv6(pg_store):
    s = Settings()
    guard = UsageGuard(pg_store, s)

    def request(host, headers):
        return SimpleNamespace(
            client=SimpleNamespace(host=host),
            headers=headers,
            app=SimpleNamespace(state=SimpleNamespace(usage=guard)),
        )

    a = request(
        "192.0.2.1", {"x-forwarded-for": "192.0.2.50", "x-poketact-viewer-ip": "192.0.2.50"}
    )
    b = request("192.0.2.1", {})
    assert request_subjects(a, "same", s) == request_subjects(b, "same", s)
    s = replace(s, trust_usage_proxy=True)
    with pytest.raises(ServiceError):
        request_subjects(b, "same", s)
    a.headers = {"x-poketact-viewer-ip": "2001:db8::1"}
    b.headers = {"x-poketact-viewer-ip": "2001:db8::2"}
    assert request_subjects(a, "same", s) == request_subjects(b, "same", s)


def test_jobs_idempotency_and_discovery_share_limits(setup):
    settings = replace(setup.settings, usage_requests_per_minute=1)
    from uuid import uuid4

    body = {"pokemonId": "pokemon:1", "question": "test question", "clientRequestId": str(uuid4())}
    with TestClient(create_app(settings, service=setup.service)) as client:
        client.post("/api/session")
        response = client.post("/api/chat", json=body)
        assert response.status_code == 202
        assert client.post("/api/chat", json=body).status_code == 202
        blocked = client.post("/api/pokemon/search", json={"query": "test"})
        assert blocked.status_code == 429
        assert blocked.headers["Retry-After"] == "60"
        assert client.get("/api/pokemon?limit=1").status_code == 200
        client.cookies.clear()
        client.post("/api/session")
        assert (
            client.post("/api/chat", json={**body, "clientRequestId": str(uuid4())}).status_code
            == 429
        )


@pytest.mark.parametrize(
    "setting",
    [
        "usage_daily_tokens",
        "usage_daily_calls",
        "usage_requests_per_day",
        "model_max_output_tokens",
    ],
)
def test_nonpositive_limits_fail_configuration(setting):
    with pytest.raises(ValueError):
        Settings(**{setting: 0})


def test_daily_session_and_shared_ip_limits(pg_store):
    s = Settings(
        usage_requests_per_minute=100, usage_requests_per_day=2, usage_ip_requests_per_day=3
    )
    guard = UsageGuard(pg_store, s)
    for _ in range(2):
        guard.finish(guard.begin(["session-a", "shared-ip"]))
    with pytest.raises(ServiceError):
        guard.begin(["session-a", "another-ip"])
    guard.finish(guard.begin(["session-b", "shared-ip"]))
    with pytest.raises(ServiceError):
        guard.begin(["session-c", "shared-ip"])


def test_background_jobs_have_usage_context_and_free_catalog_survives_budget_block(setup):
    from uuid import uuid4

    original = setup.model.invoke

    def checked(*args):
        guard, lease = active_usage.get()
        guard.reserve(lease, 100)
        return original(*args)

    setup.model.invoke = checked
    settings = replace(setup.settings, usage_daily_tokens=1)
    with TestClient(create_app(settings, service=setup.service)) as client:
        client.post("/api/session")
        response = client.post(
            "/api/chat",
            json={
                "pokemonId": "pokemon:1",
                "question": "test question",
                "clientRequestId": str(uuid4()),
            },
        )
        job = client.get(response.json()["data"]["statusUrl"]).json()["data"]
        assert job["status"] == "failed"
        assert job["error"]["code"] == "MODEL_BUDGET_EXHAUSTED"
        assert not setup.model.calls
        assert client.get("/api/pokemon/pokemon:1").status_code == 200
        # Budget failures still release the slot.
        assert (
            client.post("/api/pokemon/search", json={"query": "test"}).json()["error"]["code"]
            == "MODEL_BUDGET_EXHAUSTED"
        )


def test_database_failure_never_reaches_provider(pg_store, monkeypatch):
    from contextlib import contextmanager

    s = Settings(api_key="synthetic", chat_model="test")
    guard = UsageGuard(pg_store, s)
    lease = guard.begin(["one", "ip-one"])
    invoked = []

    class Client:
        def __init__(self, **kwargs):
            pass

        def with_structured_output(self, *args, **kwargs):
            invoked.append(True)
            raise AssertionError("Provider must not be called")

    monkeypatch.setattr("backend.app.rag.model.ChatOpenAI", Client)

    @contextmanager
    def unavailable():
        raise RuntimeError("database unavailable")
        yield

    with guard.scope(lease):
        with monkeypatch.context() as patch:
            patch.setattr(pg_store, "connect", unavailable)
            with pytest.raises(RuntimeError, match="database unavailable"):
                StructuredModel(s).invoke("generate", "test", {}, Generation)
    assert not invoked
