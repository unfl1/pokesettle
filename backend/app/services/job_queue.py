"""Bounded PostgreSQL queue; enqueue, claim and quota changes are atomic."""

from psycopg.types.json import Jsonb

from backend.app.core.errors import ServiceError

CLAIM_SECONDS = 75


class JobQueue:
    def __init__(self, store, guard):
        self.store, self.guard, self.settings = store, guard, guard.settings

    def enqueue(self, session_id, kind, body, subjects, *, model_free=False):
        data = body.model_dump(mode="json")
        day = None
        with self.guard.locked() as db:
            job_id, created = self.store.create_job(
                session_id, kind, str(body.client_request_id), data, db=db,
            )
            if not created:
                return job_id
            self._reap(db)
            count = db.execute("SELECT count(*) AS n FROM job_queue").fetchone()["n"]
            if count >= self.settings.job_queue_capacity:
                raise ServiceError("QUEUE_FULL", "질문 대기열이 가득 찼습니다. 잠시 후 다시 시도해 주세요.", 429, True)
            lease = None
            if not model_free:
                lease, day = self.guard._begin(db, subjects, queued=True)
            db.execute(
                """INSERT INTO job_queue (job_id,body,lease,expires_at)
                    VALUES (%s,%s,%s,clock_timestamp()+%s*interval '1 second')""",
                (job_id, Jsonb(data), lease, self.settings.job_queue_timeout),
            )
            self.store.update_job(job_id, db=db, stage="waiting")
        if day:
            self.guard._cleanup_day = day
        return job_id

    def _reap(self, db):
        rows = db.execute("""SELECT q.job_id,q.lease,q.claimed_by,j.payload::jsonb->>'status' AS status
            FROM job_queue q JOIN jobs j ON j.id=q.job_id
            WHERE (q.claimed_by IS NOT NULL AND q.claimed_until<=clock_timestamp())
               OR (q.claimed_by IS NULL AND q.expires_at<=clock_timestamp())
               OR j.payload::jsonb->>'status' IN ('completed','failed','interrupted') FOR UPDATE OF q""").fetchall()
        for row in rows:
            error = ServiceError(
                "JOB_INTERRUPTED" if row["claimed_by"] else "QUEUE_TIMEOUT",
                "작업 서버 연결이 중단되었습니다. 새 요청으로 재시도해 주세요."
                if row["claimed_by"] else "질문 대기 시간이 초과되었습니다. 새 요청으로 재시도해 주세요.",
                503, True,
            )
            if row["status"] not in {"completed", "failed", "interrupted"}:
                self.store.update_job(row["job_id"], db=db, status="interrupted", error=error.as_dict())
            db.execute("DELETE FROM job_queue WHERE job_id=%s", (row["job_id"],))
            if row["lease"]:
                db.execute("DELETE FROM usage_leases WHERE id=%s", (row["lease"],))

    def claim(self, worker_id):
        with self.guard.locked() as db:
            self._reap(db)
            active = db.execute("""SELECT
                (SELECT count(*) FROM job_queue WHERE claimed_by IS NOT NULL) +
                (SELECT count(*) FROM usage_leases l WHERE NOT queued AND expires_at>now()
                    AND NOT EXISTS (SELECT 1 FROM job_queue q WHERE q.lease=l.id)) AS n""").fetchone()["n"]
            if active >= self.settings.usage_global_concurrency:
                return None
            row = db.execute("""SELECT q.*,j.session_id,j.kind FROM job_queue q
                JOIN jobs j ON j.id=q.job_id WHERE q.claimed_by IS NULL
                ORDER BY q.created_at,q.job_id LIMIT 1 FOR UPDATE OF q SKIP LOCKED""").fetchone()
            if not row:
                return None
            db.execute("""UPDATE job_queue SET claimed_by=%s,
                claimed_until=clock_timestamp()+%s*interval '1 second' WHERE job_id=%s""",
                (worker_id, CLAIM_SECONDS, row["job_id"]))
            if row["lease"]:
                changed = db.execute("""UPDATE usage_leases SET queued=false,
                    expires_at=clock_timestamp()+%s*interval '1 second' WHERE id=%s""",
                    (CLAIM_SECONDS, row["lease"])).rowcount
                if not changed:
                    self.store.update_job(row["job_id"], db=db, status="interrupted",
                        error=ServiceError("JOB_INTERRUPTED", "사용량 예약이 만료되었습니다. 새 요청으로 재시도해 주세요.", 503, True).as_dict())
                    db.execute("DELETE FROM job_queue WHERE job_id=%s", (row["job_id"],))
                    return None
            self.store.update_job(row["job_id"], db=db, status="running", stage="validating")
            return row

    def heartbeat(self, worker_id, *, draining=False):
        with self.guard.locked() as db:
            db.execute("""INSERT INTO job_workers VALUES (%s,clock_timestamp(),%s)
                ON CONFLICT(id) DO UPDATE SET heartbeat_at=excluded.heartbeat_at,draining=excluded.draining""",
                (worker_id, draining))
            db.execute("DELETE FROM job_workers WHERE heartbeat_at<now()-interval '1 day'")
            # Never resurrect ownership already lost to an expired claim.
            db.execute("""UPDATE job_queue SET claimed_until=clock_timestamp()+%s*interval '1 second'
                WHERE claimed_by=%s AND claimed_until>clock_timestamp()""", (CLAIM_SECONDS, worker_id))
            db.execute("""UPDATE usage_leases SET expires_at=clock_timestamp()+%s*interval '1 second'
                WHERE id IN (SELECT lease FROM job_queue WHERE claimed_by=%s
                    AND claimed_until>clock_timestamp())""", (CLAIM_SECONDS, worker_id))

    def finish(self, job_id, worker_id):
        with self.guard.locked() as db:
            row = db.execute("""SELECT lease FROM job_queue WHERE job_id=%s AND claimed_by=%s
                AND claimed_until>clock_timestamp() FOR UPDATE""", (job_id, worker_id)).fetchone()
            if row:
                current = db.execute("SELECT payload::jsonb->>'status' AS status FROM jobs WHERE id=%s", (job_id,)).fetchone()
                if current["status"] not in {"completed", "failed", "interrupted"}:
                    self.store.update_job(job_id, db=db, status="failed",
                        error=ServiceError("INTERNAL_ERROR", "작업 처리 중 오류가 발생했습니다.", 500, True).as_dict())
                db.execute("DELETE FROM job_queue WHERE job_id=%s", (job_id,))
                if row["lease"]:
                    db.execute("DELETE FROM usage_leases WHERE id=%s", (row["lease"],))

    def remove_worker(self, worker_id):
        with self.store.connect() as db:
            db.execute("DELETE FROM job_workers WHERE id=%s", (worker_id,))

    def interrupt_all(self):
        """Maintenance only: stop all API/worker processes before legacy rollback."""
        with self.guard.locked() as db:
            rows = db.execute("""SELECT q.job_id,q.lease,j.payload::jsonb->>'status' AS status
                FROM job_queue q JOIN jobs j ON j.id=q.job_id FOR UPDATE OF q""").fetchall()
            for row in rows:
                if row["status"] not in {"completed", "failed", "interrupted"}:
                    self.store.update_job(row["job_id"], db=db, status="interrupted",
                        error=ServiceError("JOB_INTERRUPTED", "서버 버전 복원으로 작업이 중단되었습니다. 새 요청으로 재시도해 주세요.", 503, True).as_dict())
                if row["lease"]:
                    db.execute("DELETE FROM usage_leases WHERE id=%s", (row["lease"],))
            db.execute("DELETE FROM job_queue")
            # Keep unknown-outcome token reservations: stopping is not a refund.
        return len(rows)
