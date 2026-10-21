"""Record reproducible real-data checks; --live explicitly calls the configured model."""

import argparse
import json
import tempfile
import time
from dataclasses import replace
from pathlib import Path
from uuid import uuid4

from fastapi.testclient import TestClient

from backend.app.core.config import ROOT, Settings
from backend.app.main import create_app
from backend.app.rag.graph import build_graph
from backend.app.rag.vector_store import VectorStore
from backend.app.schemas import Document
from backend.app.storage import now


def verify(live=False):
    settings = Settings.from_env()
    app = create_app(settings)
    service = app.state.service
    vectors = service.vectors
    records = list(service.catalog.items.values())
    documents = json.loads((settings.data_dir / "documents" / "species.json").read_text())
    assert len(records) >= 100
    assert len({p.pokemon_id for p in records}) == len(records)
    assert len({p.species_id for p in records if p.is_default}) == sum(
        p.is_default for p in records
    )
    before = {"meta": vectors.meta.count(), "docs": vectors.docs.count()}
    vectors.upsert_metadata(records)
    for entry in documents:
        vectors.index_document(entry["pokemon_id"], Document.model_validate(entry["document"]))
    after = {"meta": vectors.meta.count(), "docs": vectors.docs.count()}
    # A source revision may legitimately replace old chunks on the first pass.
    # Idempotency means a second pass of the same snapshot remains unchanged.
    vectors.upsert_metadata(records)
    for entry in documents:
        vectors.index_document(entry["pokemon_id"], Document.model_validate(entry["document"]))
    assert after == {"meta": vectors.meta.count(), "docs": vectors.docs.count()}
    assert after["meta"] == len(records)
    question = "피카츄의 타입과 특성 이름을 알려줘"
    started = time.monotonic()
    found = vectors.retrieve("pokemon:25", "Pikachu electric abilities")
    retrieval_seconds = round(time.monotonic() - started, 3)
    smaller = VectorStore(replace(settings, top_k=2), service.store)
    found_small = smaller.retrieve("pokemon:25", "Pikachu electric abilities")
    assert found[0]["evidence_id"] == "pokemon:25"
    assert len(found_small) <= 2 < len(found)
    sample_document = Document.model_validate(documents[0]["document"])
    with tempfile.TemporaryDirectory(prefix="poketact-verify-") as directory:
        isolated = replace(settings, runtime_dir=Path(directory))
        isolated_store = type(service.store)(isolated.runtime_dir / "state.sqlite3")
        local = VectorStore(isolated, isolated_store, vectors.embed)
        default_count = local.index_document("pokemon:1", sample_document)
        changed = VectorStore(
            replace(isolated, chunk_size=500, chunk_overlap=100), isolated_store, vectors.embed
        )
        changed_count = changed.index_document("pokemon:1", sample_document)
        assert default_count != changed_count
        assert changed.docs.count() == changed_count
    graph = build_graph(vectors, service.model)
    report = {
        "verified_at": now(),
        "data_mode": "real PokéAPI data",
        "embedding": settings.embedding_model,
        "metadata_count": len(records),
        "unique_species": len({p.species_id for p in records}),
        "subject_document_count": len(documents),
        "before_rerun": before,
        "after_rerun": after,
        "chunk_comparison": {
            "1000_200": default_count,
            "500_100": changed_count,
            "stale_removed": True,
        },
        "retrieval_seconds": retrieval_seconds,
        "top_k_comparison": {
            "6": [e["evidence_id"] for e in found],
            "2": [e["evidence_id"] for e in found_small],
        },
        "graph_mermaid": graph.get_graph().draw_mermaid(),
        "sample_evidence": found,
        "live_model": {"executed": False},
    }
    with TestClient(app) as client:
        report["status"] = client.get("/api/status").json()["data"]
        assert report["status"]["metadataCount"] == len(records)
        client.post("/api/session")
        if live:
            assert settings.model_configured, "모델 키·모델 ID 설정 필요"
            # Metadata citation, external-document citation, and unsupported question.
            # This is NOT F2015's RAG/no-RAG comparison.
            results = []
            for text in [
                question,
                "피카츄의 볼(cheek)과 꼬리(tail)에 대한 도감 설명을 원래 게임 버전과 함께 알려줘. Champions 전용 정보로 해석하지 마.",
                "Pokémon Champions M-C에서 피카츄의 정확한 경기 승률은 몇 퍼센트입니까? 이 자료에 근거가 없으면 확인되지 않는다고 답해 주세요.",
            ]:
                started = time.monotonic()
                response = client.post(
                    "/api/chat",
                    json={
                        "pokemonId": "pokemon:25",
                        "question": text,
                        "clientRequestId": str(uuid4()),
                    },
                )
                assert response.status_code == 202, response.json()
                job = client.get(response.json()["data"]["statusUrl"]).json()["data"]
                assert job["status"] == "completed", job.get("error")
                results.append(
                    {
                        "question": text,
                        "elapsed_seconds": round(time.monotonic() - started, 3),
                        "result": job["result"],
                    }
                )
            assert results[0]["result"]["answerStatus"] in {"answered", "partial"}
            assert results[0]["result"]["citations"]
            assert any(c["sourceType"] != "metadata" for c in results[1]["result"]["citations"])
            assert results[-1]["result"]["answerStatus"] == "abstained"
            assert not results[-1]["result"]["citations"]
            repeated = service.collect("pokemon:25", question)
            assert repeated["cache"]["network_calls"] == 0
            report["live_model"] = {
                "executed": True,
                "provider": "configured OpenAI-compatible endpoint",
                "model": settings.chat_model,
                "cases": results,
                "repeated_collection": repeated,
            }
    report["final_counts"] = {"meta": vectors.meta.count(), "docs": vectors.docs.count()}
    output = (
        ROOT
        / "docs"
        / "evidence"
        / ("phase1.json" if len(records) == 100 else "phase1-catalog.json")
    )
    output.parent.mkdir(exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(
        json.dumps(
            {
                "metadata": len(records),
                "docs": after["docs"],
                "chunk_comparison": report["chunk_comparison"],
                "live_model_executed": live,
                "evidence_path": str(output),
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--live", action="store_true")
    verify(parser.parse_args().live)
