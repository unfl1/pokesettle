import re

from backend.app.core.config import ROOT
from backend.app.core.errors import ServiceError
from backend.app.data_preparation.pokeapi import PokeApiSource
from backend.app.data_preparation.strategy import StrategySource
from backend.app.data_preparation.wikipedia import WikipediaSource
from backend.app.schemas import QueryPlan, Selection


class CombinedSource:
    name = "pokeapi-strategy-wikipedia-v2"

    def __init__(self, client, *, directory=None, wikipedia_enabled=True):
        self.client = client
        self.primary = PokeApiSource(client)
        self.wikipedia = WikipediaSource(client)
        self.wikipedia_enabled = wikipedia_enabled
        self.name = "pokeapi-strategy-v2" + ("-wikipedia" if wikipedia_enabled else "")
        self.strategy = StrategySource(directory or ROOT / "data")

    def plan_queries(self, pokemon, question):
        """Resolve routine strategy lookups locally; retain the model for ambiguous requests."""
        if self.wikipedia_enabled:
            return None
        text = question.casefold()
        for name in (pokemon.name_ko, pokemon.name_en):
            if name:
                pattern = re.escape(name.casefold())
                if name.isascii():
                    pattern = r"(?<![a-z0-9-])" + pattern + r"(?![a-z0-9-])"
                text = re.sub(pattern, "", text)
        topic = r"운영(?:법|방법|방향)?|육성(?:법|방법)?|전략|공략|추천|배경|소개|strategy|build|background"
        if not re.search(topic, text):
            return None
        text = re.sub(topic, "", text)
        text = re.sub(
            r"(?:근거|출처)(?:와|를)?\s*함께|알려\s*줘(?:요)?|알려\s*주세요|설명해\s*줘(?:요)?|설명해\s*주세요|기본|일반적인|포켓몬|please|tell\s*me|how\s*(?:to|should\s*i)",
            "", text,
        )
        # A named move, second species, regulation or other unresolved condition
        # must keep semantic query planning, even alongside a generic strategy word.
        if not re.fullmatch(r"(?:[\s.,?!]|의|은|는|이|가|을|를|좀|요)*", text):
            return None
        # These exact resources already belong to the selected catalog form.
        return QueryPlan(queries=[{"query": name, "language": "en"} for name in pokemon.abilities[:5]])

    def select_candidates(self, pokemon, question, candidates):
        """Registered exact resources need no semantic model filtering."""
        if self.wikipedia_enabled:
            return None
        if self.plan_queries(pokemon, question) is None and any(
            not candidate.is_subject_document for candidate in candidates
        ):
            return None
        for candidate in candidates:
            registered = (
                candidate.candidate_id.startswith("poketact:strategy:")
                and candidate.resource == "strategy-note"
            ) or (
                candidate.resource in {"pokemon-species", "ability", "move", "type"}
                and candidate.candidate_id == f"pokeapi:{candidate.resource}:{candidate.resource_id}"
            )
            if not registered:
                return None
        return Selection(
            selected_candidate_ids=[candidate.candidate_id for candidate in candidates],
            decisions=[
                {"candidate_id": candidate.candidate_id, "reason": "등록 출처의 정확한 리소스·종별 전략 자료 유지"}
                for candidate in candidates
            ],
        )

    def subject(self, pokemon):
        return self.primary.subject(pokemon)

    def search(self, query, pokemon):
        return (
            self.primary.search(query, pokemon)
            + self.strategy.search(query, pokemon)
            + (self.wikipedia.search(query, pokemon) if self.wikipedia_enabled else [])
        )

    def fetch_document(self, candidate):
        if candidate.candidate_id.startswith("poketact:strategy:"):
            return self.strategy.fetch_document(candidate)
        if candidate.candidate_id.startswith("wikipedia:"):
            return self.wikipedia.fetch_document(candidate)
        if candidate.candidate_id.startswith("pokeapi:"):
            return self.primary.fetch_document(candidate)
        raise ServiceError("SOURCE_NOT_ALLOWED", "등록된 출처의 후보만 수집할 수 있습니다.", 422)


def build_source(settings, client):
    return CombinedSource(
        client, directory=settings.data_dir, wikipedia_enabled=settings.wikipedia_enabled
    )
