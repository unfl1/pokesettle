"""Build local, version-labelled learnsets without retrieval or model calls."""

import csv
import io
import json
from collections import defaultdict

from backend.app.core.config import Settings
from backend.app.data_preparation.pokeapi import LICENCE_URL
from backend.app.http_client import SourceClient
from backend.app.storage import Store
from backend.scripts.prepare_data import CSV_ROOT


def build_details(tables):
    names = {r["move_id"]: r["name"] for r in tables["move_names"] if r["local_language_id"] == "3"}
    moves = {r["id"]: names.get(r["id"], r["identifier"]) for r in tables["moves"]}
    groups = {r["id"]: r["identifier"] for r in tables["version_groups"]}
    group_order = {r["id"]: int(r.get("order") or r["id"]) for r in tables["version_groups"]}
    methods = {r["id"]: r["identifier"] for r in tables["pokemon_move_methods"]}
    latest = {}
    for r in tables["pokemon_moves"]:
        pid = r["pokemon_id"]
        group = r["version_group_id"]
        if pid not in latest or group_order[group] > group_order[latest[pid]]:
            latest[pid] = group
    entries = defaultdict(list)
    seen = set()
    for r in tables["pokemon_moves"]:
        if r["version_group_id"] != latest[r["pokemon_id"]]:
            continue
        key = (r["pokemon_id"], r["move_id"], r["pokemon_move_method_id"], r["level"])
        if key in seen:
            continue
        seen.add(key)
        entries[r["pokemon_id"]].append(
            {
                "name": moves[r["move_id"]],
                "method": methods[r["pokemon_move_method_id"]],
                "level": int(r["level"]),
            }
        )
    return {
        f"pokemon:{pid}": {"version_group": groups[str(latest[pid])], "moves": rows}
        for pid, rows in entries.items()
    }


def prepare(settings):
    client = SourceClient(settings, Store(settings.database_url, settings.database_schema))
    tables, sources = {}, []
    for name in [
        "abilities",
        "ability_names",
        "types",
        "moves",
        "move_names",
        "version_groups",
        "pokemon_move_methods",
        "pokemon_moves",
    ]:
        snapshot = client.fetch(f"{CSV_ROOT}/{name}.csv", expect_json=False)
        if not snapshot:
            raise ValueError(f"Missing source: {name}")
        tables[name] = list(csv.DictReader(io.StringIO(snapshot["body"])))
        sources.append({key: snapshot[key] for key in ["url", "collected_at", "content_hash"]})
        print(f"{name}: {len(tables[name])}", flush=True)
    result = {
        "sources": sources,
        "licence_url": LICENCE_URL,
        "scope": "Original game version reference; Champions learnsets unverified",
        "pokemon": build_details(tables),
    }
    ability_names = {
        r["ability_id"]: r["name"] for r in tables["ability_names"] if r["local_language_id"] == "3"
    }
    result["ability_names"] = {
        r["identifier"]: ability_names[r["id"]]
        for r in tables["abilities"]
        if r["id"] in ability_names
    }
    type_names = {r["id"]: r["identifier"] for r in tables["types"]}
    ko_names = {
        r["move_id"]: r["name"] for r in tables["move_names"] if r["local_language_id"] == "3"
    }
    result["move_details"] = [
        {
            "name": r["identifier"],
            "name_ko": ko_names.get(r["id"]),
            "type": type_names[r["type_id"]],
            "category": {"1": "status", "2": "physical", "3": "special"}[r["damage_class_id"]],
            "power": int(r["power"]) if r["power"] else None,
            "accuracy": int(r["accuracy"]) if r["accuracy"] else None,
        }
        for r in tables["moves"]
    ]
    path = settings.data_dir / "catalog_details.json"
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n")
    temporary.replace(path)
    print(f"Prepared {len(result['pokemon'])} learnsets", flush=True)


if __name__ == "__main__":
    prepare(Settings.from_env())
