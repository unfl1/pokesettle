"""Dedicated bounded job executor. Run: python -m backend.app.worker"""

import argparse
import asyncio
import logging
import signal
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

from backend.app.core.config import Settings
from backend.app.core.usage import UsageGuard
from backend.app.schemas import ChatRequest, CollectRequest
from backend.app.services.job_queue import JobQueue
from backend.app.services.jobs import run_job
from backend.app.storage import active_job_claim

logger = logging.getLogger(__name__)


class JobWorker:
    def __init__(self, service, guard):
        self.service, self.guard = service, guard
        self.queue = JobQueue(service.store, guard)
        self.worker_id = uuid4().hex
        self.stop = threading.Event()
        self.thread = None

    def start(self):
        self.queue.heartbeat(self.worker_id)
        self.thread = threading.Thread(target=self.run_forever, name="job-dispatch", daemon=True)
        self.thread.start()

    def close(self):
        self.stop.set()
        if self.thread:
            self.thread.join()

    def execute(self, job):
        token = active_job_claim.set((job["job_id"], self.worker_id))
        try:
            body_type = ChatRequest if job["kind"] in {"chat", "guide"} else CollectRequest
            body = body_type.model_validate(job["body"])
            run_job(self.service, job["job_id"], job["kind"], body, job["session_id"],
                    self.guard if job["lease"] else None, job["lease"])
        finally:
            active_job_claim.reset(token)
            self.queue.finish(job["job_id"], self.worker_id)

    def run_forever(self):
        pending = set()
        last_heartbeat = 0
        try:
            with ThreadPoolExecutor(max_workers=self.guard.settings.usage_global_concurrency,
                                    thread_name_prefix="answer") as executor:
                while not self.stop.is_set() or pending:
                    for future in list(pending):
                        if future.done():
                            pending.remove(future)
                            try:
                                future.result()
                            except Exception as error:
                                logger.error("Worker execution failure type=%s", type(error).__name__)
                    try:
                        if time.monotonic() - last_heartbeat >= 5:
                            self.queue.heartbeat(self.worker_id, draining=self.stop.is_set())
                            last_heartbeat = time.monotonic()
                        if not self.stop.is_set():
                            for _ in range(self.guard.settings.usage_global_concurrency - len(pending)):
                                if self.stop.is_set():
                                    break
                                if time.monotonic() - last_heartbeat >= 5:
                                    self.queue.heartbeat(self.worker_id)
                                    last_heartbeat = time.monotonic()
                                job = self.queue.claim(self.worker_id)
                                if job is None:
                                    break
                                pending.add(executor.submit(self.execute, job))
                    except Exception as error:
                        logger.error("Worker dispatch failure type=%s", type(error).__name__)
                    time.sleep(.1)
        finally:
            try:
                self.queue.remove_worker(self.worker_id)
            except Exception as error:
                logger.error("Worker deregistration failure type=%s", type(error).__name__)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--healthcheck", action="store_true")
    parser.add_argument("--interrupt-all", action="store_true",
                        help="Legacy rollback maintenance: stop API and workers first; never refunds token reservations")
    args = parser.parse_args()
    settings = Settings.from_env()
    if args.healthcheck:
        import psycopg
        from psycopg import sql
        with psycopg.connect(settings.database_url, connect_timeout=5) as db:
            healthy = db.execute(sql.SQL("""SELECT 1 FROM {}.job_workers WHERE NOT draining
                AND heartbeat_at>clock_timestamp()-interval '20 seconds' LIMIT 1""").format(
                sql.Identifier(settings.database_schema))).fetchone()
        raise SystemExit(0 if healthy else 1)

    from backend.app.core.telemetry import Telemetry
    from backend.app.main import create_service

    telemetry = Telemetry()
    service = create_service(settings, telemetry)
    try:
        if args.interrupt_all:
            queue = JobQueue(service.store, UsageGuard(service.store, settings))
            print("Interrupted jobs:", queue.interrupt_all())
            return
        if settings.telemetry_enabled:
            telemetry.start(settings.runtime_dir / "telemetry" / "worker")
        worker = JobWorker(service, UsageGuard(service.store, settings, telemetry))
        for signum in (signal.SIGINT, signal.SIGTERM):
            signal.signal(signum, lambda *_: worker.stop.set())
        worker.run_forever()
    finally:
        telemetry.close()
        try:
            asyncio.run(service.model.aclose())
        finally:
            if callable(getattr(service.vectors.embed, "close", None)):
                service.vectors.embed.close()
            service.store.close()


if __name__ == "__main__":
    main()
