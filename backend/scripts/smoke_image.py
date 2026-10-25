"""Verify packaged runtime files without a database, model calls, or network access."""

from backend.app.battle.damage import DamageInput, calculate_damage
from backend.app.catalog import Catalog
from backend.app.core.config import ROOT, Settings
from backend.app.main import app


def check_image():
    assert app.title == "PokeTact"

    def member(pokemon_id, points):
        return {
            "pokemonId": pokemon_id,
            "alignment": "Hardy",
            "statPoints": {
                "hp": 0,
                "attack": 0,
                "defense": 0,
                "spAttack": points,
                "spDefense": 0,
                "speed": 0,
            },
        }

    body = DamageInput.model_validate(
        {
            "attacker": member("pokemon:25", 32),
            "defender": member("pokemon:9", 0),
            "move": "Thunderbolt",
            "neutralConditions": True,
        }
    )
    result = calculate_damage(body, Catalog(ROOT / "data/pokemon.json"), Settings())
    damage = result["calculation"]["damage"]
    if (damage["minimum"], damage["maximum"]) != (84, 102) or len(damage["rolls"]) != 16:
        raise RuntimeError("Packaged calculator regression")
    print("Packaged application and reference calculator ready")


if __name__ == "__main__":
    check_image()
