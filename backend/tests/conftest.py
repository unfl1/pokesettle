import hashlib
import json
import re
from dataclasses import replace
from types import SimpleNamespace

import pytest

from backend.catalog import Catalog
from backend.config import Settings
from backend.models import Candidate, Document, Generation, QueryPlan, Selection
from backend.rag.vector_store import VectorStore
from backend.services import KnowledgeService
from backend.storage import Store


def embed(texts):
    """Deterministic TEST DOUBLE. Never used by production or acceptance indexing."""
    vectors = []
    for text in texts:
        vector = [0.0] * 32
        for token in re.findall(r"\w+", text.lower()):
            vector[hashlib.sha256(token.encode()).digest()[0] % 32] += 1.0
        vector[0] += 1
        vectors.append(vector)
    return vectors


def record(number=1):
    return {
        "pokemon_id": f"pokemon:{number}",
        "species_id": number,
        "name_ko": f"테스트{number}",
        "name_en": f"test-species-{number}",
        "types": ["test-type"],
        "base_stats": {
            s: 50 for s in ["hp", "attack", "defense", "sp_attack", "sp_defense", "speed"]
        },
        "abilities": ["test-ability"],
        "source_url": f"https://pokeapi.co/api/v2/pokemon/{number}/",
        "collected_at": "2026-10-21T00:00:00+00:00",
        "field_provenance": {},
    }


def document(doc_id="subject", body="TEST ONLY: alpha specimen description. " * 20, **changes):
    data = {
        "document_id": doc_id,
        "title": f"Test fixture {doc_id}",
        "source_url": "https://pokeapi.co/api/v2/pokemon-species/1/",
        "body": body,
        "collected_at": "2026-10-21T00:00:00+00:00",
        "revision_id": hashlib.sha256(body.encode()).hexdigest(),
        "licence": "synthetic test fixture",
        "licence_url": "https://example.org/test-licence",
    }
    data.update(changes)
    return Document(**data)


class FakeModel:
    def __init__(self):
        self.calls = []
        self.select_extra = False
        self.invalid_selection = False
        self.abstain = False
        self.fail = False

    def invoke(self, purpose, system, payload, schema):
        self.calls.append((purpose, payload))
        if self.fail:
            raise RuntimeError("SECRET_TEST_TOKEN full prompt raw provider exception")
        if purpose == "queries":
            return QueryPlan(queries=[])
        if purpose == "selection":
            return Selection(
                selected_candidate_ids=["nonexistent"]
                if self.invalid_selection
                else (["extra"] if self.select_extra else []),
                decisions=[
                    {"candidate_id": c["candidate_id"], "reason": "test selection"}
                    for c in payload["candidates"]
                ],
            )
        if self.abstain:
            return Generation(
                answer_status="abstained",
                claims=[],
                assumptions=[],
                unknowns=["no supporting evidence"],
            )
        return Generation(
            answer_status="answered",
            claims=[
                {
                    "text": "테스트 근거의 설명입니다.",
                    "evidence_ids": [payload["evidence"][0]["evidence_id"]],
                }
            ],
            assumptions=[],
            unknowns=[],
        )


class FakeSource:
    name = "synthetic-test-source"

    def __init__(self):
        self.client = SimpleNamespace(network_calls=0, cache_hits=0)
        self.searches = 0
        self.fetches = 0
        self.missing = False

    def subject(self, pokemon):
        if self.missing:
            return None
        return Candidate(
            candidate_id="subject",
            title="synthetic subject",
            summary="test",
            source_url="https://example.org/subject",
            resource="pokemon-species",
            resource_id="1",
            is_subject_document=True,
        )

    def search(self, query, pokemon):
        self.searches += 1
        return [
            Candidate(
                candidate_id="extra",
                title="synthetic other",
                summary="test",
                source_url="https://example.org/extra",
                resource="ability",
                resource_id="1",
            )
        ]

    def fetch_document(self, candidate):
        self.fetches += 1
        return document(candidate.candidate_id)


@pytest.fixture
def setup(tmp_path):
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    (data_dir / "pokemon.json").write_text(json.dumps([record(i) for i in range(1, 101)]))
    settings = Settings(
        data_dir=data_dir,
        runtime_dir=tmp_path / "runtime",
        api_key="test-key-not-real",
        chat_model="test-model",
        chunk_size=150,
        chunk_overlap=20,
        request_interval=0,
    )
    store = Store(settings.runtime_dir / "state.sqlite3")
    catalog = Catalog(data_dir / "pokemon.json")
    vectors = VectorStore(settings, store, embed=embed, embedding_identity="synthetic-test-32")
    vectors.upsert_metadata(list(catalog.items.values()))
    model, source = FakeModel(), FakeSource()
    service = KnowledgeService(settings, catalog, store, vectors, source, model)
    return SimpleNamespace(
        settings=settings,
        store=store,
        catalog=catalog,
        vectors=vectors,
        model=model,
        source=source,
        service=service,
        replace=replace,
    )
