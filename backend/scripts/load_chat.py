"""Isolated local k6 run with real PostgreSQL, RAG and configured model provider.

Usage: python -m backend.scripts.load_chat --users 50 --name distinct-50
Raw measurements stay in ignored runtime/load-test/. Never targets production.
"""

import argparse
import asyncio
import json
import os
import resource
import signal
import subprocess
import sys
import threading
import time
from collections import Counter, defaultdict
from contextlib import contextmanager
from dataclasses import replace
from pathlib import Path
from urllib.parse import urlparse
from uuid import uuid4

import httpx
import psycopg
from psycopg import sql
from psycopg.conninfo import make_conninfo

from backend.app.core.config import ROOT, Settings


def serve(args, settings):
    import uvicorn

    from backend.app.api import jobs as admission_jobs
    from backend.app.core.usage import UsageGuard
    from backend.app.main import create_app, create_service

    settings = replace(
        settings, database_schema=args.schema,
        database_url=make_conninfo(settings.database_url, application_name=args.schema + ('_worker' if args.worker else '_api')),
        trust_usage_proxy=True, telemetry_enabled=False, job_worker_embedded=False,
        api_key='load-test-only' if args.mock_model else settings.api_key,
    )
    service = create_service(settings)
    if args.mock_model:
        from backend.app.core.usage import active_usage
        from backend.app.schemas import Generation, QueryPlan, Selection
        from backend.app.services.chat_scope import ChatScope

        def simulated_invoke(purpose, system, payload, schema):
            guard, lease = active_usage.get()
            reservation, _ = guard.reserve_model(lease, 200)
            time.sleep(args.mock_delay)
            guard.settle(reservation, {'input_tokens': 100, 'output_tokens': 20, 'total_tokens': 120})
            if purpose == 'chat_scope':
                return ChatScope(in_scope=True)
            if purpose == 'queries':
                return QueryPlan(queries=[])
            if purpose == 'selection':
                return Selection(selected_candidate_ids=[c['candidate_id'] for c in payload['candidates']], decisions=[])
            return Generation(answer_status='answered', claims=[{
                'text': 'LOAD TEST ONLY: synthetic response.',
                'evidence_ids': [payload['evidence'][0]['evidence_id']],
            }], assumptions=[], unknowns=[])

        service.model.invoke = simulated_invoke
    lock = threading.Lock()
    timings = defaultdict(list)
    counts = Counter()
    events = []
    original_connect = service.store.connect

    @contextmanager
    def measured_connect():
        start = time.perf_counter()
        with original_connect() as db:
            with lock:
                timings['db_connect_ms'].append((time.perf_counter() - start) * 1000)
                counts['db_checkouts'] += 1
                counts['db_current'] += 1
                counts['db_peak'] = max(counts['db_peak'], counts['db_current'])
            try:
                yield db
            finally:
                with lock:
                    counts['db_current'] -= 1

    service.store.connect = measured_connect
    original_locked = UsageGuard.locked

    @contextmanager
    def measured_locked(guard):
        start = time.perf_counter()
        with original_locked(guard) as db:
            with lock:
                timings['usage_lock_acquire_ms'].append((time.perf_counter() - start) * 1000)
            yield db

    UsageGuard.locked = measured_locked
    original_invoke = service.model.invoke

    def measured_invoke(purpose, *rest):
        start = time.perf_counter()
        outcome = 'success'
        with lock:
            counts['model_current'] += 1
            counts['model_peak'] = max(counts['model_peak'], counts['model_current'])
        try:
            return original_invoke(purpose, *rest)
        except Exception as error:
            outcome = getattr(error, 'code', type(error).__name__)
            raise
        finally:
            with lock:
                counts['model_current'] -= 1
                timings['model_' + purpose + '_ms'].append((time.perf_counter() - start) * 1000)
                counts['model_' + purpose + '_' + outcome] += 1

    service.model.invoke = measured_invoke

    def measure_method(target, method):
        original = getattr(target, method)

        def measured(*positional, **keywords):
            start = time.perf_counter()
            cpu_start = time.thread_time()
            try:
                return original(*positional, **keywords)
            finally:
                with lock:
                    timings[method + '_ms'].append((time.perf_counter() - start) * 1000)
                    timings[method + '_cpu_ms'].append((time.thread_time() - cpu_start) * 1000)

        setattr(target, method, measured)

    measure_method(service, 'collect')
    measure_method(service.vectors, 'retrieve')
    measure_method(service, 'chat_focus')
    measure_method(admission_jobs, 'catalog_navigation')
    original_update = service.store.update_job

    def measured_update(job_id, **fields):
        with lock:
            events.append({'time': time.time(), 'job': job_id,
                           'status': fields.get('status'), 'stage': fields.get('stage')})
        return original_update(job_id, **fields)

    service.store.update_job = measured_update
    stop = threading.Event()
    samples = []

    def monitor():
        try:
            with psycopg.connect(settings.database_url, autocommit=True) as db:
                while not stop.wait(.2):
                    row = db.execute(
                        "SELECT count(*), count(*) FILTER (WHERE wait_event_type='Lock') "
                        "FROM pg_stat_activity WHERE application_name=%s AND pid<>pg_backend_pid()",
                        (args.schema + ('_worker' if args.worker else '_api'),),
                    ).fetchone()
                    usage = resource.getrusage(resource.RUSAGE_SELF)
                    samples.append({'time': time.time(), 'db_connections': row[0],
                                    'db_lock_waiters': row[1],
                                    'cpu_seconds': usage.ru_utime + usage.ru_stime,
                                    'peak_rss_bytes': usage.ru_maxrss * (1 if sys.platform == 'darwin' else 1024)})
        except Exception as error:
            counts['monitor_error_' + type(error).__name__] += 1

    monitor_thread = threading.Thread(target=monitor, daemon=True)
    monitor_thread.start()
    try:
        if args.worker:
            from backend.app.worker import JobWorker
            worker = JobWorker(service, UsageGuard(service.store, settings))
            original_execute = worker.execute

            def measured_execute(job):
                with lock:
                    counts['jobs_current'] += 1
                    counts['jobs_peak'] = max(counts['jobs_peak'], counts['jobs_current'])
                try:
                    return original_execute(job)
                finally:
                    with lock:
                        counts['jobs_current'] -= 1

            worker.execute = measured_execute
            for signum in (signal.SIGINT, signal.SIGTERM):
                signal.signal(signum, lambda *_: worker.stop.set())
            worker.run_forever()
        else:
            uvicorn.run(create_app(settings, service=service), host='127.0.0.1', port=args.port,
                        access_log=False, log_level='warning', proxy_headers=False)
    finally:
        stop.set()
        monitor_thread.join(timeout=3)
        def summarize(values):
            ordered = sorted(values)
            return {'count': len(values), 'avg': sum(values) / len(values),
                    'p95': ordered[min(len(values) - 1, int(len(values) * .95))],
                    'max': ordered[-1]}

        Path(args.stats).write_text(json.dumps({
            'counts': dict(counts), 'timings': {k: summarize(v) for k, v in timings.items()},
            'events': events,
            'samples': samples,
            'pool_stats': service.store.pool.get_stats(),
        }, indent=2))
        try:
            asyncio.run(service.model.aclose())
        finally:
            if callable(getattr(service.vectors.embed, "close", None)):
                service.vectors.embed.close()
            service.store.close()


def run(args, settings):
    if urlparse(settings.database_url).hostname not in {'localhost', '127.0.0.1', '::1'}:
        raise SystemExit('Only a local PostgreSQL database is supported')
    if not settings.model_configured and not args.mock_model:
        raise SystemExit('A configured model is required for this real-model test')
    output = ROOT / 'runtime' / 'load-test' / args.name
    output.mkdir(parents=True, exist_ok=False)
    schema = 'load_' + uuid4().hex
    process = None
    worker_process = None
    metadata = {
        'users': args.users, 'shared_ip': args.shared_ip, 'schema': schema,
        'concurrency': settings.usage_global_concurrency, 'model': settings.chat_model,
        'database_pool_size': settings.database_pool_size,
        'model_mode': 'simulated' if args.mock_model else 'real',
        'question_mode': 'mixed' if args.mixed else 'single',
        'question': args.question, 'started_at': time.time(),
        'environment': 'local API and separate worker processes; cloned reference cache',
    }
    try:
        with psycopg.connect(settings.database_url) as db:
            db.execute(sql.SQL('CREATE SCHEMA {}').format(sql.Identifier(schema)))
            for table in ('vector_collections', 'vector_entries', 'cache'):
                db.execute(sql.SQL('CREATE TABLE {}.{} (LIKE {}.{} INCLUDING ALL)').format(
                    sql.Identifier(schema), sql.Identifier(table),
                    sql.Identifier(settings.database_schema), sql.Identifier(table)))
                condition = sql.SQL(" WHERE namespace IN ('manifest','http','query_complete','query_plan','search_candidates','document')") if table == 'cache' else sql.SQL('')
                db.execute(sql.SQL('INSERT INTO {}.{} SELECT * FROM {}.{}{}').format(
                    sql.Identifier(schema), sql.Identifier(table),
                    sql.Identifier(settings.database_schema), sql.Identifier(table), condition))
                metadata[table + '_rows'] = db.execute(sql.SQL('SELECT count(*) FROM {}.{}').format(
                    sql.Identifier(schema), sql.Identifier(table))).fetchone()[0]
                db.execute(sql.SQL('ANALYZE {}.{}').format(sql.Identifier(schema), sql.Identifier(table)))
        with (output / 'server.log').open('w') as log, (output / 'worker.log').open('w') as worker_log:
            process = subprocess.Popen([
                sys.executable, '-m', 'backend.scripts.load_chat', '--serve', '--schema', schema,
                '--port', str(args.port), '--stats', str(output / 'server-stats.json'),
                *(['--mock-model', '--mock-delay', str(args.mock_delay)] if args.mock_model else []),
            ], cwd=ROOT, stdout=log, stderr=subprocess.STDOUT,
                env={**os.environ, 'OMP_NUM_THREADS': '1', 'TOKENIZERS_PARALLELISM': 'false'})
            with httpx.Client(timeout=2) as client:
                for _ in range(120):
                    if process.poll() is not None:
                        raise RuntimeError(f'Test server exited; see {output / "server.log"}')
                    try:
                        response = client.get(f'http://127.0.0.1:{args.port}/api/status')
                        if response.status_code == 200:
                            status = response.json()['data']
                            if status['ready'] or status['missing'] == ['WORKER_NOT_READY']:
                                break
                    except httpx.HTTPError:
                        pass
                    time.sleep(.5)
                else:
                    raise RuntimeError('Test server readiness deadline exceeded')
            worker_process = subprocess.Popen([
                sys.executable, '-m', 'backend.scripts.load_chat', '--serve', '--worker', '--schema', schema,
                '--stats', str(output / 'worker-stats.json'),
                *(['--mock-model', '--mock-delay', str(args.mock_delay)] if args.mock_model else []),
            ], cwd=ROOT, stdout=worker_log, stderr=subprocess.STDOUT,
                env={**os.environ, 'OMP_NUM_THREADS': '1', 'TOKENIZERS_PARALLELISM': 'false'})
            with psycopg.connect(settings.database_url, autocommit=True) as db:
                for _ in range(120):
                    if worker_process.poll() is not None:
                        raise RuntimeError('Test worker exited; inspect worker.log')
                    row = db.execute(sql.SQL('SELECT count(*) FROM {}.job_workers').format(sql.Identifier(schema))).fetchone()
                    if row[0]:
                        break
                    time.sleep(.25)
                else:
                    raise RuntimeError('Worker readiness deadline exceeded')
            with (output / 'k6.log').open('w') as log:
                result = subprocess.run([
                    'k6', 'run', '--quiet', '--out', f'json={output / "k6-samples.jsonl"}',
                    str(ROOT / 'backend/scripts/load_chat.k6.js'),
                ], cwd=ROOT, stdout=log, stderr=subprocess.STDOUT, env={
                    **os.environ, 'LOAD_BASE_URL': f'http://127.0.0.1:{args.port}',
                    'LOAD_USERS': str(args.users), 'LOAD_SHARED_IP': str(int(args.shared_ip)),
                    'LOAD_QUESTION': args.question, 'LOAD_SUMMARY': str(output / 'k6-summary.json'),
                    'LOAD_MIXED': str(int(args.mixed)),
                }, timeout=240)
                metadata['k6_exit_code'] = result.returncode
            # Capture only aggregates, never generated answers, cookies or credentials.
            with psycopg.connect(settings.database_url) as db:
                metadata['usage'] = db.execute(sql.SQL(
                    "SELECT bucket,amount FROM {}.usage_counters WHERE subject='global'"
                ).format(sql.Identifier(schema))).fetchall()
                metadata['jobs'] = db.execute(sql.SQL(
                    "SELECT payload::jsonb->>'status',count(*) FROM {}.jobs GROUP BY 1"
                ).format(sql.Identifier(schema))).fetchall()
    finally:
        for child in (process, worker_process):
            if child and child.poll() is None:
                child.send_signal(signal.SIGINT)
                try:
                    child.wait(timeout=25)
                except subprocess.TimeoutExpired:
                    child.kill()
                    child.wait()
        with psycopg.connect(settings.database_url) as db:
            db.execute(sql.SQL('DROP SCHEMA IF EXISTS {} CASCADE').format(sql.Identifier(schema)))
        metadata['finished_at'] = time.time()
        (output / 'run.json').write_text(json.dumps(metadata, indent=2, ensure_ascii=False))
    print(json.dumps(metadata, indent=2, ensure_ascii=False))
    print('Results:', output)
    return metadata['k6_exit_code']


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--users', type=int, default=100, choices=range(1, 101))
    parser.add_argument('--name', default='distinct-50')
    parser.add_argument('--shared-ip', action='store_true')
    parser.add_argument('--question', default='피카츄의 특징과 활용할 때 주의할 점을 근거를 들어 설명해 줘.')
    parser.add_argument('--port', type=int, default=8010)
    parser.add_argument('--serve', action='store_true', help=argparse.SUPPRESS)
    parser.add_argument('--worker', action='store_true', help=argparse.SUPPRESS)
    parser.add_argument('--mock-model', action='store_true', help='Simulated model only; no provider performance claim')
    parser.add_argument('--mock-delay', type=float, default=1)
    parser.add_argument('--mixed', action='store_true', help='Ten species and two strategy questions per species')
    parser.add_argument('--schema', help=argparse.SUPPRESS)
    parser.add_argument('--stats', help=argparse.SUPPRESS)
    args = parser.parse_args()
    if args.serve:
        serve(args, Settings.from_env())
    else:
        raise SystemExit(run(args, Settings.from_env()))


if __name__ == '__main__':
    main()
