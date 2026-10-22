import hashlib
import json
import re
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import psycopg
from psycopg import sql
from psycopg.rows import dict_row

from backend.app.core.errors import ServiceError


def now():
    return datetime.now(timezone.utc).isoformat()


def digest(value):
    return hashlib.sha256(
        json.dumps(value, ensure_ascii=False, sort_keys=True, default=str).encode()
    ).hexdigest()


class Store:
    def __init__(self, database_url: str, schema: str = "poketact"):
        if not re.fullmatch(r"[a-z_][a-z0-9_]{0,62}", schema):
            raise ValueError("DATABASE_SCHEMA는 소문자 영문·숫자·밑줄만 사용해야 합니다.")
        if not database_url:
            raise ValueError("DATABASE_URL 설정이 필요합니다.")
        self.database_url, self.schema = database_url, schema
        with psycopg.connect(database_url, connect_timeout=10) as db:
            db.execute(sql.SQL("CREATE SCHEMA IF NOT EXISTS {}").format(sql.Identifier(schema)))
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
            ):
                db.execute(statement)

    @contextmanager
    def connect(self):
        with psycopg.connect(self.database_url, connect_timeout=10, row_factory=dict_row) as db:
            db.execute(
                sql.SQL("SET LOCAL search_path TO {}, public").format(sql.Identifier(self.schema))
            )
            yield db

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
                if row["pokemon_id"] != pokemon_id or row["regulation_id"] != regulation_id:
                    raise ServiceError(
                        "CONVERSATION_SCOPE_MISMATCH", "항목·규칙별로 새 대화가 필요합니다.", 409
                    )
                return conversation_id
            conversation_id = str(uuid4())
            db.execute(
                "INSERT INTO conversations (id,session_id,pokemon_id,regulation_id) VALUES (%s,%s,%s,%s)",
                (conversation_id, session_id, pokemon_id, regulation_id),
            )
        return conversation_id

    def save_exchange(self, conversation_id, question, answer):
        ids = [str(uuid4()), str(uuid4())]
        with self.connect() as db:
            for mid, role, content in zip(ids, ["user", "assistant"], [question, answer]):
                db.execute(
                    "INSERT INTO messages (id,conversation_id,role,content,created_at) VALUES (%s,%s,%s,%s,%s)",
                    (mid, conversation_id, role, json.dumps(content, ensure_ascii=False), now()),
                )
        return ids

    def conversations(self, session_id, pokemon_id, limit=20, offset=0):
        with self.connect() as db:
            total = db.execute(
                "SELECT COUNT(*) AS total FROM conversations WHERE session_id=%s AND pokemon_id=%s",
                (session_id, pokemon_id),
            ).fetchone()["total"]
            rows = db.execute(
                """SELECT c.*, COALESCE(MAX(m.created_at),'') AS updated_at,
                (SELECT content FROM messages WHERE conversation_id=c.id AND role='user' ORDER BY seq LIMIT 1) AS first_question,
                COUNT(m.id) AS message_count
                FROM conversations c LEFT JOIN messages m ON m.conversation_id=c.id
                WHERE c.session_id=%s AND c.pokemon_id=%s GROUP BY c.id
                ORDER BY c.seq DESC LIMIT %s OFFSET %s""",
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

    def create_job(self, session_id, kind, client_id, request):
        request_hash = digest(request)
        with self.connect() as db:
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
                "SELECT payload FROM jobs WHERE id=%s AND session_id=%s", (job_id, session_id)
            ).fetchone()
        if not row:
            raise ServiceError("RESOURCE_NOT_FOUND", "작업을 찾을 수 없습니다.", 404)
        return json.loads(row["payload"])

    def update_job(self, job_id, **fields):
        with self.connect() as db:
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
