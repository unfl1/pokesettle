import json
from pathlib import Path

from backend.app.core.errors import ServiceError
from backend.app.schemas import Pokemon


class Catalog:
    def __init__(self, path: Path):
        self.items = {}
        details_path = path.parent / "catalog_details.json"
        self.details = json.loads(details_path.read_text()) if details_path.exists() else {}
        names_path = path.parent / "battle_names.json"
        self.battle_names = json.loads(names_path.read_text()) if names_path.exists() else {}
        species_path = path.parent / "documents" / "species.json"
        self.move_details = {}
        for move in self.details.get("move_details", []):
            for name in (move["name"], move.get("name_ko")):
                if name:
                    self.move_details[name] = move
        self.name_sources = []
        self.name_licence_url = None
        self.descriptions = {}
        if species_path.exists():
            for row in json.loads(species_path.read_text()):
                lines = row["document"]["body"].splitlines()
                korean = [line for line in lines if line.startswith("Description (ko, ")]
                if korean:
                    self.descriptions[row["pokemon_id"]] = korean[-1]
        if path.exists():
            names_path = path.parent / "pokemon_names.json"
            name_snapshot = json.loads(names_path.read_text()) if names_path.exists() else {}
            localized = {row["pokemon_id"]: row for row in name_snapshot.get("items", [])}
            self.name_sources = name_snapshot.get("sources", [])
            self.name_licence_url = name_snapshot.get("licence_url")
            records = [Pokemon.model_validate({**row, **localized.get(row["pokemon_id"], {})}) for row in json.loads(path.read_text())]
            self.items = {row.pokemon_id: row for row in records}
            if name_snapshot and set(localized) != set(self.items):
                raise ValueError("Localized name snapshot does not match catalogue IDs")
            if len(records) != len(self.items) or len(
                {p.species_id for p in records if p.is_default}
            ) != sum(p.is_default for p in records):
                raise ValueError("포켓몬/종 ID 중복")

    def get(self, pokemon_id):
        try:
            return self.items[pokemon_id]
        except KeyError:
            raise ServiceError("POKEMON_NOT_FOUND", "포켓몬을 찾을 수 없습니다.", 404) from None

    def profile(self, pokemon_id):
        pokemon = self.get(pokemon_id)
        result = pokemon.model_dump()
        result["name_sources"] = self.name_sources
        result["name_licence_url"] = self.name_licence_url
        result["ability_details"] = [
            {"name": name, "name_ko": self.details.get("ability_names", {}).get(name)}
            for name in pokemon.abilities
        ]
        description = self.descriptions.get(pokemon_id)
        if description:
            label, text = description.split("): ", 1)
            result["description"] = text
            result["description_version"] = label.removeprefix("Description (ko, ")
        detail = self.details.get("pokemon", {}).get(pokemon_id)
        result["learnset"] = (
            {
                **detail,
                "moves": [
                    {
                        **move,
                        **{
                            key: self.move_details.get(move["name"], {}).get(key)
                            for key in ("type", "category", "power", "accuracy")
                        },
                    }
                    for move in detail["moves"]
                ],
            }
            if detail
            else None
        )
        result["learnset_sources"] = self.details.get("sources", []) if detail else []
        result["learnset_licence_url"] = self.details.get("licence_url") if detail else None
        return result


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
