from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
from threading import Barrier

import psycopg
import pytest
from fastapi.testclient import TestClient

from backend.app.core.config import Settings
from backend.app.core.errors import ServiceError
from backend.app.core.usage import UsageGuard
from backend.app.main import create_app
from backend.app.storage import Store


def test_reused_connection_rolls_back_and_resets_transaction_settings(pg_store):
    with closing(Store(pg_store.database_url, pg_store.schema, pool_size=1)) as store:
        with store.connect() as db:
            pid = db.info.backend_pid
            assert db.execute("SELECT current_schema() AS value").fetchone()['value'] == store.schema
        with pytest.raises(psycopg.errors.DivisionByZero):
            with store.connect() as db:
                db.execute("INSERT INTO cache VALUES ('test','rolled-back','{}')")
                db.execute('SELECT 1/0')
        with store.connect() as db:
            assert db.info.backend_pid == pid
        assert store.get('test', 'rolled-back') is None
        # A transaction-local override must not leak into the next checkout.
        with store.pool.connection() as db:
            db.execute('SET LOCAL search_path TO public')
        with store.connect() as db:
            assert db.execute('SELECT current_schema() AS value').fetchone()['value'] == store.schema


def test_parallel_reads_reuse_bounded_physical_connections(pg_store):
    with closing(Store(pg_store.database_url, pg_store.schema, pool_size=2)) as store:
        barrier = Barrier(20)

        def read(_):
            barrier.wait(timeout=5)
            with store.connect() as db:
                db.execute('SELECT pg_sleep(0.01)')
                return db.info.backend_pid

        with ThreadPoolExecutor(max_workers=20) as executor:
            pids = list(executor.map(read, range(20)))
        assert len(set(pids)) <= 2
        assert store.pool.get_stats()['connections_num'] <= 2


def test_pool_exhaustion_returns_retryable_error_and_recovers(pg_store):
    with closing(Store(pg_store.database_url, pg_store.schema,
                       pool_size=1, pool_timeout=.05)) as store:
        with store.connect():
            with pytest.raises(ServiceError) as error:
                store.get('test', 'unavailable')
            assert (error.value.code, error.value.status, error.value.retryable) == (
                'DATABASE_BUSY', 503, True,
            )
        store.put('test', 'recovered', {'ok': True})
        assert store.get('test', 'recovered') == {'ok': True}


def test_pool_exhaustion_uses_safe_http_error_envelope(pg_store):
    from types import SimpleNamespace

    with closing(Store(pg_store.database_url, pg_store.schema,
                       pool_size=1, pool_timeout=.05)) as store:
        with TestClient(create_app(Settings(), service=SimpleNamespace(store=store))) as client:
            with store.connect():
                response = client.post('/api/session')
            assert response.status_code == 503
            assert response.json()['error']['code'] == 'DATABASE_BUSY'
            assert response.json()['error']['retryable'] is True
            assert store.database_url not in response.text
            assert client.post('/api/session').status_code == 200


@pytest.mark.parametrize('shared_ip,expected', [(False, 2), (True, 1)])
def test_admission_limits_hold_across_independent_pools(pg_store, shared_ip, expected):
    with closing(Store(pg_store.database_url, pg_store.schema, pool_size=2)) as other:
        guards = [UsageGuard(pg_store, Settings(usage_global_concurrency=2)),
                  UsageGuard(other, Settings(usage_global_concurrency=2))]
        barrier = Barrier(20)

        def begin(index):
            barrier.wait(timeout=5)
            guard = guards[index % 2]
            try:
                lease = guard.begin([f'session-{index}', 'shared' if shared_ip else f'ip-{index}'])
                return guard, lease
            except ServiceError as error:
                assert error.code == 'USAGE_BUSY'
                return None

        with ThreadPoolExecutor(max_workers=20) as executor:
            leases = [result for result in executor.map(begin, range(20)) if result]
        assert len(leases) == expected
        for guard, lease in leases:
            guard.finish(lease)


def test_owned_pool_closes_on_startup_failure(pg_store, monkeypatch):
    from types import SimpleNamespace

    store = Store(pg_store.database_url, pg_store.schema)
    monkeypatch.setattr('backend.app.main.create_service', lambda *args: SimpleNamespace(store=store))

    def fail(*args):
        raise RuntimeError('usage initialization failed')

    monkeypatch.setattr('backend.app.main.UsageGuard', fail)
    with pytest.raises(RuntimeError, match='usage initialization failed'):
        with TestClient(create_app(Settings())):
            pass
    assert store.pool.closed


@pytest.mark.parametrize('values', [{'database_pool_size': 0}, {'database_pool_timeout': 0}])
def test_pool_configuration_rejects_nonpositive_values(values):
    with pytest.raises(ValueError):
        Settings(**values)
