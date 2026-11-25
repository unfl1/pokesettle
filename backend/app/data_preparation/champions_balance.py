"""Official Champions balance announcements, kept apart from catalog snapshots."""

import json
import re


def load_balance_notice(data_dir):
    path = data_dir / "champions_balance.json"
    return json.loads(path.read_text(encoding="utf-8")) if path.is_file() else None


def matching_updates(notice, question, pokemon_id):
    if not notice:
        return []
    return [
        update for update in notice["updates"]
        if (pokemon_id is not None and update.get("pokemon_id") == pokemon_id)
        or any(
            re.search(r"(?<![a-z0-9])" + re.escape(alias) + r"(?![a-z0-9])", question, re.I)
            for alias in update["aliases"]
        )
    ]


def balance_evidence(notice, updates):
    if not updates:
        return []
    return [{
        "evidence_id": notice["document_id"],
        "document_id": notice["document_id"],
        "title": "Pokémon Champions — 2026-12-02 Battle Balance Adjustments",
        "source_type": "web",
        "source_url": notice["source_url"],
        "collected_at": notice["collected_at"],
        "game": "champions",
        "verification_status": "verified",
        "text": (
            f"Official balance changes scheduled during maintenance on {notice['maintenance_date']}, "
            "for all Pokémon Champions regulations. Values to the left of the arrow are pre-patch; "
            "values to the right and newly available moves apply after the patch. "
            "This announcement does not confirm maintenance completion, a specific move acquisition method, "
            "or any species' ranked eligibility.\n"
            + "\n".join(" / ".join(update["summary"].values()) for update in updates)
        ),
    }]


def profile_balance_notice(notice, pokemon_id, learnset):
    if not notice:
        return None
    move_slugs = {move["name_en"] for move in learnset["moves"]} if learnset else set()
    summaries = [
        update["summary"] for update in notice["updates"]
        if update.get("pokemon_id") == pokemon_id
        or (
            learnset
            and learnset["version_group"] == "champions"
            and update.get("move_slug") in move_slugs
        )
    ]
    if summaries:
        return {
            "maintenance_date": notice["maintenance_date"],
            "source_url": notice["source_url"],
            "summaries": summaries,
        }
    return None
