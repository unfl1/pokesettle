from backend.app.catalog import Catalog
from backend.app.core.config import ROOT
from backend.app.data_preparation.strategy import StrategySource
from backend.app.rag.graph import build_graph
from backend.app.services.topics import mentioned_pokemon


def test_strategy_source_is_authored_assumed_and_form_specific():
    catalog = Catalog(ROOT / "data/pokemon.json")
    source = StrategySource(ROOT / "data")
    for pid in ["pokemon:149", "pokemon:3", "pokemon:6"]:
        candidates = source.search("육성", catalog.get(pid))
        assert len(candidates) == 1
        doc = source.fetch_document(candidates[0])
        assert doc.source_type == "curated"
        assert doc.verification_status == "assumed" and doc.game == "generic"
        assert "조건부" in doc.body and "https://pokeapi.co/" in doc.body
    mega = next(p for p in catalog.items.values() if p.species_id == 3 and not p.is_default)
    assert source.search("육성", mega) == []


def test_explicit_mentions_resolve_other_subjects_without_changing_selected():
    catalog = Catalog(ROOT / "data/pokemon.json")
    assert mentioned_pokemon(catalog, "나 지금 이상해꽃이 선봉인데 적이 리자몽이야") == [
        "pokemon:3",
        "pokemon:6",
    ]
    assert mentioned_pokemon(catalog, "망나뇽은 어떻게 키워?") == ["pokemon:149"]
    assert mentioned_pokemon(catalog, "dragonite-like story") == []
    assert mentioned_pokemon(catalog, "모르는 이름") == []


def test_strategy_evidence_reaches_generation_with_assumed_status(setup):
    from backend.app.schemas import Generation

    catalog = Catalog(ROOT / "data/pokemon.json")
    dragonite = catalog.get("pokemon:149")
    # Real project notes indexed with a synthetic test embedding; no live LLM call.
    setup.catalog.items[dragonite.pokemon_id] = dragonite
    setup.vectors.upsert_metadata([dragonite])
    source = StrategySource(ROOT / "data")
    doc = source.fetch_document(source.search("육성", dragonite)[0])
    setup.vectors.index_document(dragonite.pokemon_id, doc)
    from backend.tests.conftest import document

    setup.vectors.index_document(
        dragonite.pokemon_id,
        document("pokeapi:move:349", "TEST ONLY: move mechanics. " * 10, source_type="api"),
    )
    payloads = []

    class Model:
        def invoke(self, purpose, system, payload, schema):
            payloads.append(payload)
            note = next(e for e in payload["evidence"] if e.get("source_type") == "curated")
            return Generation(
                answer_status="partial",
                claims=[
                    {
                        "text": "일반 조건에서 HP가 가득할 때 강화 기회를 검토하는 조건부 분석입니다.",
                        "evidence_ids": [note["evidence_id"]],
                    }
                ],
                assumptions=["실제 HP와 기술 보유 확인 필요"],
                unknowns=["현재 HP와 네 기술을 알려주세요."],
            )

    state = build_graph(setup.vectors, Model()).invoke(
        {
            "pokemon_id": "pokemon:1",
            "context_pokemon_ids": ["pokemon:149"],
            "question": "망나뇽 육성",
        }
    )
    assert payloads[0]["evidence"][0]["pokemon_id"] == "pokemon:1"
    assert any(e.get("pokemon_id") == "pokemon:149" for e in payloads[0]["evidence"])
    assert any(e.get("document_id") == "pokeapi:move:349" for e in payloads[0]["evidence"])
    assert len(payloads[0]["evidence"]) <= setup.settings.top_k
    assert state["result"]["citations"][0]["source_type"] == "curated"
    assert state["result"]["facts"][0]["verification_status"] == "assumed"
    assert state["result"]["answer_status"] == "partial"
