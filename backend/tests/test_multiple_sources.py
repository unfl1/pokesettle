from dataclasses import replace
from types import SimpleNamespace

import pytest

from backend.app.core.config import Settings
from backend.app.core.errors import ServiceError
from backend.app.data_preparation.pokeapi import PokeApiSource
from backend.app.data_preparation.sources import CombinedSource, build_source
from backend.app.data_preparation.wikipedia import WikipediaSource
from backend.app.http_client import SourceClient
from backend.app.rag.graph import render_answer
from backend.app.schemas import Generation, Selection
from backend.app.services.knowledge import KnowledgeService


def summary(**changes):
    # Entirely synthetic text and revision; never a claimed live Wikipedia snapshot.
    return {
        "title": "Pikachu",
        "type": "standard",
        "wikibase_item": "Q9351",
        "lang": "en",
        "revision": "123",
        "extract": "TEST ONLY: a fictional specimen in a fictional franchise.",
        **changes,
    }


def client_for(data):
    calls = []

    def fetch(url):
        calls.append(url)
        return {"body": data, "collected_at": "2026-10-22T00:00:00+00:00"}

    return SimpleNamespace(fetch=fetch, calls=calls)


def test_mapped_candidates_do_not_fetch_body_and_do_not_guess_other_species():
    client = client_for(summary())
    source = WikipediaSource(client)
    candidate = source.search("anything", SimpleNamespace(species_id=25))[0]
    assert client.calls == []
    assert not candidate.is_subject_document
    assert source.search("Pikachu", SimpleNamespace(species_id=1)) == []
    # A separate form shares only species background, never form-specific metadata.
    assert source.search("anything", SimpleNamespace(species_id=25))[0] == candidate
    doc = source.fetch_document(candidate)
    assert doc.source_type == "wiki"
    assert "oldid=123" in str(doc.source_url)
    assert "CC BY-SA 4.0" in doc.licence
    assert doc.body.endswith(summary()["extract"])
    assert "scope and attribution headers added" in doc.body
    assert doc.game == doc.battle_format == "generic"
    assert doc.verification_status == doc.regulation_id == "unknown"
    assert doc.collected_at == "2026-10-22T00:00:00+00:00"


@pytest.mark.parametrize(
    "changes",
    [
        {"type": "disambiguation"},
        {"title": "Another article"},
        {"wikibase_item": "Q0"},
        {"lang": "de"},
        {"extract": " "},
        {"extract": None},
        {"revision": "not-a-revision"},
    ],
)
def test_wrong_identity_or_incomplete_article_is_not_indexable(changes):
    source = WikipediaSource(client_for(summary(**changes)))
    candidate = source.search("test", SimpleNamespace(species_id=25))[0]
    with pytest.raises(ServiceError) as error:
        source.fetch_document(candidate)
    assert error.value.code == "SOURCE_INVALID"


def test_unmapped_candidate_is_rejected_before_network_and_404_is_absent():
    client = client_for(summary())
    source = WikipediaSource(client)
    candidate = source.search("test", SimpleNamespace(species_id=25))[0]
    bad = candidate.model_copy(update={"resource_id": "User:Arbitrary"})
    with pytest.raises(ServiceError):
        source.fetch_document(bad)
    assert client.calls == []
    source.client = SimpleNamespace(fetch=lambda url: None)
    assert source.fetch_document(candidate) is None


def test_sources_are_opt_in_with_distinct_cache_identity():
    client = client_for(summary())
    assert isinstance(build_source(Settings(), client), PokeApiSource)
    combined = build_source(Settings(wikipedia_enabled=True), client)
    assert isinstance(combined, CombinedSource)
    assert combined.client is combined.wikipedia.client is combined.primary.client
    assert combined.name != combined.primary.name


def test_both_source_types_flow_through_selection_index_retrieval_and_citation(setup, monkeypatch):
    client = SourceClient(setup.settings, setup.store)
    urls = []

    def get(url, **kwargs):
        urls.append(url)
        assert kwargs["allow_redirects"] is False
        if "en.wikipedia.org" in url:
            body = summary()
        elif "?limit=" in url:
            body = {
                "results": [
                    {"name": "test-25", "url": "https://pokeapi.co/api/v2/pokemon-species/25/"}
                ]
            }
        else:
            body = {"id": 25, "name": "test-25"}
        return SimpleNamespace(status_code=200, ok=True, is_redirect=False, json=lambda: body)

    monkeypatch.setattr(client.session, "get", get)
    source = CombinedSource(client)

    class Model:
        accept_wiki = True

        def invoke(self, purpose, system, payload, schema):
            if purpose != "selection":
                return setup.model.invoke(purpose, system, payload, schema)
            assert not any("extract" in c for c in payload["candidates"])
            return Selection(
                selected_candidate_ids=["wikipedia:en:Pikachu"] if self.accept_wiki else [],
                decisions=[],
            )

    model = Model()
    service = KnowledgeService(
        setup.settings, setup.catalog, setup.store, setup.vectors, source, model
    )
    first = service.collect("pokemon:25", "species background")
    assert first["document_count"] == 2
    assert first["subject_document_status"] == "indexed"
    assert len(urls) == 3
    count = setup.vectors.docs.count()
    cached = service.collect("pokemon:25", "species background")
    assert cached["cache"]["query_hits"] == 1
    assert cached["cache"]["network_calls"] == 0
    assert setup.vectors.docs.count() == count
    evidence = setup.vectors.retrieve("pokemon:25", "fictional franchise")
    assert {e["source_type"] for e in evidence} >= {"metadata", "api", "wiki"}
    wiki = next(e for e in evidence if e["source_type"] == "wiki")
    result = render_answer(
        Generation(
            answer_status="answered",
            claims=[{"text": "테스트 자료 설명", "evidence_ids": [wiki["evidence_id"]]}],
            assumptions=[],
            unknowns=[],
        ),
        evidence,
        None,
    )
    assert (
        result["citations"][0]["licence_url"] == "https://creativecommons.org/licenses/by-sa/4.0/"
    )
    assert result["facts"][0]["verification_status"] == "unknown"
    assert len(setup.vectors.retrieve("pokemon:25", "test", "m_c")) == 1
    assert all(e["source_type"] != "wiki" for e in setup.vectors.retrieve("pokemon:1", "test"))

    # Selection can reject Wikipedia, without fetching it or dropping the mandatory subject.
    model.accept_wiki = False
    rejected = service.collect("pokemon:25", "battle-only question")
    wiki_decision = next(
        d for d in rejected["reports"][0]["decisions"] if d["candidate_id"].startswith("wikipedia:")
    )
    assert not wiki_decision["accepted"]
    assert rejected["document_count"] == 1
    assert len(urls) == 3


def test_selected_second_source_failure_is_not_published_as_complete(setup):
    source = CombinedSource(client_for(summary(type="disambiguation")))
    source.primary = setup.source
    # This test exercises service publication; use the fixture primary document implementation.
    original_fetch = source.fetch_document
    source.fetch_document = lambda c: (
        setup.source.fetch_document(c) if c.candidate_id == "subject" else original_fetch(c)
    )

    class Model:
        def invoke(self, purpose, system, payload, schema):
            if purpose == "selection":
                return Selection(selected_candidate_ids=["wikipedia:en:Pikachu"], decisions=[])
            return setup.model.invoke(purpose, system, payload, schema)

    source.client.network_calls = source.client.cache_hits = 0
    service = KnowledgeService(
        setup.settings, setup.catalog, setup.store, setup.vectors, source, Model()
    )
    with pytest.raises(ServiceError) as error:
        service.collect("pokemon:25", "background")
    assert error.value.code == "SOURCE_INVALID"
    # Retry still fetches/revalidates rather than accepting a failed completion cache.
    with pytest.raises(ServiceError):
        service.collect("pokemon:25", "background")
    assert len(source.client.calls) == 2


def test_wikipedia_http_is_serial_cached_and_restricted_to_summary_path(setup, monkeypatch):
    client = SourceClient(replace(setup.settings, request_interval=0), setup.store)
    assert "https://github.com/unfl1/poketact" in client.session.headers["User-Agent"]
    calls = []

    def get(url, **kwargs):
        calls.append(url)
        return SimpleNamespace(status_code=200, ok=True, is_redirect=False, json=summary)

    monkeypatch.setattr(client.session, "get", get)
    url = "https://en.wikipedia.org/api/rest_v1/page/summary/Pikachu"
    assert client.fetch(url) == client.fetch(url)
    assert len(calls) == 1
    for bad in ["https://en.wikipedia.org/wiki/Pikachu", "https://en.wikipedia.org.evil.org/test"]:
        with pytest.raises(ServiceError):
            client.fetch(bad)
    assert len(calls) == 1
