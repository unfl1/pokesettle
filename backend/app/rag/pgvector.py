"""PostgreSQL vector collections with exact L2 search and JSONB metadata."""

import json

import numpy as np
from psycopg.types.json import Jsonb


class PgVectorCollection:
    def __init__(self, store, name, embedding_identity):
        self.store, self.name = store, name
        with store.connect() as db:
            db.execute(
                "INSERT INTO vector_collections(name,embedding_identity) VALUES (%s,%s) ON CONFLICT DO NOTHING",
                (name, embedding_identity),
            )
            row = db.execute(
                "SELECT embedding_identity FROM vector_collections WHERE name=%s", (name,)
            ).fetchone()
            if row["embedding_identity"] != embedding_identity:
                raise ValueError(
                    "임베딩 모델이 기존 색인과 다릅니다. 별도 DB 스키마로 전체 재색인하세요."
                )

    @staticmethod
    def _vector(value):
        vector = np.asarray(value, dtype=np.float32)
        if vector.ndim != 1 or not vector.size or not np.isfinite(vector).all():
            raise ValueError("임베딩은 유한한 숫자의 1차원 벡터여야 합니다.")
        return json.dumps(vector.tolist(), allow_nan=False)

    def upsert(self, *, ids, documents, embeddings, metadatas):
        if not len(ids) == len(documents) == len(embeddings) == len(metadatas):
            raise ValueError("색인 입력 건수가 일치하지 않습니다.")
        if not ids:
            return
        encoded = [self._vector(v) for v in embeddings]
        dimensions = {len(v) for v in embeddings}
        if len(dimensions) != 1:
            raise ValueError("임베딩 차원이 일치하지 않습니다.")
        dimension = dimensions.pop()
        with self.store.connect() as db:
            row = db.execute(
                "SELECT dimension FROM vector_collections WHERE name=%s FOR UPDATE", (self.name,)
            ).fetchone()
            if row["dimension"] is not None and row["dimension"] != dimension:
                raise ValueError("기존 색인과 임베딩 차원이 다릅니다.")
            db.execute(
                "UPDATE vector_collections SET dimension=%s WHERE name=%s", (dimension, self.name)
            )
            with db.cursor() as cursor:
                cursor.executemany(
                    """INSERT INTO vector_entries(collection,id,document,embedding,metadata)
                    VALUES (%s,%s,%s,%s::vector,%s)
                    ON CONFLICT(collection,id) DO UPDATE SET document=excluded.document,
                    embedding=excluded.embedding,metadata=excluded.metadata""",
                    [
                        (self.name, i, d, e, Jsonb(m))
                        for i, d, e, m in zip(ids, documents, encoded, metadatas)
                    ],
                )

    def _filter(self, ids=None, where=None):
        clauses, params = ["collection=%s"], [self.name]
        if ids is not None:
            clauses.append("id=ANY(%s)")
            params.append(ids)
        if where:
            for item in where.get("$and", [where]):
                if any(key.startswith("$") for key in item):
                    raise ValueError("지원하지 않는 메타데이터 필터입니다.")
                clauses.append("metadata @> %s")
                params.append(Jsonb(item))
        return " AND ".join(clauses), params

    def count(self):
        with self.store.connect() as db:
            return db.execute(
                "SELECT COUNT(*) AS count FROM vector_entries WHERE collection=%s", (self.name,)
            ).fetchone()["count"]

    def get(self, ids=None, where=None, include=None):
        condition, params = self._filter(ids, where)
        with self.store.connect() as db:
            rows = db.execute(
                f"SELECT id,document,metadata FROM vector_entries WHERE {condition} ORDER BY id",
                params,
            ).fetchall()
        return {
            "ids": [r["id"] for r in rows],
            "documents": [r["document"] for r in rows],
            "metadatas": [r["metadata"] for r in rows],
        }

    def delete(self, *, ids):
        with self.store.connect() as db:
            db.execute(
                "DELETE FROM vector_entries WHERE collection=%s AND id=ANY(%s)", (self.name, ids)
            )

    def query(self, *, query_embeddings, n_results, where=None):
        condition, params = self._filter(where=where)
        result = {"ids": [], "documents": [], "metadatas": []}
        with self.store.connect() as db:
            for vector in query_embeddings:
                rows = db.execute(
                    f"SELECT id,document,metadata FROM vector_entries WHERE {condition} ORDER BY embedding <-> %s::vector, id LIMIT %s",
                    [*params, self._vector(vector), n_results],
                ).fetchall()
                for key, column in (
                    ("ids", "id"),
                    ("documents", "document"),
                    ("metadatas", "metadata"),
                ):
                    result[key].append([r[column] for r in rows])
        return result


def initialize_vectors(store):
    with store.connect() as db:
        db.execute("CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public")
        db.execute("""CREATE TABLE IF NOT EXISTS vector_collections (
            name TEXT PRIMARY KEY, embedding_identity TEXT NOT NULL, dimension INTEGER)""")
        db.execute("""CREATE TABLE IF NOT EXISTS vector_entries (
            collection TEXT REFERENCES vector_collections(name), id TEXT, document TEXT NOT NULL,
            embedding vector NOT NULL, metadata JSONB NOT NULL, PRIMARY KEY(collection,id))""")
        db.execute(
            "CREATE INDEX IF NOT EXISTS vector_metadata ON vector_entries USING gin(metadata)"
        )
