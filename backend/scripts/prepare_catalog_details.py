"""Build local, version-labelled learnsets without retrieval or model calls."""

import argparse
import csv
import io
import json
from collections import defaultdict

from backend.app.core.config import Settings
from backend.app.data_preparation.localization import (
    LOCALE_LANGUAGES,
    REFERENCE_TABLES,
    localized_reference,
)
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


MOVE_EFFECT_TABLES = [
    "moves", "stats", "move_targets", "move_meta", "move_meta_categories", "move_meta_ailments",
    "move_meta_stat_changes", "move_flavor_text", "move_effect_prose", "version_groups", "languages",
]


# Compact tags are backed by the collected short_effect for these effect IDs.
EFFECT_TAGS = {
    "26": ["reset-stages"], "36": ["special-screen"], "66": ["physical-screen"],
    "80": ["substitute"], "91": ["encore"], "112": ["protect"],
    "113": ["spikes"], "130": ["remove-hazards"], "159": ["first-turn-only"],
    "176": ["taunt"], "189": ["remove-item"], "226": ["tailwind"],
    "229": ["switch-user"], "250": ["toxic-spikes"], "260": ["trick-room"],
    "267": ["stealth-rock"], "341": ["sticky-web"],
}


def build_move_effects(tables):
    ailments = {row["id"]: row["identifier"] for row in tables.get("move_meta_ailments", [])}
    stats = {row["id"]: row["identifier"] for row in tables["stats"]}
    targets = {row["id"]: row["identifier"] for row in tables["move_targets"]}
    categories = {row["id"]: row["identifier"] for row in tables["move_meta_categories"]}
    meta = {row["move_id"]: row for row in tables["move_meta"]}
    versions = {row["id"]: row for row in tables["version_groups"]}
    languages = {row["id"]: row["identifier"] for row in tables["languages"]}
    locales = {value: key for key, value in LOCALE_LANGUAGES.items()}
    changes = defaultdict(list)
    for row in tables["move_meta_stat_changes"]:
        changes[row["move_id"]].append({"stat": stats[row["stat_id"]], "change": int(row["change"])})
    descriptions, latest = defaultdict(dict), {}
    for row in tables["move_flavor_text"]:
        locale = locales.get(languages.get(row["language_id"]))
        version = versions[row["version_group_id"]]
        order = int(version.get("order") or version["id"])
        key = (row["move_id"], locale)
        if locale and row["flavor_text"].strip() and order > latest.get(key, -1):
            latest[key] = order
            descriptions[row["move_id"]][locale] = {"text": " ".join(row["flavor_text"].split()), "version_group": version["identifier"]}
    prose = {row["move_effect_id"]: row["short_effect"] for row in tables["move_effect_prose"] if languages.get(row["local_language_id"]) == "en"}
    result = {}
    for move in tables["moves"]:
        details = meta.get(move["id"], {})
        category = categories.get(details.get("meta_category_id"))
        target = targets.get(move["target_id"])
        # The move target is NOT necessarily the recipient of stat changes.
        stat_target = None
        if category == "damage-raise" or (category == "net-good-stats" and target == "user"):
            stat_target = "user"
        elif category == "damage-lower" or (category == "net-good-stats" and target in {"selected-pokemon", "all-opponents"}):
            stat_target = "target"
        effects = dict(descriptions.get(move["id"], {}))
        if "en" not in effects and prose.get(move["effect_id"]):
            text = prose[move["effect_id"]]
            if "$effect_chance" not in text or move.get("effect_chance"):
                effects["en"] = {"text": text.replace("$effect_chance", move.get("effect_chance") or ""), "version_group": "generic"}
        # Effect 1 is an ordinary damage move without an additional effect.
        result[move["identifier"]] = {
            "pp": int(move["pp"]) if move.get("pp") else None,
            "stat_changes": changes.get(move["id"], []) if stat_target else [],
            "stat_target": stat_target,
            "stat_chance": int(details["stat_chance"]) if details.get("stat_chance") else None,
            "effect_texts": effects if move["effect_id"] != "1" else {},
            "effect_meta": {
                "category": category,
                "ailment": ailments.get(details.get("meta_ailment_id")),
                **{key: int(details[key]) if details.get(key) not in (None, "") else None
                   for key in ["ailment_chance", "flinch_chance", "healing", "drain", "crit_rate", "min_hits", "max_hits"]},
                "priority": int(move["priority"]) if move.get("priority") not in (None, "") else None,
                "tags": EFFECT_TAGS.get(move["effect_id"], []),
            },
        }
    return result


def prepare(settings, *, localization_only=False, move_effects_only=False):
    client = SourceClient(settings, Store(settings.database_url, settings.database_schema))
    tables, sources = {}, []
    detail_tables = [
        "abilities",
        "ability_names",
        "types",
        "moves",
        "move_names",
        "version_groups",
        "pokemon_move_methods",
        "pokemon_moves",
    ]
    selected_tables = MOVE_EFFECT_TABLES if move_effects_only else REFERENCE_TABLES if localization_only else detail_tables + REFERENCE_TABLES + MOVE_EFFECT_TABLES
    for name in dict.fromkeys(selected_tables):
        snapshot = client.fetch(f"{CSV_ROOT}/{name}.csv", expect_json=False)
        if not snapshot:
            raise ValueError(f"Missing source: {name}")
        tables[name] = list(csv.DictReader(io.StringIO(snapshot["body"])))
        sources.append({key: snapshot[key] for key in ["url", "collected_at", "content_hash"]})
        print(f"{name}: {len(tables[name])}", flush=True)
    path = settings.data_dir / "catalog_details.json"
    if move_effects_only:
        result = json.loads(path.read_text())
        effects = build_move_effects(tables)
        for move in result["move_details"]:
            move.update(effects.get(move["name"], {}))
        previous = {(source["url"], source["content_hash"]): source for source in result.get("sources", [])}
        previous.update({(source["url"], source["content_hash"]): source for source in sources})
        result["sources"] = list(previous.values())
    elif localization_only:
        result = json.loads(path.read_text())
    else:
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
        effects = build_move_effects(tables)
        result["move_details"] = [
            {
                **effects.get(r["identifier"], {}),
                "name": r["identifier"],
                "name_ko": ko_names.get(r["id"]),
                "type": type_names[r["type_id"]],
                "category": {"1": "status", "2": "physical", "3": "special"}[r["damage_class_id"]],
                "power": int(r["power"]) if r["power"] else None,
                "accuracy": int(r["accuracy"]) if r["accuracy"] else None,
            }
            for r in tables["moves"]
        ]
    if not move_effects_only:
        result["localization"] = {
            **localized_reference(tables),
            "sources": [source for source in sources if source["url"].rsplit("/", 1)[-1].removesuffix(".csv") in REFERENCE_TABLES],
            "licence_url": LICENCE_URL,
        }
    path = settings.data_dir / "catalog_details.json"
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n")
    temporary.replace(path)
    print(f"Prepared {len(result['pokemon'])} learnsets", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--localization-only", action="store_true", help="Refresh display translations without changing battle or learnset data")
    parser.add_argument("--move-effects-only", action="store_true", help="Add PP and source effects without rebuilding learnsets")
    args = parser.parse_args()
    prepare(Settings.from_env(), localization_only=args.localization_only, move_effects_only=args.move_effects_only)
