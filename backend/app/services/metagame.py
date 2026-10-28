"""Temporary, bounded Champions singles data for the application's meta screen."""

import json
import math
import re
import threading
import time
from datetime import datetime, timezone

import requests

from backend.app.core.errors import ServiceError

SOURCE_URL = "https://championsbattledata.com"
TERMS_URL = f"{SOURCE_URL}/api-rules/"
ATTRIBUTION = "Battle data provided by Pokémon Champions Battle Data"
CATEGORIES = ("move", "held_item", "ability", "stat_alignment")


def name_key(value):
    return re.sub(r"[^a-z0-9]", "", value.lower())


def positive_int(value):
    return type(value) is int and value > 0


def percentage(value):
    if type(value) not in (int, float) or not math.isfinite(value) or not 0 <= value <= 100:
        return None
    return value


class MetagameService:
    # No persistent mirror or historical archive. A failed refresh has a short cooldown.
    ttl = 6 * 60 * 60
    max_age = 24 * 60 * 60
    retry_delay = 60

    def __init__(self):
        self.lock = threading.Lock()
        self.cached = None
        self.cached_at = 0.0
        self.retry_at = 0.0

    def _fetch(self, path):
        # Paths are generated from validated provider fields; never accept user URLs.
        with requests.get(
            SOURCE_URL + path,
            headers={"User-Agent": "PokeSettle/0.2 (https://github.com/unfl1/poketact)"},
            timeout=(5, 15),
            allow_redirects=False,
            stream=True,
        ) as response:
            if response.status_code != 200:
                raise ValueError("Provider unavailable")
            chunks, size = [], 0
            for chunk in response.iter_content(65536):
                size += len(chunk)
                if size > 2_000_000:
                    raise ValueError("Provider response too large")
                chunks.append(chunk)
            return json.loads(b"".join(chunks))

    def _load(self):
        index = self._fetch("/data/meta/index.json")
        candidates = []
        for season in index["seasons"]:
            if not re.fullmatch(r"M[0-9]{1,4}", season["season"]):
                continue
            if "Singles" not in season["formats"]:
                continue
            for date in season["dates"]:
                parsed = datetime.strptime(date, "%d_%m_%Y")
                if parsed.strftime("%d_%m_%Y") == date:
                    candidates.append((parsed, season["season"], date))
        _, season, date = max(candidates)
        path = f"/data/meta/{season}/{date}/Singles.json"
        snapshot = self._fetch(path)
        if (snapshot["season"], snapshot["date"], snapshot["format"]) != (season, date, "Singles"):
            raise ValueError("Mismatched snapshot")
        items = []
        for name, row in snapshot["pokemon"].items():
            if not positive_int(row.get("position")):
                continue
            sets = {}
            for category in CATEGORIES:
                values = []
                for entry in row.get(category, []):
                    if len(entry) < 3 or not isinstance(entry[0], str) or not positive_int(entry[-1]):
                        raise ValueError("Invalid set row")
                    values.append({"name": entry[0], "rank": entry[-1], "percentage": percentage(entry[1])})
                sets[category] = sorted(values, key=lambda x: x["rank"])[:5]
            items.append({"name_en": name, "rank": row["position"], "sets": sets})
        if not items:
            raise ValueError("Empty ranking")
        return {
            "items": sorted(items, key=lambda x: (x["rank"], x["name_en"])),
            "season": season,
            "data_date": datetime.strptime(date, "%d_%m_%Y").date().isoformat(),
            "provider_generated_at": snapshot.get("generatedAt"),
            "collected_at": datetime.now(timezone.utc).isoformat(),
            "source_url": SOURCE_URL,
            "terms_url": TERMS_URL,
            "attribution": ATTRIBUTION,
            "format": "Singles",
            "regulation_id": None,
        }

    def singles(self, catalog, limit=30):
        with self.lock:
            current = time.monotonic()
            age = current - self.cached_at
            stale = False
            if not self.cached or age >= self.ttl:
                if current >= self.retry_at:
                    try:
                        result = self._load()
                    except (requests.RequestException, ValueError, KeyError, TypeError, IndexError, AttributeError):
                        self.retry_at = time.monotonic() + self.retry_delay
                    else:
                        self.cached = result
                        self.cached_at = time.monotonic()
                        self.retry_at = 0
                age = time.monotonic() - self.cached_at
                if not self.cached or age >= self.max_age:
                    self.cached = None
                    raise ServiceError("META_UNAVAILABLE", "메타 데이터를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.", 503, True)
                stale = age >= self.ttl
            data = self.cached
            # Exact normalized form names only; never collapse to a base species.
            names = {name_key(p.name_en): p for p in catalog.items.values()}
            translations = {
                "move": {name_key(m["name"]): m.get("name_ko") for m in catalog.details.get("move_details", [])},
                "ability": {name_key(k): v for k, v in catalog.details.get("ability_names", {}).items()},
                **{
                    category: {name_key(k): v for k, v in catalog.battle_names.get(category, {}).items()}
                    for category in ("held_item", "stat_alignment")
                },
            }
            items = []
            for row in data["items"][:limit]:
                pokemon = names.get(name_key(row["name_en"]))
                groups = []
                for category, entries in row["sets"].items():
                    groups.append({"category": category, "items": [
                        {**entry, "name_ko": translations.get(category, {}).get(name_key(entry["name"]))}
                        for entry in entries
                    ]})
                items.append({
                    "name_en": row["name_en"], "name_ko": pokemon.name_ko if pokemon else None,
                    "pokemon_id": pokemon.pokemon_id if pokemon else None,
                    "images": pokemon.images.model_dump(mode="json") if pokemon and pokemon.images else None,
                    "rank": row["rank"], "groups": groups,
                })
            return {
                **data, "items": items, "stale": stale, "limit": limit,
                "name_sources": catalog.battle_names.get("sources", []),
                "name_licence_url": catalog.battle_names.get("licence_url"),
            }
