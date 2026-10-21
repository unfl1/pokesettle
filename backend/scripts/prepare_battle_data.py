"""Collect reproducible generic type relations, never Champions legality or damage rules."""

import csv
import io
import json

from backend.config import Settings
from backend.http_client import SourceClient
from backend.storage import Store, digest

ROOT = "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv"


def build_chart(types, efficacy):
    names = {int(row["id"]): row["identifier"] for row in types if int(row["id"]) <= 18}
    if len(names) != 18:
        raise ValueError("18개 일반 타입 필요")
    chart = {name: {} for name in names.values()}
    for row in efficacy:
        attack, defense = int(row["damage_type_id"]), int(row["target_type_id"])
        if attack in names and defense in names:
            chart[names[attack]][names[defense]] = int(row["damage_factor"]) / 100
    if any(set(row) != set(names.values()) for row in chart.values()):
        raise ValueError("타입 관계 324개 필요")
    if any(v not in {0, 0.5, 1, 2} for row in chart.values() for v in row.values()):
        raise ValueError("지원하지 않는 타입 배율")
    return chart


def main():
    settings = Settings.from_env()
    client = SourceClient(settings, Store(settings.runtime_dir / "state.sqlite3"))
    tables, sources = {}, []
    for name in ["types", "type_efficacy"]:
        url = f"{ROOT}/{name}.csv"
        result = client.fetch(url, expect_json=False)
        tables[name] = list(csv.DictReader(io.StringIO(result["body"])))
        sources.append(
            {
                "source_url": url,
                "collected_at": result["collected_at"],
                "content_hash": digest(result["body"]),
                "licence": "PokéAPI project terms; original Pokémon rights reserved",
                "licence_url": "https://github.com/PokeAPI/pokeapi/blob/master/LICENSE.md",
            }
        )
    payload = {
        "version": "generic-type-chart-v1",
        "scope": "generic",
        "champions_verification_status": "unknown",
        "sources": sources,
        "chart": build_chart(tables["types"], tables["type_efficacy"]),
    }
    path = settings.data_dir / "type_chart.json"
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    print(
        f"Generic type relations: 324; network calls: {client.network_calls}; cache hits: {client.cache_hits}"
    )


if __name__ == "__main__":
    main()
