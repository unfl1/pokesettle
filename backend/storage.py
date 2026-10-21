import hashlib
import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

from backend.errors import ServiceError


def now():
    return datetime.now(timezone.utc).isoformat()


def digest(value):
    return hashlib.sha256(
        json.dumps(value, ensure_ascii=False, sort_keys=True, default=str).encode()
    ).hexdigest()


class Store:
    def __init__(self, path: Path):
        path.parent.mkdir(parents=True, exist_ok=True)
        self.path = path
        with self.connect() as db:
            db.executescript("""
                PRAGMA journal_mode=WAL;
                CREATE TABLE IF NOT EXISTS cache (namespace TEXT, key TEXT, value TEXT NOT NULL, PRIMARY KEY(namespace,key));
                CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, expires_at TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS conversations (id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id), pokemon_id TEXT NOT NULL, regulation_id TEXT);
                CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id), role TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id), kind TEXT NOT NULL, client_id TEXT NOT NULL, request_hash TEXT NOT NULL, payload TEXT NOT NULL, UNIQUE(session_id,kind,client_id));
            """)

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=30)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys=ON")
        try:
            with db:
                yield db
        finally:
            db.close()

    def get(self, namespace, key):
        with self.connect() as db:
            row = db.execute(
                "SELECT value FROM cache WHERE namespace=? AND key=?", (namespace, key)
            ).fetchone()
        return json.loads(row[0]) if row else None

    def put(self, namespace, key, value):
        with self.connect() as db:
            db.execute(
                "INSERT OR REPLACE INTO cache VALUES (?,?,?)",
                (namespace, key, json.dumps(value, ensure_ascii=False)),
            )

    def session_valid(self, session_id):
        if not session_id:
            return False
        with self.connect() as db:
            return (
                db.execute(
                    "SELECT 1 FROM sessions WHERE id=? AND expires_at>?", (session_id, now())
                ).fetchone()
                is not None
            )

    def new_session(self):
        session_id = str(uuid4())
        expires = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
        with self.connect() as db:
            db.execute("INSERT INTO sessions VALUES (?,?)", (session_id, expires))
        return session_id

    def conversation(self, session_id, pokemon_id, regulation_id, conversation_id=None):
        with self.connect() as db:
            if conversation_id:
                row = db.execute(
                    "SELECT * FROM conversations WHERE id=? AND session_id=?",
                    (conversation_id, session_id),
                ).fetchone()
                if not row:
                    raise ServiceError("RESOURCE_NOT_FOUND", "대화를 찾을 수 없습니다.", 404)
                if row["pokemon_id"] != pokemon_id or row["regulation_id"] != regulation_id:
                    raise ServiceError(
                        "CONVERSATION_SCOPE_MISMATCH", "항목·규칙별로 새 대화가 필요합니다.", 409
                    )
                return conversation_id
            conversation_id = str(uuid4())
            db.execute(
                "INSERT INTO conversations VALUES (?,?,?,?)",
                (conversation_id, session_id, pokemon_id, regulation_id),
            )
        return conversation_id

    def save_exchange(self, conversation_id, question, answer):
        ids = [str(uuid4()), str(uuid4())]
        with self.connect() as db:
            for mid, role, content in zip(ids, ["user", "assistant"], [question, answer]):
                db.execute(
                    "INSERT INTO messages VALUES (?,?,?,?,?)",
                    (mid, conversation_id, role, json.dumps(content, ensure_ascii=False), now()),
                )
        return ids

    def conversations(self, session_id, pokemon_id, limit=20, offset=0):
        with self.connect() as db:
            total = db.execute(
                "SELECT COUNT(*) FROM conversations WHERE session_id=? AND pokemon_id=?",
                (session_id, pokemon_id),
            ).fetchone()[0]
            rows = db.execute(
                """SELECT c.*, COALESCE(MAX(m.created_at),'') AS updated_at,
                (SELECT content FROM messages WHERE conversation_id=c.id AND role='user' ORDER BY rowid LIMIT 1) AS first_question,
                COUNT(m.id) AS message_count
                FROM conversations c LEFT JOIN messages m ON m.conversation_id=c.id
                WHERE c.session_id=? AND c.pokemon_id=? GROUP BY c.id
                ORDER BY c.rowid DESC LIMIT ? OFFSET ?""",
                (session_id, pokemon_id, limit, offset),
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

    def messages(self, session_id, conversation_id, limit=50, offset=0):
        with self.connect() as db:
            owner = db.execute(
                "SELECT * FROM conversations WHERE id=? AND session_id=?",
                (conversation_id, session_id),
            ).fetchone()
            if not owner:
                raise ServiceError("RESOURCE_NOT_FOUND", "대화를 찾을 수 없습니다.", 404)
            total = db.execute(
                "SELECT COUNT(*) FROM messages WHERE conversation_id=?", (conversation_id,)
            ).fetchone()[0]
            rows = db.execute(
                "SELECT * FROM messages WHERE conversation_id=? ORDER BY rowid LIMIT ? OFFSET ?",
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
                "SELECT role,content FROM messages WHERE conversation_id=? ORDER BY rowid DESC LIMIT 12",
                (conversation_id,),
            ).fetchall()
        return [
            {"role": row["role"], "content": json.loads(row["content"])} for row in reversed(rows)
        ]

    def create_job(self, session_id, kind, client_id, request):
        request_hash = digest(request)
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            row = db.execute(
                "SELECT id,request_hash FROM jobs WHERE session_id=? AND kind=? AND client_id=?",
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
                "INSERT INTO jobs VALUES (?,?,?,?,?,?)",
                (job_id, session_id, kind, client_id, request_hash, json.dumps(payload)),
            )
        return job_id, True

    def job(self, job_id, session_id):
        with self.connect() as db:
            row = db.execute(
                "SELECT payload FROM jobs WHERE id=? AND session_id=?", (job_id, session_id)
            ).fetchone()
        if not row:
            raise ServiceError("RESOURCE_NOT_FOUND", "작업을 찾을 수 없습니다.", 404)
        return json.loads(row[0])

    def update_job(self, job_id, **fields):
        with self.connect() as db:
            row = db.execute("SELECT payload FROM jobs WHERE id=?", (job_id,)).fetchone()
            payload = json.loads(row[0])
            payload.update(fields, updated_at=now())
            db.execute(
                "UPDATE jobs SET payload=? WHERE id=?",
                (json.dumps(payload, ensure_ascii=False), job_id),
            )

    def recover_jobs(self):
        with self.connect() as db:
            rows = db.execute("SELECT id,payload FROM jobs").fetchall()
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
                        "UPDATE jobs SET payload=? WHERE id=?",
                        (json.dumps(payload, ensure_ascii=False), row["id"]),
                    )
