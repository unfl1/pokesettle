"""Compare similarity/MMR on the same index; no external source fetches or model API calls."""

import argparse
import json
import time
from dataclasses import replace
from pathlib import Path

import numpy as np

from backend.app.core.config import Settings
from backend.app.rag.vector_store import VectorStore
from backend.app.storage import Store, digest, now

DEFAULT_CASES = [
    {
        "pokemon_id": "pokemon:25",
        "expected_terms": ["cheek", "tail"],
        "query": "What do the entries say about Pikachu's cheeks and tail?",
    },
    {
        "pokemon_id": "pokemon:1",
        "expected_terms": ["seed", "grow"],
        "query": "What do the entries say about Bulbasaur's seed and growth?",
    },
    {
        "pokemon_id": "pokemon:6",
        "expected_terms": ["wing", "fire"],
        "query": "What do the entries say about Charizard's wings and fire?",
    },
    {
        "pokemon_id": "pokemon:94",
        "expected_terms": ["shadow", "hid"],
        "query": "What do the entries say about Gengar's shadows and hiding?",
    },
    {
        "pokemon_id": "pokemon:445",
        "expected_terms": ["wing", "speed"],
        "query": "What do the entries say about Garchomp's movement and flying?",
    },
]


def cosine_metrics(query, embeddings):
    if not embeddings:
        return {"mean_query_cosine": None, "mean_pairwise_cosine": None}
    matrix = np.asarray(embeddings, dtype=np.float64)
    matrix /= np.maximum(np.linalg.norm(matrix, axis=1, keepdims=True), 1e-12)
    query = np.asarray(query, dtype=np.float64)
    query /= max(float(np.linalg.norm(query)), 1e-12)
    pairwise = (matrix @ matrix.T)[np.triu_indices(len(matrix), k=1)]
    return {
        "mean_query_cosine": round(float((matrix @ query).mean()), 6),
        "mean_pairwise_cosine": round(float(pairwise.mean()), 6) if len(pairwise) else None,
    }


def compare(vectors, cases):
    if not cases or any(
        not isinstance(c.get("pokemon_id"), str)
        or not isinstance(c.get("query"), str)
        or not c["query"].strip()
        for c in cases
    ):
        raise ValueError("비교 항목에는 pokemon_id·비어 있지 않은 query가 필요합니다.")
    # Share the exact query vector and exclude embedding warm-up from search timings.
    queries = list(dict.fromkeys(case["query"] for case in cases))
    cache = dict(zip(queries, vectors.embed(queries)))
    engines = {
        mode: VectorStore(
            replace(vectors.settings, search_mode=mode),
            vectors.store,
            embed=lambda texts: [cache[text] for text in texts],
            embedding_identity=vectors.embedding_identity,
        )
        for mode in ("similarity", "mmr")
    }
    results = []
    for case in cases:
        pokemon_id, query = case["pokemon_id"], case["query"]
        snapshot = vectors.docs.get(where={"pokemon_id": pokemon_id})
        row = {
            **case,
            "index_fingerprint": digest([snapshot["ids"], snapshot["metadatas"]]),
            "modes": {},
        }
        for mode, engine in engines.items():
            started = time.perf_counter()
            found = engine.retrieve(pokemon_id, query, case.get("regulation_id"))
            seconds = time.perf_counter() - started
            if found[0]["evidence_id"] != pokemon_id or len(found) > engine.settings.top_k:
                raise AssertionError("선택 메타·Top-k 불변 조건 위반")
            if any(e["pokemon_id"] != pokemon_id for e in found):
                raise AssertionError("다른 포켓몬의 근거 포함")
            external = found[1:]
            terms = case.get("expected_terms", [])
            if not isinstance(terms, list) or any(
                not isinstance(t, str) or not t.strip() for t in terms
            ):
                raise ValueError("expected_terms는 비어 있지 않은 문자열 배열이어야 합니다.")
            text = "\n".join(e["text"] for e in external).casefold()
            covered = [term for term in terms if term.casefold() in text]
            selected = vectors.docs.get(
                ids=[e["evidence_id"] for e in external], include_embeddings=True
            )
            row["modes"][mode] = {
                "evidence_ids": [e["evidence_id"] for e in found],
                "external_count": len(external),
                "covered_expected_terms": covered,
                "expected_term_coverage": len(covered) / len(terms) if terms else None,
                "unique_document_count": len({e["document_id"] for e in external}),
                "search_seconds_excluding_embedding": round(seconds, 6),
                **cosine_metrics(cache[query], selected["embeddings"]),
            }
        after_snapshot = vectors.docs.get(where={"pokemon_id": pokemon_id})
        if digest([after_snapshot["ids"], after_snapshot["metadatas"]]) != row["index_fingerprint"]:
            raise ValueError("비교 중 색인이 변경되었습니다. 색인 쓰기를 중지하고 다시 실행하세요.")
        before = row["modes"]["similarity"]["evidence_ids"]
        after = row["modes"]["mmr"]["evidence_ids"]
        row["order_changed"] = before != after
        row["selection_changed"] = set(before) != set(after)
        results.append(row)
    return {
        "verified_at": now(),
        "embedding_identity": vectors.embedding_identity,
        "settings": vectors.retrieval_settings,
        "case_count": len(results),
        "selection_changed_cases": sum(r["selection_changed"] for r in results),
        "order_changed_cases": sum(r["order_changed"] for r in results),
        "cases": results,
        "limitations": [
            "Cosine metrics measure embedding similarity/redundancy, not factual accuracy or probabilities.",
            "Expected-term coverage is a lexical proxy over external chunks, not a human relevance judgment.",
            "No generated answers, external collection, or model API calls; not an F2015 RAG/no-RAG evaluation.",
            "Timing excludes query embedding and includes database access; no latency guarantee.",
        ],
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cases", type=Path, help="pokemon_id·query·선택 regulation_id 배열 JSON")
    parser.add_argument("--output", type=Path, help="기본 runtime/retrieval_comparison.json")
    args = parser.parse_args()
    settings = Settings.from_env()
    vectors = VectorStore(settings, Store(settings.database_url, settings.database_schema))
    cases = json.loads(args.cases.read_text()) if args.cases else DEFAULT_CASES
    report = compare(vectors, cases)
    output = args.output or settings.runtime_dir / "retrieval_comparison.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(
        json.dumps(
            {
                k: report[k]
                for k in ("case_count", "selection_changed_cases", "order_changed_cases")
            },
            ensure_ascii=False,
        )
    )
