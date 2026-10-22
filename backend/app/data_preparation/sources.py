from backend.app.core.config import ROOT
from backend.app.core.errors import ServiceError
from backend.app.data_preparation.pokeapi import PokeApiSource
from backend.app.data_preparation.strategy import StrategySource
from backend.app.data_preparation.wikipedia import WikipediaSource


class CombinedSource:
    name = "pokeapi-strategy-wikipedia-v2"

    def __init__(self, client, *, directory=None, wikipedia_enabled=True):
        self.client = client
        self.primary = PokeApiSource(client)
        self.wikipedia = WikipediaSource(client)
        self.wikipedia_enabled = wikipedia_enabled
        self.name = "pokeapi-strategy-v2" + ("-wikipedia" if wikipedia_enabled else "")
        self.strategy = StrategySource(directory or ROOT / "data")

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
