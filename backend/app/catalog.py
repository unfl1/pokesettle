import json
from pathlib import Path

from backend.app.core.errors import ServiceError
from backend.app.schemas import Pokemon


class Catalog:
    def __init__(self, path: Path):
        self.items = {}
        if path.exists():
            records = [Pokemon.model_validate(row) for row in json.loads(path.read_text())]
            self.items = {row.pokemon_id: row for row in records}
            if len(records) != len(self.items) or len(
                {p.species_id for p in records if p.is_default}
            ) != sum(p.is_default for p in records):
                raise ValueError("포켓몬/종 ID 중복")

    def get(self, pokemon_id):
        try:
            return self.items[pokemon_id]
        except KeyError:
            raise ServiceError("POKEMON_NOT_FOUND", "포켓몬을 찾을 수 없습니다.", 404) from None


def metadata_text(pokemon):
    stats = ", ".join(f"{key}={value}" for key, value in pokemon.base_stats.model_dump().items())
    return (
        f"ID: {pokemon.pokemon_id}\n이름 Name: {pokemon.name_ko or '미확인'} / {pokemon.name_en}\n"
        f"종 ID Species: {pokemon.species_id}; form: {pokemon.form_identifier or 'default'}. Species descriptions are shared; form-specific traits require this form metadata.\n"
        f"타입 Types: {', '.join(pokemon.types)}\n종족값 Base stats: {stats}\n"
        f"특성 Abilities: {', '.join(pokemon.abilities)}\n설명: {pokemon.description or '미확인'}\n"
        "Scope: generic Pokémon reference; NOT verified Pokémon Champions mechanics.\n"
        f"Champions eligibility: {pokemon.champions_eligibility_status}\n"
        "Champions moves, training and Mega forms: 미확인 / unknown\n"
        f"Source: {pokemon.source_url}\nCollected: {pokemon.collected_at}"
    )
