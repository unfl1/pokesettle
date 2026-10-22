"""Opt-in live Phase 2 integration; stores counts and checks, never keys or full answers."""

import argparse
import json
import time
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import requests


def verify(base_url):
    client = requests.Session()

    def get(path):
        response = client.get(f"{base_url}{path}", timeout=30)
        response.raise_for_status()
        return response.json()["data"]

    def post(path, body):
        response = client.post(f"{base_url}{path}", json=body, timeout=180)
        response.raise_for_status()
        return response.json()["data"]

    status = get("/api/status")
    assert status["ready"], "Backend must be configured and indexed"
    post("/api/session", {})
    discovery = post(
        "/api/pokemon/search",
        {"query": "전기 타입이고 스피드 종족값이 90 이상인 포켓몬", "limit": 100},
    )
    assert discovery["status"] == "matched" and discovery["items"]
    assert all(
        "electric" in p["types"] and p["baseStats"]["speed"] >= 90 for p in discovery["items"]
    )
    catalog = json.loads(Path("data/pokemon.json").read_text())
    expected = {
        p["pokemon_id"]
        for p in catalog
        if "electric" in p["types"] and p["base_stats"]["speed"] >= 90
    }
    assert {p["pokemonId"] for p in discovery["items"]} == expected
    vague = post("/api/pokemon/search", {"query": "빠르고 땅 공격을 무효로 하는 포켓몬"})
    assert vague["status"] == "needs_clarification" and not vague["items"]
    job = post("/api/pokemon/pokemon:25/guide", {"clientRequestId": str(uuid4())})
    stages = set()
    deadline = time.monotonic() + 240
    while time.monotonic() < deadline:
        data = get(job["statusUrl"])
        stages.add(data["stage"])
        if data["status"] in {"completed", "failed", "interrupted"}:
            break
        time.sleep(0.5)
    assert data["status"] == "completed", data.get("error", {}).get("code")
    result = data["result"]
    assert result["feature"] == "pokemon_guide" and result["citations"]
    assert result["guideScope"] == "generic_reference"
    history = get(f"/api/conversations/{result['conversationId']}/messages")
    assert history["total"] == 2 and history["items"][1]["content"]["feature"] == "pokemon_guide"
    other = post("/api/conversations", {"pokemonId": "pokemon:1"})
    assert get(f"/api/conversations/{other['conversationId']}/messages")["total"] == 0
    assert get(f"/api/conversations/{result['conversationId']}/messages")["total"] == 2
    return {
        "verified_at": datetime.now(timezone.utc).isoformat(),
        "metadata_count": status["metadataCount"],
        "conditional_search": {
            "matched_count": discovery["total"],
            "exact_set_matches_catalog": True,
            "ambiguous_and_unsupported_clarified": True,
        },
        "guide": {
            "status": result["answerStatus"],
            "citation_count": len(result["citations"]),
            "unknown_count": len(result["unknowns"]),
            "scope": result["guideScope"],
            "persisted": True,
        },
        "observed_stages": sorted(stages),
        "a_b_a_history_isolated": True,
        "limitations": [
            "Generic PokéAPI reference only; Champions mechanics and eligibility unknown.",
            "Counts and structural checks do not certify every generated statement.",
        ],
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--live", action="store_true", help="Authorize configured model calls")
    args = parser.parse_args()
    if not args.live:
        parser.error("--live is required; this check calls the configured model")
    evidence = verify(args.base_url.rstrip("/"))
    output = Path("docs/evidence/phase2.json")
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(evidence, ensure_ascii=False, indent=2))
