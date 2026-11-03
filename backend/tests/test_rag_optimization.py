from dataclasses import replace
from types import SimpleNamespace

import pytest

from backend.app.rag.graph import build_graph
from backend.app.rag.vector_store import VectorStore
from backend.tests.conftest import document, embed


@pytest.mark.parametrize("legacy_metadata", [False, True])
@pytest.mark.parametrize("mode", ["similarity", "mmr"])
def test_incidental_species_do_not_fill_pool_before_selected_form_species(setup, mode, legacy_metadata):
    # Form ID intentionally differs from its shared species ID.
    form = setup.catalog.get("pokemon:1").model_copy(update={"species_id": 6})
    setup.vectors.upsert_metadata([form])
    if legacy_metadata:
        meta = setup.vectors.meta.get(ids=[form.pokemon_id])
        old = dict(meta["metadatas"][0])
        old.pop("species_id")
        setup.vectors.meta.upsert(ids=meta["ids"], documents=meta["documents"],
                                  embeddings=embed(meta["documents"]), metadatas=[old])
    for number, text in [(25, "TEST ONLY: query query"), (6, "TEST ONLY: tail monitoring. " * 10)]:
        setup.vectors.index_document(form.pokemon_id, document(f"pokeapi:pokemon-species:{number}", text))
    settings = replace(setup.settings, top_k=2, mmr_fetch_k=2, search_mode=mode)
    vectors = VectorStore(settings, setup.store, embed, "synthetic-test-32")
    evidence = vectors.retrieve(form.pokemon_id, "query")
    assert evidence[0]["pokemon_id"] == form.pokemon_id
    assert evidence[1]["document_id"] == "pokeapi:pokemon-species:6"
    assert len(evidence) == 2


def test_aliases_restore_storage_ids_and_retry_rejects_storage_id_as_model_citation(setup):
    calls = []

    def invoke(purpose, prompt, payload, schema):
        calls.append(payload.copy())
        assert payload["evidence"][0]["evidence_id"] == "E1"
        assert set(payload["allowed_versions_by_evidence"]) == {"E1"}
        return schema(answer_status="answered", claims=[{
            "text": "테스트 근거 설명",
            "evidence_ids": ["pokemon:1" if len(calls) == 1 else "E1"],
        }], assumptions=[], unknowns=[])

    result = build_graph(setup.vectors, SimpleNamespace(invoke=invoke)).invoke({
        "pokemon_id": "pokemon:1", "question": "설명",
    })["result"]
    assert len(calls) == 2
    assert calls[1]["previous_invalid_output"]["claims"][0]["evidence_ids"] == ["pokemon:1"]
    assert result["facts"][0]["evidence_ids"] == ["pokemon:1"]
    assert result["citations"][0]["evidence_id"] == "pokemon:1"


def test_version_validation_retries_with_model_aliases_and_preserves_source_metadata(setup):
    setup.vectors.index_document("pokemon:1", document(
        "pokeapi:pokemon-species:1", "Description (en, yellow): TEST ONLY: tail monitoring.",
    ))
    calls = []

    def invoke(purpose, prompt, payload, schema):
        calls.append(payload.copy())
        item = next(e for e in payload["evidence"] if "Description" in e["text"])
        if len(calls) == 2:
            assert payload["previous_invalid_output"]["claims"][0]["evidence_ids"] == [item["evidence_id"]]
        return schema(answer_status="answered", claims=[{
            "text": "테스트 꼬리 설명", "evidence_ids": [item["evidence_id"]],
            "source_versions": ["invented" if len(calls) == 1 else "yellow"],
        }], assumptions=[], unknowns=[])

    result = build_graph(setup.vectors, SimpleNamespace(invoke=invoke)).invoke({
        "pokemon_id": "pokemon:1", "question": "tail",
    })["result"]
    assert len(calls) == 2
    assert result["citations"][0]["source_url"] == "https://pokeapi.co/api/v2/pokemon-species/1/"
    assert result["citations"][0]["evidence_id"].startswith("pokemon:1:pokeapi:pokemon-species:1:")
    assert "원문 버전: yellow" in result["answer"]


def test_query_planner_omits_storage_metadata_but_preserves_resource_fields(setup):
    setup.service.collect("pokemon:1", "test ability effects")
    payload = next(payload for purpose, payload in setup.model.calls if purpose == "queries")
    pokemon = payload["pokemon"]
    assert not {"images", "field_provenance", "source_url", "collected_at", "names", "slugs"} & pokemon.keys()
    assert pokemon["abilities"] == ["test-ability"]
    assert pokemon["types"] == ["test-type"]
    assert pokemon["species_id"] == 1
