"""Prepare the complete upstream catalogue and species documents from bulk CSV snapshots."""

import argparse
import csv
import io
import json
from collections import defaultdict

from backend.app.core.config import Settings
from backend.app.data_preparation.localization import localized_routes
from backend.app.data_preparation.pokeapi import LICENCE_URL, PokeApiSource
from backend.app.http_client import SourceClient
from backend.app.schemas import Document, Pokemon
from backend.app.storage import Store, digest

CSV_ROOT = "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv"
SPRITES_ROOT = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon"
TABLES = [
    "languages",
    "pokemon",
    "pokemon_stats",
    "pokemon_types",
    "types",
    "pokemon_abilities",
    "abilities",
    "pokemon_species_names",
    "pokemon_forms",
    "pokemon_form_names",
    "pokemon_species_flavor_text",
    "versions",
]


def grouped(rows, key):
    result = defaultdict(list)
    for row in rows:
        result[row[key]].append(row)
    return result


def build_snapshots(tables, sources, count=None):
    """Pure transformation: no fixed national-dex upper bound and no generated facts."""
    default_rows = sorted(
        (r for r in tables["pokemon"] if r["is_default"] == "1"), key=lambda r: int(r["species_id"])
    )
    if count is not None and not 1 <= count <= len(default_rows):
        raise ValueError(f"종 수는 1~{len(default_rows)} 범위로 지정하세요.")
    species_ids = {r["species_id"] for r in (default_rows[:count] if count else default_rows)}
    names = {
        (r["pokemon_species_id"], r["local_language_id"]): r["name"]
        for r in tables["pokemon_species_names"]
    }
    types = {r["id"]: r["identifier"] for r in tables["types"]}
    abilities = {r["id"]: r["identifier"] for r in tables["abilities"]}
    versions = {r["id"]: r["identifier"] for r in tables["versions"]}
    forms = grouped(tables["pokemon_forms"], "pokemon_id")
    form_names = {
        (r["pokemon_form_id"], r["local_language_id"]): r for r in tables["pokemon_form_names"]
    }
    stats, type_rows, ability_rows = [
        grouped(tables[k], "pokemon_id")
        for k in ["pokemon_stats", "pokemon_types", "pokemon_abilities"]
    ]
    descriptions = grouped(
        [r for r in tables["pokemon_species_flavor_text"] if r["language_id"] in {"3", "9"}],
        "species_id",
    )
    stat_names = {
        "1": "hp",
        "2": "attack",
        "3": "defense",
        "4": "sp_attack",
        "5": "sp_defense",
        "6": "speed",
    }
    by_source = {s["source_id"]: s for s in sources}
    documents_by_species = {}
    for sid in sorted(species_ids, key=int):
        payload = {
            "id": int(sid),
            "name": names.get((sid, "9"), sid),
            "names": [
                {"language": {"name": language}, "name": names[(sid, language_id)]}
                for language_id, language in [("3", "ko"), ("9", "en")]
                if (sid, language_id) in names
            ],
            "flavor_text_entries": [
                {
                    "language": {"name": "ko" if r["language_id"] == "3" else "en"},
                    "version": {"name": versions[r["version_id"]]},
                    "flavor_text": r["flavor_text"],
                }
                for r in descriptions[sid]
            ],
        }
        if not payload["flavor_text_entries"]:
            raise ValueError(f"자체 설명 문서 없음: species:{sid}")
        source = by_source["pokeapi-csv:pokemon_species_flavor_text"]
        documents_by_species[sid] = Document(
            document_id=f"pokeapi:pokemon-species:{sid}",
            title=f"{names.get((sid, '9'), sid)} — PokéAPI species CSV",
            source_url=source["source_url"],
            source_type="curated",
            body=PokeApiSource.render("pokemon-species", payload),
            collected_at=source["collected_at"],
            revision_id=digest(payload),
            licence="PokéAPI project terms; Pokémon names and original text rights reserved to their owners",
            licence_url=LICENCE_URL,
        )
    records, documents = [], []
    for row in sorted(
        tables["pokemon"],
        key=lambda r: (int(r["species_id"]), r["is_default"] != "1", int(r["id"])),
    ):
        sid, identifier = row["species_id"], row["id"]
        if sid not in species_ids:
            continue
        default = row["is_default"] == "1"
        default_form = next((r for r in forms[identifier] if r["is_default"] == "1"), None)
        label = form_names.get((default_form["id"], "3"), {}) if default_form else {}
        base_ko = names.get((sid, "3"))
        form_label = (
            label.get("form_name")
            or (default_form.get("form_identifier") if default_form else None)
            or row["identifier"]
        )
        name_ko = (
            base_ko
            if default
            else label.get("pokemon_name") or (f"{base_ko} ({form_label})" if base_ko else None)
        )
        provenance = {
            field: {
                "source_ids": [f"pokeapi-csv:{table}"],
                "verification_status": "verified",
                "scope": "generic PokéAPI reference; Champions applicability unknown",
                "verified_at": by_source[f"pokeapi-csv:{table}"]["collected_at"],
            }
            for field, table in [
                ("names", "pokemon_species_names"),
                ("types", "pokemon_types"),
                ("base_stats", "pokemon_stats"),
                ("abilities", "pokemon_abilities"),
                ("form", "pokemon_forms"),
            ]
        }
        provenance["names"]["source_ids"].append("pokeapi-csv:pokemon_form_names")
        provenance["names"]["verified_at"] = max(
            provenance["names"]["verified_at"],
            by_source["pokeapi-csv:pokemon_form_names"]["collected_at"],
        )
        provenance["images"] = {
            "source_ids": ["pokeapi-sprites"],
            "verification_status": "unknown",
            "scope": "Repository URL convention; availability checked on display",
            "verified_at": None,
        }
        pokemon = Pokemon(
            pokemon_id=f"pokemon:{identifier}",
            species_id=int(sid),
            is_default=default,
            form_identifier=None if default else row["identifier"],
            name_ko=name_ko,
            name_en=names.get((sid, "9"), row["identifier"]) if default else row["identifier"],
            types=[
                types[r["type_id"]]
                for r in sorted(type_rows[identifier], key=lambda r: int(r["slot"]))
            ],
            base_stats={
                stat_names[r["stat_id"]]: int(r["base_stat"])
                for r in stats[identifier]
                if r["stat_id"] in stat_names
            },
            abilities=[abilities[r["ability_id"]] for r in ability_rows[identifier]],
            source_url=f"https://pokeapi.co/api/v2/pokemon/{identifier}/",
            collected_at=sources[0]["collected_at"],
            field_provenance=provenance,
            images={
                "artwork_url": f"{SPRITES_ROOT}/other/official-artwork/{identifier}.png",
                "sprite_url": f"{SPRITES_ROOT}/{identifier}.png",
                "source_url": "https://github.com/PokeAPI/sprites",
                "rights_notice": "Pokémon images © The Pokémon Company. Source: PokéAPI sprites.",
                "checked_at": sources[0]["collected_at"],
                "availability": "checked_on_display",
            },
        )
        records.append(pokemon.model_dump(mode="json"))
        documents.append(
            {
                "pokemon_id": pokemon.pokemon_id,
                "document": documents_by_species[sid].model_dump(mode="json"),
            }
        )
    if len({r["species_id"] for r in records if r["is_default"]}) != len(species_ids):
        raise ValueError("기본 종 누락")
    return records, documents


def prepare(settings, count=None):
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    (settings.data_dir / "documents").mkdir(exist_ok=True)
    client = SourceClient(settings, Store(settings.database_url, settings.database_schema))
    tables, sources = {}, []
    for name in TABLES:
        snapshot = client.fetch(f"{CSV_ROOT}/{name}.csv", expect_json=False)
        if not snapshot:
            raise ValueError(f"원본 CSV 없음: {name}")
        tables[name] = list(csv.DictReader(io.StringIO(snapshot["body"])))
        sources.append(
            {
                "source_id": f"pokeapi-csv:{name}",
                "source_url": snapshot["url"],
                "collected_at": snapshot["collected_at"],
                "content_hash": snapshot["content_hash"],
                "licence_url": LICENCE_URL,
                "scope": "generic",
                "transformation_notes": "Bulk CSV normalized; species shared documents preserve original game versions; each pokemon resource retains its own stats and image identifier",
            }
        )
        print(f"원본 준비: {name} ({len(tables[name])}행)", flush=True)
    records, documents = build_snapshots(tables, sources, count)
    sources.append(
        {
            "source_id": "pokeapi-sprites",
            "source_url": "https://github.com/PokeAPI/sprites",
            "licence_url": "https://github.com/PokeAPI/sprites/blob/master/LICENCE.txt",
            "collected_at": sources[0]["collected_at"],
            "rights_notice": "All image contents are Copyright The Pokémon Company; repository CC0 is not a blanket grant of third-party character rights.",
            "transformation_notes": "Image URLs use upstream pokemon resource IDs. Availability checked by browser; missing artwork falls back to sprite then placeholder. Image binaries are not bundled.",
        }
    )
    for path, value in [
        (settings.data_dir / "pokemon.json", records),
        (settings.data_dir / "pokemon_names.json", {"items": localized_routes(records, tables), "sources": [s for s in sources if s["source_id"] in {"pokeapi-csv:languages", "pokeapi-csv:pokemon_species_names", "pokeapi-csv:pokemon_forms", "pokeapi-csv:pokemon_form_names"}], "licence_url": LICENCE_URL}),
        (settings.data_dir / "documents" / "species.json", documents),
        (settings.data_dir / "sources.json", sources),
    ]:
        temporary = path.with_suffix(".tmp")
        temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")
        temporary.replace(path)
    report = {
        "metadata_count": len(records),
        "species_count": sum(r["is_default"] for r in records),
        "alternate_variety_count": sum(not r["is_default"] for r in records),
        "subject_documents": len(documents),
        "network_calls": client.network_calls,
        "cache_hits": client.cache_hits,
        "scope": "all upstream pokemon rows; cosmetic-only pokemon-form entries without independent stats are not separate chat items",
    }
    (settings.data_dir / "catalog_report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    )
    print(json.dumps(report, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--count",
        type=int,
        default=None,
        help="개발용 기본 종 수 제한. 생략하면 원본 전체 종과 별도 능력치 폼 수집",
    )
    args = parser.parse_args()
    prepare(Settings.from_env(), args.count)
