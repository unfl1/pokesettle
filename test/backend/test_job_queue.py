from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
from dataclasses import replace
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from backend.app.core.errors import ServiceError
from backend.app.core.usage import UsageGuard
from backend.app.main import create_app
from backend.app.schemas import ChatRequest
from backend.app.services.job_queue import JobQueue
from backend.app.storage import Store, active_job_claim


def enqueue(queue, index, *, shared_ip=False):
    session = queue.store.new_session()
    body = ChatRequest(pokemon_id="pokemon:1", question="test question", client_request_id=uuid4())
    return queue.enqueue(session, "chat", body, [session, "shared-ip" if shared_ip else f"ip-{index}"]), session, body


def test_100_distinct_sessions_on_one_ip_are_admitted_and_survive_api_restart(setup):
    settings = replace(setup.settings, job_worker_embedded=False)
    queue = JobQueue(setup.store, UsageGuard(setup.store, settings))
    with ThreadPoolExecutor(max_workers=20) as executor:
        jobs = list(executor.map(lambda i: enqueue(queue, i, shared_ip=True), range(100)))
    assert len({job[0] for job in jobs}) == 100
    setup.store.recover_jobs()
    assert all(setup.store.job(job_id, session)["status"] == "queued" for job_id, session, _ in jobs)
    assert sorted(setup.store.job(job_id, session)["queue_position"] for job_id, session, _ in jobs) == list(range(1, 101))


def test_queue_capacity_and_idempotency_are_atomic(setup):
    queue = JobQueue(setup.store, UsageGuard(setup.store, replace(setup.settings, job_queue_capacity=1)))
    job_id, session, body = enqueue(queue, 1)
    assert queue.enqueue(session, "chat", body, [session, "ip-1"]) == job_id
    with pytest.raises(ServiceError) as error:
        enqueue(queue, 2)
    assert error.value.code == "QUEUE_FULL"
    with setup.store.connect() as db:
        assert db.execute("SELECT count(*) AS n FROM jobs").fetchone()["n"] == 1
        assert db.execute("SELECT amount FROM usage_counters WHERE subject=%s AND bucket LIKE '%%:requests' ORDER BY bucket LIMIT 1", (session,)).fetchone()["amount"] == 1
    with pytest.raises(ServiceError) as error:
        queue.enqueue(session, "chat", body.model_copy(update={"question": "different"}), [session, "ip-1"])
    assert error.value.code == "REQUEST_CONFLICT"


def test_independent_workers_share_execution_limit_and_never_claim_twice(setup):
    settings = replace(setup.settings, usage_global_concurrency=2)
    first = JobQueue(setup.store, UsageGuard(setup.store, settings))
    for i in range(5):
        enqueue(first, i)
    with closing(Store(setup.store.database_url, setup.store.schema)) as other:
        second = JobQueue(other, UsageGuard(other, settings))
        with ThreadPoolExecutor(max_workers=8) as executor:
            jobs = list(executor.map(lambda i: (first if i % 2 else second).claim(f"worker-{i}"), range(8)))
        claimed = [j for j in jobs if j]
        assert len(claimed) == len({j["job_id"] for j in claimed}) == 2
        with setup.store.connect() as db:
            assert db.execute("SELECT count(*) AS n FROM usage_leases WHERE NOT queued").fetchone()["n"] == 2


def test_queued_lease_cannot_call_model_until_claimed(setup):
    guard = UsageGuard(setup.store, setup.settings)
    queue = JobQueue(setup.store, guard)
    enqueue(queue, 1)
    with setup.store.connect() as db:
        lease = db.execute("SELECT lease FROM job_queue").fetchone()["lease"]
    with pytest.raises(ServiceError):
        guard.reserve(lease, 100)
    queue.claim("worker")
    assert guard.reserve(lease, 100)


def test_lost_worker_is_not_replayed_and_cannot_publish_late_result(setup):
    queue = JobQueue(setup.store, UsageGuard(setup.store, setup.settings))
    job_id, session, _ = enqueue(queue, 1)
    queue.claim("old-worker")
    with setup.store.connect() as db:
        db.execute("UPDATE job_queue SET claimed_until=clock_timestamp()-interval '1 second'")
    queue.heartbeat("old-worker")  # An expired claim must stay expired.
    assert queue.claim("new-worker") is None
    assert setup.store.job(job_id, session)["status"] == "interrupted"
    token = active_job_claim.set((job_id, "old-worker"))
    try:
        with pytest.raises(ServiceError) as error:
            setup.store.update_job(job_id, status="completed", result={"answer": "late"})
        assert error.value.code == "JOB_OWNERSHIP_LOST"
    finally:
        active_job_claim.reset(token)


def test_queue_timeout_releases_slot_and_session(setup):
    queue = JobQueue(setup.store, UsageGuard(setup.store, setup.settings))
    job_id, session, body = enqueue(queue, 1)
    with setup.store.connect() as db:
        db.execute("UPDATE job_queue SET expires_at=clock_timestamp()-interval '1 second'")
    assert queue.claim("worker") is None
    job = setup.store.job(job_id, session)
    assert job["error"]["code"] == "QUEUE_TIMEOUT"
    assert queue.enqueue(session, "chat", body.model_copy(update={"client_request_id": uuid4()}), [session, "ip-1"])


def test_external_worker_readiness_requires_recent_heartbeat(setup):
    settings = replace(setup.settings, job_worker_embedded=False)
    with TestClient(create_app(settings, service=setup.service)) as client:
        assert client.get('/api/status').json()['data']['missing'] == ['WORKER_NOT_READY']
        queue = JobQueue(setup.store, client.app.state.usage)
        queue.heartbeat('worker')
        assert client.get('/api/status').json()['data']['ready'] is True
        with setup.store.connect() as db:
            db.execute("UPDATE job_workers SET heartbeat_at=clock_timestamp()-interval '30 seconds'")
        assert client.get('/api/status').json()['data']['ready'] is False


def test_legacy_rollback_releases_slots_without_refunding_unknown_calls(setup):
    guard = UsageGuard(setup.store, setup.settings)
    queue = JobQueue(setup.store, guard)
    job_id, session, _ = enqueue(queue, 1)
    claimed = queue.claim('stopped-worker')
    guard.reserve(claimed['lease'], 100)
    assert queue.interrupt_all() == 1
    assert queue.interrupt_all() == 0
    assert setup.store.job(job_id, session)['status'] == 'interrupted'
    with setup.store.connect() as db:
        assert db.execute('SELECT count(*) AS n FROM usage_leases').fetchone()['n'] == 0
        assert db.execute('SELECT count(*) AS n FROM usage_reservations').fetchone()['n'] == 1
