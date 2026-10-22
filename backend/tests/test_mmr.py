import json
from dataclasses import replace
from uuid import uuid4

import numpy as np
import pytest
from fastapi.testclient import TestClient

from backend.app.core.config import Settings
from backend.app.main import create_app
from backend.app.rag.vector_store import VectorStore
from backend.tests.conftest import document


def controlled_embed(texts):
    values = {
        "TEST focused A": [1.0, 0.0],
        "TEST focused B": [0.9998, 0.02],
        "TEST diverse C": [0.2, 0.98],
    }
    result = []
    for text in texts:
        vector = np.asarray(values.get(text, [1.0, 0.0]) + [0.0] * 30)
        result.append((vector / np.linalg.norm(vector)).tolist())
    return result


def make_vectors(setup, **changes):
    settings = replace(
        setup.settings, search_mode="mmr", top_k=3, mmr_fetch_k=5, mmr_lambda_mult=0.2, **changes
    )
    return VectorStore(settings, setup.store, controlled_embed, "synthetic-test-32")


def seed(vectors, **scope):
    for identifier, text in [
        ("a", "TEST focused A"),
        ("b", "TEST focused B"),
        ("c", "TEST diverse C"),
    ]:
        vectors.index_document("pokemon:1", document(identifier, text, **scope))


def test_mmr_reduces_near_duplicate_selection_without_replacing_metadata(setup):
    vectors = make_vectors(setup)
    seed(vectors)
    mmr = vectors.retrieve("pokemon:1", "query")
    similarity = VectorStore(
        replace(vectors.settings, search_mode="similarity"),
        setup.store,
        controlled_embed,
        "synthetic-test-32",
    ).retrieve("pokemon:1", "query")
    assert [e["document_id"] for e in similarity[1:]] == ["a", "b"]
    assert [e["document_id"] for e in mmr[1:]] == ["a", "c"]
    assert mmr[0]["evidence_id"] == "pokemon:1"
    assert [e["number"] for e in mmr] == [1, 2, 3]
    assert all("embedding" not in e for e in mmr)


@pytest.mark.parametrize("weight,expected", [(0.0, ["a", "c"]), (1.0, ["a", "b"])])
def test_lambda_endpoints_are_deterministic(setup, weight, expected):
    vectors = make_vectors(setup)
    seed(vectors)
    vectors = VectorStore(
        replace(vectors.settings, mmr_lambda_mult=weight),
        setup.store,
        controlled_embed,
        "synthetic-test-32",
    )
    assert [e["document_id"] for e in vectors.retrieve("pokemon:1", "query")[1:]] == expected
    assert vectors.retrieve("pokemon:1", "query") == vectors.retrieve("pokemon:1", "query")


def test_filtering_and_exact_deduplication_precede_mmr_pool_limit(setup):
    vectors = make_vectors(setup)
    vectors = VectorStore(
        replace(vectors.settings, mmr_fetch_k=2), setup.store, controlled_embed, "synthetic-test-32"
    )
    scope = {"game": "champions", "battle_format": "singles", "regulation_id": "m_c"}
    vectors.index_document("pokemon:1", document("generic", "TEST focused A"))
    vectors.index_document("pokemon:2", document("other-pokemon", "TEST focused A", **scope))
    vectors.index_document("pokemon:1", document("a", "TEST focused A", **scope))
    vectors.index_document("pokemon:1", document("duplicate", "TEST focused A", **scope))
    vectors.index_document("pokemon:1", document("c", "TEST diverse C", **scope))
    vectors.docs.upsert(
        ids=["stale"],
        documents=["TEST focused A"],
        embeddings=controlled_embed(["TEST focused A"]),
        metadatas=[{"pokemon_id": "pokemon:1", "document_id": "missing", **scope}],
    )
    found = vectors.retrieve("pokemon:1", "query", "m_c")
    assert len(found) == 3
    assert {e["text"] for e in found[1:]} == {"TEST focused A", "TEST diverse C"}
    assert all(e["pokemon_id"] == "pokemon:1" for e in found)
    assert all(e["evidence_id"] != "stale" for e in found)


def test_empty_or_short_mmr_pool_preserves_metadata(setup):
    vectors = make_vectors(setup)
    assert len(vectors.retrieve("pokemon:1", "query")) == 1
    vectors.index_document("pokemon:1", document("a", "TEST focused A"))
    assert len(vectors.retrieve("pokemon:1", "query")) == 2
    assert len(vectors.retrieve("pokemon:1", "query", "no-matching-regulation")) == 1


@pytest.mark.parametrize(
    "values",
    [
        {"search_mode": "unknown"},
        {"mmr_fetch_k": 4},
        {"mmr_fetch_k": 201},
        {"mmr_lambda_mult": -0.1},
        {"mmr_lambda_mult": 1.1},
        {"mmr_lambda_mult": float("nan")},
    ],
)
def test_invalid_mmr_configuration_is_rejected(values):
    with pytest.raises(ValueError):
        Settings(**values)


def test_mmr_environment_settings(monkeypatch):
    monkeypatch.setenv("SEARCH_MODE", "mmr")
    monkeypatch.setenv("MMR_FETCH_K", "40")
    monkeypatch.setenv("MMR_LAMBDA_MULT", "0.3")
    settings = Settings.from_env()
    assert (settings.search_mode, settings.mmr_fetch_k, settings.mmr_lambda_mult) == (
        "mmr",
        40,
        0.3,
    )


def test_status_and_saved_answer_record_actual_retrieval_configuration(setup):
    vectors = make_vectors(setup)
    setup.service.vectors = vectors
    with TestClient(create_app(vectors.settings, service=setup.service)) as client:
        status = client.get("/api/status").json()["data"]
        assert status["retrieval"]["searchMode"] == "mmr"
        client.post("/api/session")
        response = client.post(
            "/api/chat",
            json={
                "pokemonId": "pokemon:1",
                "question": "TEST fact",
                "clientRequestId": str(uuid4()),
            },
        )
        assert response.status_code == 202
        job = client.get(response.json()["data"]["statusUrl"]).json()["data"]
        assert job["status"] == "completed"
        result = job["result"]
        assert result["retrieval"] == status["retrieval"]
        history = client.get(f"/api/conversations/{result['conversationId']}/messages").json()[
            "data"
        ]
        assert history["items"][-1]["content"]["retrieval"] == status["retrieval"]
        assert "embeddings" not in json.dumps(result)


def test_comparison_reports_selection_change_without_claiming_answer_accuracy(setup):
    from backend.scripts.compare_retrieval import compare

    vectors = make_vectors(setup)
    seed(vectors)
    report = compare(
        vectors,
        [{"pokemon_id": "pokemon:1", "query": "query", "expected_terms": ["focused", "diverse"]}],
    )
    assert report["selection_changed_cases"] == 1
    row = report["cases"][0]
    assert (
        row["modes"]["similarity"]["mean_pairwise_cosine"]
        > row["modes"]["mmr"]["mean_pairwise_cosine"]
    )
    assert (
        row["modes"]["similarity"]["evidence_ids"][0]
        == row["modes"]["mmr"]["evidence_ids"][0]
        == "pokemon:1"
    )
    assert row["modes"]["similarity"]["expected_term_coverage"] == 0.5
    assert row["modes"]["mmr"]["expected_term_coverage"] == 1.0
    assert report["limitations"] and "factual accuracy" in report["limitations"][0]


def test_comparison_rejects_index_changed_during_measurement(setup, monkeypatch):
    from backend.scripts.compare_retrieval import compare

    vectors = make_vectors(setup)
    seed(vectors)
    original = VectorStore.retrieve
    calls = []

    def changing_index(engine, *args, **kwargs):
        result = original(engine, *args, **kwargs)
        calls.append(1)
        if len(calls) == 1:
            vectors.index_document(
                "pokemon:1", document("changed", "TEST updated source during comparison")
            )
        return result

    monkeypatch.setattr(VectorStore, "retrieve", changing_index)
    with pytest.raises(ValueError, match="색인이 변경"):
        compare(vectors, [{"pokemon_id": "pokemon:1", "query": "query"}])
