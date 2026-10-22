from backend.app.core.errors import ServiceError
from backend.app.data_preparation.pokeapi import PokeApiSource
from backend.app.data_preparation.wikipedia import WikipediaSource


class CombinedSource:
    name = "pokeapi-wikipedia-mapped-v1"

    def __init__(self, client):
        self.client = client
        self.primary = PokeApiSource(client)
        self.wikipedia = WikipediaSource(client)

    def subject(self, pokemon):
        return self.primary.subject(pokemon)

    def search(self, query, pokemon):
        return self.primary.search(query, pokemon) + self.wikipedia.search(query, pokemon)

    def fetch_document(self, candidate):
        if candidate.candidate_id.startswith("wikipedia:"):
            return self.wikipedia.fetch_document(candidate)
        if candidate.candidate_id.startswith("pokeapi:"):
            return self.primary.fetch_document(candidate)
        raise ServiceError("SOURCE_NOT_ALLOWED", "등록된 출처의 후보만 수집할 수 있습니다.", 422)


def build_source(settings, client):
    return CombinedSource(client) if settings.wikipedia_enabled else PokeApiSource(client)
