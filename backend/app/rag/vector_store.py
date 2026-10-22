import threading

from langchain_text_splitters import RecursiveCharacterTextSplitter

from backend.app.catalog import metadata_text
from backend.app.core.errors import ServiceError
from backend.app.rag.embeddings import LocalEmbeddings
from backend.app.rag.pgvector import PgVectorCollection, initialize_vectors
from backend.app.storage import digest


class VectorStore:
    def __init__(self, settings, store, embed=None, embedding_identity=None):
        self.settings, self.store = settings, store
        self.lock = threading.RLock()
        if embed is None:
            if settings.embedding_model != "all-MiniLM-L6-v2":
                raise ValueError("지원하는 로컬 임베딩 모델은 all-MiniLM-L6-v2입니다.")
            embed = LocalEmbeddings(settings.runtime_dir / "embedding_model")
        self.embed = embed
        self.embedding_identity = embedding_identity or settings.embedding_model
        initialize_vectors(store)
        self.meta = PgVectorCollection(store, "pokemon_meta", self.embedding_identity)
        self.docs = PgVectorCollection(store, "pokemon_docs", self.embedding_identity)

    def upsert_metadata(self, records):
        with self.lock:
            for start in range(0, len(records), 32):
                batch = records[start : start + 32]
                texts = [metadata_text(p) for p in batch]
                self.meta.upsert(
                    ids=[p.pokemon_id for p in batch],
                    documents=texts,
                    embeddings=self.embed(texts),
                    metadatas=[
                        {
                            "pokemon_id": p.pokemon_id,
                            "title": f"{p.name_ko or p.name_en} 메타데이터",
                            "source_type": "metadata",
                            "document_id": f"{p.pokemon_id}:metadata",
                            "revision_id": digest(text),
                            "source_url": p.source_url,
                            "collected_at": p.collected_at,
                            "game": "generic",
                            "battle_format": "generic",
                            "regulation_id": "unknown",
                            "content_hash": digest(text),
                            "verification_status": "unknown",
                            "licence": "PokéAPI project terms",
                        }
                        for p, text in zip(batch, texts)
                    ],
                )

    def metadata_rank(self, query):
        with self.lock:
            count = self.meta.count()
            if not count:
                raise ServiceError("INDEX_NOT_READY", "메타데이터 색인이 없습니다.", 503)
            result = self.meta.query(query_embeddings=self.embed([query]), n_results=count)
            return {identifier: rank for rank, identifier in enumerate(result["ids"][0])}

    def index_document(self, pokemon_id, document):
        if document.rights_status != "approved":
            raise ServiceError(
                "SOURCE_RIGHTS_PENDING", "이용 조건이 확인되지 않은 문서입니다.", 422
            )
        chunks = RecursiveCharacterTextSplitter(
            chunk_size=self.settings.chunk_size, chunk_overlap=self.settings.chunk_overlap
        ).split_text(document.body)
        version = digest(
            [
                document.revision_id,
                self.settings.chunk_size,
                self.settings.chunk_overlap,
                "recursive-v1",
            ]
        )[:16]
        association = f"{pokemon_id}:{document.document_id}"
        ids = [f"{association}:{version}:{i}" for i in range(len(chunks))]
        with self.lock:
            previous = self.store.get("manifest", association)
            existing = self.docs.get(ids=ids)["ids"] if ids else []
            if previous and previous["version"] == version and set(existing) == set(ids):
                return len(ids)
            metadata = document.model_dump(mode="json", exclude={"body"})
            metadata.update(pokemon_id=pokemon_id, index_version=version)
            for start in range(0, len(chunks), 32):
                texts = chunks[start : start + 32]
                self.docs.upsert(
                    ids=ids[start : start + 32],
                    documents=texts,
                    embeddings=self.embed(texts),
                    metadatas=[
                        {**metadata, "chunk_index": start + i, "content_hash": digest(text)}
                        for i, text in enumerate(texts)
                    ],
                )
            if set(self.docs.get(ids=ids)["ids"]) != set(ids):
                raise ServiceError(
                    "INDEX_INCOMPLETE", "문서 색인이 완료되지 않았습니다.", retryable=True
                )
            self.store.put("document", association, document.model_dump(mode="json"))
            self.store.put(
                "manifest",
                association,
                {
                    "version": version,
                    "ids": ids,
                    "document_id": document.document_id,
                    "pokemon_id": pokemon_id,
                },
            )
            # Remove every stale version, including leftovers from an interrupted run.
            all_ids = self.docs.get(
                where={"$and": [{"pokemon_id": pokemon_id}, {"document_id": document.document_id}]}
            )["ids"]
            stale = list(set(all_ids) - set(ids))
            if stale:
                self.docs.delete(ids=stale)
        return len(ids)

    @staticmethod
    def evidence(eid, text, metadata):
        return {"evidence_id": eid, "text": text, **metadata}

    def retrieve(self, pokemon_id, query, regulation_id=None):
        with self.lock:
            found = self.meta.get(ids=[pokemon_id])
            if not found["ids"]:
                raise ServiceError(
                    "INDEX_NOT_READY", "선택한 포켓몬 메타데이터 색인이 없습니다.", 503
                )
            evidence = [
                self.evidence(found["ids"][0], found["documents"][0], found["metadatas"][0])
            ]
            associated_count = len(
                self.docs.get(where={"pokemon_id": pokemon_id}, include=[])["ids"]
            )
            if associated_count:
                result = self.docs.query(
                    query_embeddings=self.embed([query]),
                    n_results=associated_count,
                    where={"pokemon_id": pokemon_id},
                )
                seen = set()
                for eid, text, meta in zip(
                    result["ids"][0], result["documents"][0], result["metadatas"][0]
                ):
                    manifest = self.store.get("manifest", f"{pokemon_id}:{meta['document_id']}")
                    if not manifest or eid not in manifest["ids"]:
                        continue
                    if regulation_id and (
                        meta["regulation_id"] != regulation_id
                        or meta["game"] != "champions"
                        or meta["battle_format"] != "singles"
                    ):
                        continue
                    content_hash = digest(text)
                    if content_hash in seen:
                        continue
                    seen.add(content_hash)
                    evidence.append(self.evidence(eid, text, meta))
                    if len(evidence) >= self.settings.top_k:
                        break
            for number, item in enumerate(evidence, 1):
                item["number"] = number
            return evidence
