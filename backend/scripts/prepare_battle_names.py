"""Prepare source-backed Korean item/nature names; no battle mechanics inferred."""

import csv
import io
import json

from backend.app.core.config import Settings
from backend.app.data_preparation.pokeapi import LICENCE_URL
from backend.app.http_client import SourceClient
from backend.app.storage import Store
from backend.scripts.prepare_data import CSV_ROOT

TABLES = ("items", "item_names", "natures", "nature_names")


def build_names(tables, sources):
    result = {
        "sources": sources,
        "licence_url": LICENCE_URL,
        "scope": "Korean name translations only; not Champions eligibility or mechanics",
    }
    for resource, key in (("item", "held_item"), ("nature", "stat_alignment")):
        korean = {
            row[f"{resource}_id"]: row["name"]
            for row in tables[f"{resource}_names"]
            if row["local_language_id"] == "3" and row["name"]
        }
        result[key] = {
            row["identifier"]: korean[row["id"]]
            for row in tables[f"{resource}s"]
            if row["id"] in korean
        }
    return result


def prepare(settings):
    client = SourceClient(settings, Store(settings.database_url, settings.database_schema))
    tables, sources = {}, []
    for name in TABLES:
        snapshot = client.fetch(f"{CSV_ROOT}/{name}.csv", expect_json=False)
        if not snapshot:
            raise ValueError(f"Missing source: {name}")
        tables[name] = list(csv.DictReader(io.StringIO(snapshot["body"])))
        sources.append({key: snapshot[key] for key in ("url", "collected_at", "content_hash")})
    path = settings.data_dir / "battle_names.json"
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(build_names(tables, sources), ensure_ascii=False, indent=2) + "\n")
    temporary.replace(path)


if __name__ == "__main__":
    prepare(Settings.from_env())
