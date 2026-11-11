import hashlib
import json
import re
import threading
from contextlib import contextmanager, nullcontext
from contextvars import ContextVar
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import psycopg
from psycopg import sql
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool, PoolTimeout, TooManyRequests

from backend.app.core.errors import ServiceError

active_job_claim = ContextVar("active_job_claim", default=None)


def now():
    return datetime.now(timezone.utc).isoformat()


def digest(value):
    return hashlib.sha256(
        json.dumps(value, ensure_ascii=False, sort_keys=True, default=str).encode()
    ).hexdigest()


class Store:
    def __init__(self, database_url: str, schema: str = "poketact", *,
                 pool_size: int = 10, pool_timeout: float = 5):
        if not re.fullmatch(r"[a-z_][a-z0-9_]{0,62}", schema):
            raise ValueError("DATABASE_SCHEMA는 소문자 영문·숫자·밑줄만 사용해야 합니다.")
        if not database_url:
            raise ValueError("DATABASE_URL 설정이 필요합니다.")
        self.database_url, self.schema = database_url, schema
        # Wait for the usage critical section before borrowing a DB connection.
        self.usage_lock = threading.RLock()
        with psycopg.connect(database_url, connect_timeout=10) as db:
            db.execute(sql.SQL("CREATE SCHEMA IF NOT EXISTS {}").format(sql.Identifier(schema)))
        self.pool = ConnectionPool(
            database_url, min_size=1, max_size=pool_size, timeout=pool_timeout,
            max_waiting=100, open=True,
            kwargs={"connect_timeout": 10, "row_factory": dict_row},
            configure=self._configure_connection,
        )
        try:
            self._initialize()
        except BaseException:
            self.close()
            raise

    def _initialize(self):
        with self.connect() as db:
            for statement in (
                "CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, expires_at TEXT NOT NULL)",
                "CREATE TABLE IF NOT EXISTS cache (namespace TEXT, key TEXT, value TEXT NOT NULL, PRIMARY KEY(namespace,key))",
                "CREATE TABLE IF NOT EXISTS conversations (id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id), pokemon_id TEXT NOT NULL, regulation_id TEXT, seq BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE)",
                "CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id), role TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL, seq BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE)",
                "CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id), kind TEXT NOT NULL, client_id TEXT NOT NULL, request_hash TEXT NOT NULL, payload TEXT NOT NULL, UNIQUE(session_id,kind,client_id))",
                "CREATE TABLE IF NOT EXISTS teams (id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id), name TEXT NOT NULL, members TEXT NOT NULL, updated_at TEXT NOT NULL)",
                "CREATE INDEX IF NOT EXISTS conversations_owner ON conversations(session_id,pokemon_id,seq DESC)",
                "CREATE INDEX IF NOT EXISTS messages_conversation ON messages(conversation_id,seq)",
                "CREATE INDEX IF NOT EXISTS teams_owner ON teams(session_id)",
                """CREATE TABLE IF NOT EXISTS job_queue (
                    job_id TEXT PRIMARY KEY REFERENCES jobs(id), body JSONB NOT NULL,
                    lease TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
                    expires_at TIMESTAMPTZ NOT NULL, claimed_by TEXT, claimed_until TIMESTAMPTZ)""",
                "CREATE INDEX IF NOT EXISTS job_queue_pending ON job_queue(created_at,job_id) WHERE claimed_by IS NULL",
                """CREATE TABLE IF NOT EXISTS job_workers (
                    id TEXT PRIMARY KEY, heartbeat_at TIMESTAMPTZ NOT NULL,
                    draining BOOLEAN NOT NULL DEFAULT false)""",
            ):
                db.execute(statement)

    def _configure_connection(self, db):
        # Each Store owns a schema-specific pool. Set its default once per
        # physical connection instead of adding a query to every transaction.
        db.execute(sql.SQL("SET search_path TO {}, public").format(sql.Identifier(self.schema)))
        db.commit()

    @contextmanager
    def connect(self):
        try:
            # Commit/rollback before returning the connection to this Store's pool.
            with self.pool.connection() as db:
                yield db
        except (PoolTimeout, TooManyRequests):
            raise ServiceError(
                "DATABASE_BUSY", "서버의 데이터 처리 요청이 많습니다. 잠시 후 다시 시도해 주세요.",
                503, True,
            ) from None

    def close(self):
        self.pool.close()

    def get(self, namespace, key):
        with self.connect() as db:
            row = db.execute(
                "SELECT value FROM cache WHERE namespace=%s AND key=%s", (namespace, key)
            ).fetchone()
        return json.loads(row["value"]) if row else None

    def put(self, namespace, key, value):
        with self.connect() as db:
            db.execute(
                "INSERT INTO cache VALUES (%s,%s,%s) ON CONFLICT(namespace,key) DO UPDATE SET value=excluded.value",
                (namespace, key, json.dumps(value, ensure_ascii=False)),
            )

    def session_valid(self, session_id):
        if not session_id:
            return False
        with self.connect() as db:
            return (
                db.execute(
                    "SELECT 1 FROM sessions WHERE id=%s AND expires_at>%s", (session_id, now())
                ).fetchone()
                is not None
            )

    def new_session(self):
        session_id = str(uuid4())
        expires = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
        with self.connect() as db:
            db.execute("INSERT INTO sessions VALUES (%s,%s)", (session_id, expires))
        return session_id

    def conversation(self, session_id, pokemon_id, regulation_id, conversation_id=None):
        with self.connect() as db:
            if conversation_id:
                row = db.execute(
                    "SELECT * FROM conversations WHERE id=%s AND session_id=%s",
                    (conversation_id, session_id),
                ).fetchone()
                if not row:
                    raise ServiceError("RESOURCE_NOT_FOUND", "대화를 찾을 수 없습니다.", 404)
                if row["regulation_id"] != regulation_id:
                    raise ServiceError(
                        "CONVERSATION_SCOPE_MISMATCH", "규칙별로 새 대화가 필요합니다.", 409
                    )
                return conversation_id
            conversation_id = str(uuid4())
            db.execute(
                "INSERT INTO conversations (id,session_id,pokemon_id,regulation_id) VALUES (%s,%s,%s,%s)",
                (conversation_id, session_id, pokemon_id or "general", regulation_id),
            )
        return conversation_id

    def save_exchange(self, conversation_id, question, answer, *, battle_state=None):
        ids = [str(uuid4()), str(uuid4())]
        with self.connect() as db:
            for mid, role, content in zip(ids, ["user", "assistant"], [question, answer]):
                db.execute(
                    "INSERT INTO messages (id,conversation_id,role,content,created_at) VALUES (%s,%s,%s,%s,%s)",
                    (mid, conversation_id, role, json.dumps(content, ensure_ascii=False), now()),
                )
            if battle_state is not None:
                db.execute(
                    "INSERT INTO cache VALUES (%s,%s,%s) ON CONFLICT(namespace,key) DO UPDATE SET value=excluded.value",
                    ("battle_state", conversation_id, json.dumps(battle_state, ensure_ascii=False)),
                )
        return ids

    def conversations(self, session_id, pokemon_id=None, limit=20, offset=0):
        with self.connect() as db:
            total = db.execute(
                "SELECT COUNT(*) AS total FROM conversations WHERE session_id=%s AND (%s::text IS NULL OR pokemon_id=%s)",
                (session_id, pokemon_id, pokemon_id),
            ).fetchone()["total"]
            rows = db.execute(
                """SELECT c.*, COALESCE(MAX(m.created_at),'') AS updated_at,
                (SELECT content FROM messages WHERE conversation_id=c.id AND role='user' ORDER BY seq LIMIT 1) AS first_question,
                COUNT(m.id) AS message_count
                FROM conversations c LEFT JOIN messages m ON m.conversation_id=c.id
                WHERE c.session_id=%s AND (%s::text IS NULL OR c.pokemon_id=%s) GROUP BY c.id
                ORDER BY c.seq DESC LIMIT %s OFFSET %s""",
                (session_id, pokemon_id, pokemon_id, limit, offset),
            ).fetchall()
        return {
            "items": [
                {
                    "conversation_id": r["id"],
                    "pokemon_id": r["pokemon_id"],
                    "regulation_id": r["regulation_id"],
                    "title": json.loads(r["first_question"])[:80]
                    if r["first_question"]
                    else "새 대화",
                    "updated_at": r["updated_at"] or None,
                    "message_count": r["message_count"],
                }
                for r in rows
            ],
            "total": total,
            "limit": limit,
            "offset": offset,
        }

    def delete_conversation(self, session_id, conversation_id):
        with self.connect() as db:
            owner = db.execute(
                "SELECT id FROM conversations WHERE id=%s AND session_id=%s FOR UPDATE",
                (conversation_id, session_id),
            ).fetchone()
            if not owner:
                raise ServiceError("RESOURCE_NOT_FOUND", "대화를 찾을 수 없습니다.", 404)
            db.execute("DELETE FROM messages WHERE conversation_id=%s", (conversation_id,))
            db.execute(
                "DELETE FROM cache WHERE namespace='battle_state' AND key=%s",
                (conversation_id,),
            )
            db.execute("DELETE FROM conversations WHERE id=%s", (conversation_id,))

    def messages(self, session_id, conversation_id, limit=50, offset=0):
        with self.connect() as db:
            owner = db.execute(
                "SELECT * FROM conversations WHERE id=%s AND session_id=%s",
                (conversation_id, session_id),
            ).fetchone()
            if not owner:
                raise ServiceError("RESOURCE_NOT_FOUND", "대화를 찾을 수 없습니다.", 404)
            total = db.execute(
                "SELECT COUNT(*) AS total FROM messages WHERE conversation_id=%s",
                (conversation_id,),
            ).fetchone()["total"]
            rows = db.execute(
                "SELECT * FROM messages WHERE conversation_id=%s ORDER BY seq LIMIT %s OFFSET %s",
                (conversation_id, limit, offset),
            ).fetchall()
        return {
            "conversation_id": conversation_id,
            "pokemon_id": owner["pokemon_id"],
            "items": [
                {
                    "message_id": r["id"],
                    "role": r["role"],
                    "content": json.loads(r["content"]),
                    "created_at": r["created_at"],
                }
                for r in rows
            ],
            "total": total,
            "limit": limit,
            "offset": offset,
        }

    def history(self, conversation_id):
        with self.connect() as db:
            rows = db.execute(
                "SELECT role,content FROM messages WHERE conversation_id=%s ORDER BY seq DESC LIMIT 12",
                (conversation_id,),
            ).fetchall()
        return [
            {"role": row["role"], "content": json.loads(row["content"])} for row in reversed(rows)
        ]

    def create_job(self, session_id, kind, client_id, request, *, db=None):
        request_hash = digest(request)
        with self.connect() if db is None else nullcontext(db) as db:
            db.execute(
                "SELECT pg_advisory_xact_lock(hashtextextended(%s,0))",
                (json.dumps([session_id, kind, client_id]),),
            )
            row = db.execute(
                "SELECT id,request_hash FROM jobs WHERE session_id=%s AND kind=%s AND client_id=%s",
                (session_id, kind, client_id),
            ).fetchone()
            if row:
                if row["request_hash"] != request_hash:
                    raise ServiceError("REQUEST_CONFLICT", "같은 요청 ID의 내용이 다릅니다.", 409)
                return row["id"], False
            job_id = str(uuid4())
            payload = {
                "job_id": job_id,
                "status": "queued",
                "stage": "validating",
                "progress": None,
                "cache": {},
                "result": None,
                "error": None,
                "created_at": now(),
                "updated_at": now(),
            }
            db.execute(
                "INSERT INTO jobs VALUES (%s,%s,%s,%s,%s,%s)",
                (job_id, session_id, kind, client_id, request_hash, json.dumps(payload)),
            )
        return job_id, True

    def job(self, job_id, session_id):
        with self.connect() as db:
            row = db.execute(
                """SELECT j.payload,q.job_id AS queued_job, CASE WHEN q.job_id IS NOT NULL AND q.claimed_by IS NULL
                    THEN (SELECT count(*) FROM job_queue p WHERE p.claimed_by IS NULL
                        AND (p.created_at,p.job_id) <= (q.created_at,q.job_id)) END AS queue_position
                    FROM jobs j LEFT JOIN job_queue q ON q.job_id=j.id
                    WHERE j.id=%s AND j.session_id=%s""", (job_id, session_id)
            ).fetchone()
        if not row:
            raise ServiceError("RESOURCE_NOT_FOUND", "작업을 찾을 수 없습니다.", 404)
        payload = json.loads(row["payload"])
        if row["queued_job"] and payload["status"] in {"completed", "failed", "interrupted"}:
            payload.update(status="running", stage="saving")
        return {**payload, "queue_position": row["queue_position"]}

    def update_job(self, job_id, *, db=None, **fields):
        with self.connect() if db is None else nullcontext(db) as db:
            claim = active_job_claim.get()
            if claim and claim[0] == job_id:
                owned = db.execute(
                    """SELECT job_id FROM job_queue WHERE job_id=%s AND claimed_by=%s
                        AND claimed_until>clock_timestamp() FOR UPDATE""", claim,
                ).fetchone()
                if not owned:
                    raise ServiceError("JOB_OWNERSHIP_LOST", "작업 실행 권한이 만료되었습니다.", 409, True)
            row = db.execute(
                "SELECT payload FROM jobs WHERE id=%s FOR UPDATE", (job_id,)
            ).fetchone()
            payload = json.loads(row["payload"])
            payload.update(fields, updated_at=now())
            db.execute(
                "UPDATE jobs SET payload=%s WHERE id=%s",
                (json.dumps(payload, ensure_ascii=False), job_id),
            )

    def recover_jobs(self):
        with self.connect() as db:
            rows = db.execute("""SELECT id,payload FROM jobs j WHERE NOT EXISTS
                (SELECT 1 FROM job_queue q WHERE q.job_id=j.id)
                AND payload::jsonb->>'status' IN ('queued','running')""").fetchall()
            for row in rows:
                payload = json.loads(row["payload"])
                if payload["status"] in ("queued", "running"):
                    payload.update(
                        status="interrupted",
                        updated_at=now(),
                        error=ServiceError(
                            "JOB_INTERRUPTED",
                            "서버가 재시작되었습니다. 새 요청으로 재시도하세요.",
                            retryable=True,
                        ).as_dict(),
                    )
                    db.execute(
                        "UPDATE jobs SET payload=%s WHERE id=%s",
                        (json.dumps(payload, ensure_ascii=False), row["id"]),
                    )

    def teams(self, session_id):
        with self.connect() as db:
            rows = db.execute(
                "SELECT * FROM teams WHERE session_id=%s ORDER BY updated_at DESC", (session_id,)
            ).fetchall()
        return {"items": [self.team_data(row) for row in rows], "total": len(rows)}

    @staticmethod
    def team_data(row):
        return {
            "team_id": row["id"],
            "name": row["name"],
            "members": json.loads(row["members"]),
            "updated_at": row["updated_at"],
        }

    def team(self, session_id, team_id):
        with self.connect() as db:
            row = db.execute(
                "SELECT * FROM teams WHERE id=%s AND session_id=%s", (team_id, session_id)
            ).fetchone()
        if not row:
            raise ServiceError("RESOURCE_NOT_FOUND", "팀을 찾을 수 없습니다.", 404)
        return self.team_data(row)

    def save_team(self, session_id, body, team_id=None):
        if team_id:
            self.team(session_id, team_id)
        else:
            team_id = str(uuid4())
        with self.connect() as db:
            db.execute(
                "INSERT INTO teams VALUES (%s,%s,%s,%s,%s) ON CONFLICT(id) DO UPDATE SET name=excluded.name,members=excluded.members,updated_at=excluded.updated_at WHERE teams.session_id=excluded.session_id",
                (
                    team_id,
                    session_id,
                    body.name,
                    json.dumps([m.model_dump() for m in body.members], ensure_ascii=False),
                    now(),
                ),
            )
        return self.team(session_id, team_id)

    def delete_team(self, session_id, team_id):
        self.team(session_id, team_id)
        with self.connect() as db:
            db.execute("DELETE FROM teams WHERE id=%s AND session_id=%s", (team_id, session_id))
