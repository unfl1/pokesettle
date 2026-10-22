import hashlib
import json
import sqlite3
from concurrent.futures import ThreadPoolExecutor

import pytest

from backend.app.core.errors import ServiceError
from backend.app.storage import Store
from backend.scripts.migrate_sqlite import migrate


def test_concurrent_job_requests_are_idempotent(pg_store):
    session = pg_store.new_session()
    with ThreadPoolExecutor(max_workers=6) as executor:
        results = list(
            executor.map(
                lambda _: pg_store.create_job(session, "chat", "same", {"q": "한글"}), range(12)
            )
        )
    assert len({job_id for job_id, _ in results}) == 1
    assert sum(created for _, created in results) == 1
    with pytest.raises(ServiceError) as error:
        pg_store.create_job(session, "chat", "same", {"q": "다른 질문"})
    assert error.value.code == "REQUEST_CONFLICT"
    job_id = results[0][0]
    with ThreadPoolExecutor(max_workers=2) as executor:
        list(
            executor.map(
                lambda field: pg_store.update_job(job_id, **{field: field}), ["stage", "progress"]
            )
        )
    job = pg_store.job(job_id, session)
    assert job["stage"] == "stage" and job["progress"] == "progress"


def legacy_database(path, *, invalid_owner=False):
    with sqlite3.connect(path) as db:
        db.executescript("""
            CREATE TABLE sessions(id TEXT PRIMARY KEY,expires_at TEXT);
            CREATE TABLE conversations(id TEXT PRIMARY KEY,session_id TEXT,pokemon_id TEXT,regulation_id TEXT);
            CREATE TABLE messages(id TEXT,conversation_id TEXT,role TEXT,content TEXT,created_at TEXT);
            CREATE TABLE cache(namespace TEXT,key TEXT,value TEXT);
            CREATE TABLE jobs(id TEXT, session_id TEXT, kind TEXT, client_id TEXT, request_hash TEXT, payload TEXT);
            INSERT INTO sessions VALUES ('s','2099-01-01T00:00:00+00:00');
            INSERT INTO cache VALUES ('http','source','{"body":"cached"}');
            INSERT INTO cache VALUES ('manifest','obsolete','{}');
            INSERT INTO cache VALUES ('query_complete','obsolete','{}');
        """)
        db.execute(
            "INSERT INTO conversations VALUES ('c',?,'pokemon:1',NULL)",
            ("missing" if invalid_owner else "s",),
        )
        # Equal timestamps and reversed lexical IDs must retain insertion order.
        db.executemany(
            "INSERT INTO messages VALUES (?, 'c', 'user', ?, 'same-time')",
            [("z", json.dumps("첫 질문")), ("a", json.dumps("다음 질문"))],
        )


def test_legacy_migration_preserves_order_and_source_and_rejects_overwrite(tmp_path, pg_store):
    path = tmp_path / "legacy.sqlite3"
    legacy_database(path)
    before = hashlib.sha256(path.read_bytes()).hexdigest()
    counts = migrate(path, pg_store)
    assert counts["messages"] == 2 and counts["cache"] == 1
    assert pg_store.session_valid("s")
    assert pg_store.conversations("s", "pokemon:1")["items"][0]["title"] == "첫 질문"
    assert [m["content"] for m in pg_store.messages("s", "c")["items"]] == ["첫 질문", "다음 질문"]
    assert pg_store.get("http", "source") == {"body": "cached"}
    assert pg_store.get("manifest", "obsolete") is None
    assert hashlib.sha256(path.read_bytes()).hexdigest() == before
    with pytest.raises(ValueError, match="비어 있지"):
        migrate(path, pg_store)
    restarted = Store(pg_store.database_url, pg_store.schema)
    assert len(restarted.history("c")) == 2


def test_migration_rolls_back_on_invalid_foreign_key(tmp_path, pg_store):
    import psycopg

    path = tmp_path / "broken.sqlite3"
    legacy_database(path, invalid_owner=True)
    with pytest.raises(psycopg.errors.ForeignKeyViolation):
        migrate(path, pg_store)
    with pg_store.connect() as db:
        assert db.execute("SELECT COUNT(*) AS count FROM sessions").fetchone()["count"] == 0


def test_pgvector_index_and_manifest_survive_restart(setup):
    from backend.app.rag.vector_store import VectorStore
    from backend.tests.conftest import document, embed

    count = setup.vectors.index_document("pokemon:1", document())
    restarted_store = Store(setup.store.database_url, setup.store.schema)
    restarted_vectors = VectorStore(setup.settings, restarted_store, embed, "synthetic-test-32")
    assert restarted_vectors.index_document("pokemon:1", document()) == count
    assert restarted_vectors.docs.count() == count
    assert len(restarted_vectors.retrieve("pokemon:1", "alpha")) > 1
    assert restarted_store.get("manifest", "pokemon:1:subject")["ids"]
    assert not (setup.settings.runtime_dir / "chroma").exists()
    with restarted_store.connect() as db:
        assert (
            db.execute("SELECT to_regclass('vector_entries') AS name").fetchone()["name"]
            is not None
        )


def test_reindex_preserves_migrated_document_revision_over_bundled_snapshot(setup, monkeypatch):
    from backend.app.rag.vector_store import VectorStore
    from backend.scripts import index_data
    from backend.tests.conftest import document, embed

    migrated = document(body="TEST migrated source revision with retained provenance.")
    bundled = document(body="TEST older bundled source revision.")
    setup.vectors.index_document("pokemon:1", migrated)
    directory = setup.settings.data_dir / "documents"
    directory.mkdir()
    (directory / "species.json").write_text(
        json.dumps([{"pokemon_id": "pokemon:1", "document": bundled.model_dump(mode="json")}])
    )
    monkeypatch.setattr(
        index_data,
        "VectorStore",
        lambda settings, store: VectorStore(settings, store, embed, "synthetic-test-32"),
    )
    index_data.index(setup.settings)
    saved = setup.store.get("document", "pokemon:1:subject")
    assert saved["revision_id"] == migrated.revision_id
    assert saved["body"] == migrated.body
    found = setup.vectors.retrieve("pokemon:1", "migrated revision")
    assert any(e["text"] == migrated.body for e in found)
    assert all(e["text"] != bundled.body for e in found)


def test_vector_distance_filter_and_dimension_validation(setup):
    collection = setup.vectors.docs
    collection.upsert(
        ids=["far", "near", "other"],
        documents=["far", "near", "other"],
        embeddings=[[2, 2], [1, 0], [0, 0]],
        metadatas=[{"pokemon_id": "p"}, {"pokemon_id": "p"}, {"pokemon_id": "other"}],
    )
    assert collection.query(query_embeddings=[[0, 0]], n_results=2, where={"pokemon_id": "p"})[
        "ids"
    ] == [["near", "far"]]
    with pytest.raises(ValueError, match="차원"):
        collection.upsert(ids=["bad"], documents=["bad"], embeddings=[[1, 2, 3]], metadatas=[{}])
    with pytest.raises(ValueError, match="유한"):
        collection.upsert(
            ids=["bad"], documents=["bad"], embeddings=[[float("nan"), 1]], metadatas=[{}]
        )
    assert collection.count() == 3


def test_migration_rejects_populated_vector_index(tmp_path, setup):
    path = tmp_path / "legacy.sqlite3"
    legacy_database(path)
    with pytest.raises(ValueError, match="벡터 색인"):
        migrate(path, setup.store)
    with setup.store.connect() as db:
        assert db.execute("SELECT COUNT(*) AS count FROM sessions").fetchone()["count"] == 0
