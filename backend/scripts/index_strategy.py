"""Index project-authored, explicitly assumed strategy notes and their public mechanics."""

from backend.app.core.config import Settings
from backend.app.data_preparation.pokeapi import PokeApiSource
from backend.app.data_preparation.strategy import StrategySource
from backend.app.main import create_service


def index_strategy(settings):
    service = create_service(settings)
    source = StrategySource(settings.data_dir)
    primary = PokeApiSource(service.source.client)
    for note in source.notes:
        pokemon = service.catalog.get(note["pokemon_id"])
        candidate = source.search(pokemon.name_en, pokemon)[0]
        document = source.fetch_document(candidate)
        service.vectors.index_document(pokemon.pokemon_id, document)
        for mechanic in note["mechanics"]:
            candidate = primary.candidate(mechanic["resource"], mechanic["name"])
            if candidate is None:
                raise ValueError("기초 메커니즘 문서 누락")
            document = primary.fetch_document(candidate)
            if document is None:
                raise ValueError("선별한 기초 메커니즘 문서 누락")
            service.vectors.index_document(pokemon.pokemon_id, document)
        print(f"전략·기초 메커니즘 색인: {pokemon.pokemon_id}", flush=True)


if __name__ == "__main__":
    index_strategy(Settings.from_env())
