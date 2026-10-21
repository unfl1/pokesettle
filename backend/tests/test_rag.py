from dataclasses import replace

import pytest

from backend.catalog import Catalog, metadata_text
from backend.errors import ServiceError
from backend.models import Generation
from backend.rag.graph import build_graph, render_answer
from backend.rag.vector_store import VectorStore
from backend.tests.conftest import document, embed


def test_100_metadata_and_idempotent_upsert(setup):
    records = list(setup.catalog.items.values())
    assert len(records) == setup.vectors.meta.count() == 100
    original = set(setup.vectors.meta.get()["ids"])
    setup.vectors.upsert_metadata(records)
    assert set(setup.vectors.meta.get()["ids"]) == original
    text = metadata_text(records[0])
    for term in [records[0].name_en, "test-type", "test-ability", "speed=50", "unknown"]:
        assert term in text


def test_duplicate_species_is_rejected(setup):
    import json

    path = setup.settings.data_dir / "bad.json"
    item = next(iter(setup.catalog.items.values())).model_dump()
    path.write_text(json.dumps([item, item]))
    with pytest.raises(ValueError):
        Catalog(path)


def test_subject_forced_and_repeated_question_never_recollects(setup):
    first = setup.service.collect("pokemon:1", "test question")
    assert first["subject_document_status"] == "indexed"
    decisions = first["reports"][0]["decisions"]
    assert next(d for d in decisions if d["candidate_id"] == "subject")["accepted"]
    assert not next(d for d in decisions if d["candidate_id"] == "extra")["accepted"]
    searches, fetches = setup.source.searches, setup.source.fetches
    model_calls = len(setup.model.calls)
    second = setup.service.collect("pokemon:1", "test question")
    assert second["cache"]["query_hits"] == 1
    assert (searches, fetches, model_calls) == (
        setup.source.searches,
        setup.source.fetches,
        len(setup.model.calls),
    )


def test_same_query_new_question_reselects_cached_candidates(setup):
    setup.service.collect("pokemon:1", "first question")
    searches = setup.source.searches
    setup.model.select_extra = True
    result = setup.service.collect("pokemon:1", "different question")
    assert setup.source.searches == searches
    assert any(
        d["candidate_id"] == "extra" and d["accepted"] for d in result["reports"][0]["decisions"]
    )


def test_invalid_candidate_and_missing_subject_are_not_cached_success(setup):
    setup.model.invalid_selection = True
    with pytest.raises(ServiceError, match="없는 문서 ID"):
        setup.service.collect("pokemon:1", "question")
    setup.model.invalid_selection = False
    assert setup.service.collect("pokemon:1", "question")["subject_document_status"] == "indexed"
    setup.source.missing = True
    with pytest.raises(ServiceError) as error:
        setup.service.collect("pokemon:2", "question")
    assert error.value.code == "SUBJECT_DOCUMENT_UNAVAILABLE"


def test_short_subject_document_not_removed(setup):
    setup.source.fetch_document = lambda c: document(c.candidate_id, "a")
    assert setup.service.collect("pokemon:1", "question")["chunk_count"] == 1


def test_chunk_settings_remove_stale_ids_and_preserve_associations(setup):
    doc = document(
        body="\n".join(f"TEST line {n} different content about alpha beta gamma" for n in range(40))
    )
    small = setup.vectors.index_document("pokemon:1", doc)
    setup.vectors.index_document("pokemon:2", doc)
    second_ids = set(setup.vectors.docs.get(where={"pokemon_id": "pokemon:2"})["ids"])
    vectors = VectorStore(
        replace(setup.settings, chunk_size=500, chunk_overlap=50),
        setup.store,
        embed,
        "synthetic-test-32",
    )
    large = vectors.index_document("pokemon:1", doc)
    assert large < small
    assert len(vectors.docs.get(where={"pokemon_id": "pokemon:1"})["ids"]) == large
    assert set(vectors.docs.get(where={"pokemon_id": "pokemon:2"})["ids"]) == second_ids
    before = vectors.docs.count()
    vectors.index_document("pokemon:1", doc)
    assert vectors.docs.count() == before


def test_retrieval_metadata_topk_dedupe_and_format_filters(setup):
    for n in range(8):
        setup.vectors.index_document("pokemon:1", document(f"doc{n}", f"unique TEST text {n}"))
    setup.vectors.index_document("pokemon:1", document("duplicate", "unique TEST text 0"))
    setup.vectors.index_document("pokemon:2", document("wrong-subject", "unique TEST text"))
    found = setup.vectors.retrieve("pokemon:1", "unique")
    assert found[0]["evidence_id"] == "pokemon:1"
    assert len(found) == 6
    assert all(e["pokemon_id"] == "pokemon:1" for e in found)
    assert len({e["text"] for e in found}) == len(found)
    smaller = VectorStore(replace(setup.settings, top_k=2), setup.store, embed, "synthetic-test-32")
    assert len(smaller.retrieve("pokemon:1", "unique")) == 2
    assert len(smaller.retrieve("pokemon:1", "unique", "m_c")) == 1
    with pytest.raises(ServiceError) as error:
        setup.vectors.retrieve("pokemon:999", "unknown")
    assert error.value.code == "INDEX_NOT_READY"


def test_graph_two_nodes_and_citations_only_actually_used(setup):
    setup.vectors.index_document("pokemon:1", document())
    stages = []
    graph = build_graph(setup.vectors, setup.model, stages.append)
    assert set(graph.get_graph().nodes) == {"__start__", "retrieve", "generate", "__end__"}
    output = graph.invoke({"pokemon_id": "pokemon:1", "question": "test"})
    assert len(output["evidence"]) > len(output["result"]["citations"]) == 1
    assert "[근거 1]" in output["result"]["answer"]
    assert output["result"]["citations"][0]["source_type"] == "metadata"
    assert stages == ["retrieving", "generating", "validating_citations"]


def test_unsupported_question_abstains_and_forged_citation_rejected(setup):
    setup.model.abstain = True
    result = build_graph(setup.vectors, setup.model).invoke(
        {"pokemon_id": "pokemon:1", "question": "unsupported damage formula"}
    )["result"]
    assert result["answer_status"] == "abstained"
    assert result["citations"] == [] and result["citation_notice"]
    generation = Generation(
        answer_status="answered",
        claims=[{"text": "fake", "evidence_ids": ["forged"]}],
        assumptions=[],
        unknowns=[],
    )
    with pytest.raises(ServiceError):
        render_answer(generation, setup.vectors.retrieve("pokemon:1", "test"), None)


def test_embedding_identity_mismatch_and_rights_pending(setup):
    with pytest.raises(ValueError, match="임베딩 모델"):
        VectorStore(setup.settings, setup.store, embed, "different-model")
    with pytest.raises(ServiceError) as error:
        setup.vectors.index_document("pokemon:1", document(rights_status="pending"))
    assert error.value.code == "SOURCE_RIGHTS_PENDING"


def test_source_versions_must_exist_in_cited_chunk(setup):
    setup.vectors.index_document(
        "pokemon:1", document(body="Description (en, sword): TEST fact alpha.")
    )
    evidence = setup.vectors.retrieve("pokemon:1", "TEST fact")
    claim = {
        "text": "TEST fact",
        "evidence_ids": [evidence[1]["evidence_id"]],
        "source_versions": ["not-in-this-source"],
    }
    generated = Generation(answer_status="answered", claims=[claim], assumptions=[], unknowns=[])
    with pytest.raises(ServiceError, match="게임 버전"):
        render_answer(generated, evidence, None)
    generated.claims[0].source_versions = ["sword"]
    result = render_answer(generated, evidence, None)
    assert "원문 버전: sword" in result["answer"]


def test_generation_validation_retries_then_abstains_safely(setup):
    from types import SimpleNamespace

    bad = Generation(
        answer_status="answered",
        claims=[{"text": "invalid", "evidence_ids": ["not-in-context"]}],
        assumptions=[],
        unknowns=[],
    )
    calls = []

    def corrected(purpose, system, payload, schema):
        calls.append(purpose)
        return bad if len(calls) == 1 else setup.model.invoke(purpose, system, payload, schema)

    result = build_graph(setup.vectors, SimpleNamespace(invoke=corrected)).invoke(
        {"pokemon_id": "pokemon:1", "question": "test"}
    )["result"]
    assert calls == ["generate", "generate"]
    assert result["answer_status"] == "answered"
    result = build_graph(setup.vectors, SimpleNamespace(invoke=lambda *args: bad)).invoke(
        {"pokemon_id": "pokemon:1", "question": "test"}
    )["result"]
    assert result["answer_status"] == "abstained" and result["citations"] == []
