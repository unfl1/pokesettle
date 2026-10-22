import json

from backend.app.catalog import Catalog, metadata_text
from backend.app.core.config import Settings
from backend.app.rag.vector_store import VectorStore
from backend.app.schemas import Document
from backend.app.storage import Store


def index(settings):
    catalog = Catalog(settings.data_dir / "pokemon.json")
    if len(catalog.items) < 100:
        raise ValueError("100건 이상의 데이터 준비가 필요합니다.")
    store = Store(settings.database_url, settings.database_schema)
    vectors = VectorStore(settings, store)
    records = list(catalog.items.values())
    vectors.upsert_metadata(records)
    before = vectors.meta.count()
    vectors.upsert_metadata(records)
    assert vectors.meta.count() == before == len(records)
    # Snapshot migrated documents before bundled snapshots can replace their cache entries.
    with store.connect() as db:
        cached = db.execute("SELECT key,value FROM cache WHERE namespace='document'").fetchall()
    docs = json.loads((settings.data_dir / "documents" / "species.json").read_text())
    for i, entry in enumerate(docs, 1):
        vectors.index_document(entry["pokemon_id"], Document.model_validate(entry["document"]))
        if i % 10 == 0:
            print(f"문서 색인 {i}/{len(docs)}", flush=True)
    # Rebuild user-collected documents from the migrated source cache as well.
    for row in cached:
        document = Document.model_validate_json(row["value"])
        pokemon_id = row["key"].removesuffix(":" + document.document_id)
        vectors.index_document(pokemon_id, document)
    report = {
        "metadata_count": vectors.meta.count(),
        "document_chunk_count": vectors.docs.count(),
        "metadata_rerun_idempotent": True,
        "sample_metadata_text": metadata_text(records[0]),
        "embedding_model": settings.embedding_model,
    }
    (settings.data_dir / "index_report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    )
    print(
        json.dumps(
            {k: v for k, v in report.items() if k != "sample_metadata_text"}, ensure_ascii=False
        )
    )


if __name__ == "__main__":
    index(Settings.from_env())
