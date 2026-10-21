"""Read a legacy SQLite snapshot into an empty PostgreSQL schema; never modify the source."""

import argparse
import json
import sqlite3
from pathlib import Path

from psycopg import sql

from backend.app.core.config import Settings
from backend.app.storage import Store

TABLE_COLUMNS = {
    "sessions": ("id", "expires_at"),
    "conversations": ("id", "session_id", "pokemon_id", "regulation_id"),
    "messages": ("id", "conversation_id", "role", "content", "created_at"),
    "jobs": ("id", "session_id", "kind", "client_id", "request_hash", "payload"),
    "teams": ("id", "session_id", "name", "members", "updated_at"),
    "cache": ("namespace", "key", "value"),
}


def migrate(source_path, store):
    source_path = Path(source_path).resolve(strict=True)
    source = sqlite3.connect(f"{source_path.as_uri()}?mode=ro", uri=True)
    counts = {}
    try:
        source.execute("BEGIN")  # One consistent read snapshot, including WAL data.
        with store.connect() as db:
            for table in TABLE_COLUMNS:
                db.execute(sql.SQL("LOCK TABLE {} IN EXCLUSIVE MODE").format(sql.Identifier(table)))
                if db.execute(
                    sql.SQL("SELECT 1 FROM {} LIMIT 1").format(sql.Identifier(table))
                ).fetchone():
                    raise ValueError(
                        "이전 대상 스키마가 비어 있지 않습니다. 별도 DATABASE_SCHEMA를 사용하세요."
                    )
            existing = {
                r[0] for r in source.execute("SELECT name FROM sqlite_master WHERE type='table'")
            }
            missing = set(TABLE_COLUMNS) - {"teams"} - existing
            if missing:
                raise ValueError(
                    "기존 SQLite의 필수 테이블이 누락되었습니다: " + ", ".join(sorted(missing))
                )
            for table, columns in TABLE_COLUMNS.items():
                counts[table] = 0
                if table not in existing:
                    continue
                rows = source.execute(
                    f"SELECT {','.join(columns)} FROM {table} ORDER BY rowid"
                ).fetchall()
                if table == "cache":
                    # Rebuild manifests only after verifying the actual Chroma index.
                    rows = [r for r in rows if r[0] not in {"manifest", "query_complete"}]
                statement = sql.SQL("INSERT INTO {} ({}) VALUES ({})").format(
                    sql.Identifier(table),
                    sql.SQL(",").join(map(sql.Identifier, columns)),
                    sql.SQL(",").join(sql.Placeholder() for _ in columns),
                )
                with db.cursor() as cursor:
                    cursor.executemany(statement, rows)
                counts[table] = len(rows)
    finally:
        source.close()
    return counts


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="기존 state.sqlite3 파일 경로")
    args = parser.parse_args()
    settings = Settings.from_env()
    report = migrate(args.source, Store(settings.database_url, settings.database_schema))
    print(json.dumps({"migrated": report, "reindex_required": True}, ensure_ascii=False))
