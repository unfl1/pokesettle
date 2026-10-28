"""F2015 answer comparison; --live explicitly enables model calls."""

import argparse
import copy
import json
import re
import time
from pathlib import Path
from typing import Literal

from pydantic import Field

from backend.app.catalog import Catalog, metadata_text
from backend.app.core.config import ROOT, Settings
from backend.app.core.errors import ServiceError
from backend.app.rag.graph import build_graph
from backend.app.rag.model import StructuredModel
from backend.app.rag.prompts import GENERATION_PROMPT
from backend.app.schemas import Document, Model
from backend.app.storage import Store, digest, now

BASELINE_PROMPT = """Answer briefly in Korean using prior knowledge only, without documents, search or tools. Distinguish generic Pokédex information from verified Champions rules/eligibility; defer unknown facts. Invent no damage, KO, win rates, rules, sources or citations. Separate assumptions and unknowns. For abstained, leave claims empty and explain why in unknowns."""


class EvaluationCase(Model):
    case_id: str = Field(min_length=1)
    pokemon_id: str = Field(min_length=1)
    question: str = Field(min_length=1)
    reference_kind: Literal["metadata", "document", "unavailable"]
    reference_fields: dict = Field(default_factory=dict)
    reference_terms: list[str] = Field(default_factory=list)
    reference_document_id: str | None = None
    expected_patterns: list[str] = Field(default_factory=list)
    expected_behavior: Literal["answer", "abstain"]
    requires_external_citation: bool = False
    review_focus: str


class UncitedAnswer(Model):
    answer_status: Literal["answered", "partial", "abstained"]
    claims: list[str] = Field(max_length=5)
    assumptions: list[str]
    unknowns: list[str]


def load_cases(path):
    dataset = json.loads(Path(path).read_text())
    cases = [EvaluationCase.model_validate(c) for c in dataset["cases"]]
    if (
        len(cases) < 5
        or len({c.case_id for c in cases}) != len(cases)
        or len({" ".join(c.question.casefold().split()) for c in cases}) < 5
    ):
        raise ValueError("서로 다른 case_id와 질문 5개 이상이 필요합니다.")
    for case in cases:
        for pattern in case.expected_patterns:
            re.compile(pattern, flags=re.IGNORECASE)
    return dataset, cases


def references(cases, catalog, document_entries):
    """Verify reference fixtures against snapshots before spending model calls."""
    documents = {
        (e["pokemon_id"], e["document"]["document_id"]): e["document"] for e in document_entries
    }
    result = {}
    for case in cases:
        pokemon = catalog.get(case.pokemon_id)
        record = pokemon.model_dump(mode="json")
        if case.reference_kind == "metadata":
            for path, expected in case.reference_fields.items():
                value = record
                for part in path.split("."):
                    value = value[part]
                if value != expected:
                    raise ValueError(f"{case.case_id}: 기준 메타데이터가 변경되었습니다.")
            reference = {
                "kind": "metadata",
                "fields": case.reference_fields,
                "source_url": pokemon.source_url,
                "collected_at": pokemon.collected_at,
                "snapshot_hash": digest(record),
            }
        elif case.reference_kind == "document":
            document = Document.model_validate(
                documents[(case.pokemon_id, case.reference_document_id)]
            )
            if any(t.casefold() not in document.body.casefold() for t in case.reference_terms):
                raise ValueError(f"{case.case_id}: 기준 원문에 검토 대상 내용이 없습니다.")
            reference = {
                "kind": "document",
                "document_id": document.document_id,
                "source_url": str(document.source_url),
                "collected_at": document.collected_at,
                "revision_id": document.revision_id,
                "snapshot_hash": digest(document.model_dump(mode="json")),
                "reference_lines": [
                    line
                    for line in document.body.splitlines()
                    if any(t.casefold() in line.casefold() for t in case.reference_terms)
                ],
            }
        else:
            reference = {
                "kind": "unavailable",
                "reason": "평가 자료에 Champions 경기 통계 없음",
                "scope": "absence in this evaluation corpus, not proof of global unavailability",
            }
        reference["metadata_text_hash"] = digest(metadata_text(pokemon))
        result[case.case_id] = reference
    return result


def validate_index(cases, vectors, reference_data):
    for case in cases:
        reference = reference_data[case.case_id]
        meta = vectors.meta.get(ids=[case.pokemon_id])
        if (
            not meta["ids"]
            or meta["metadatas"][0]["content_hash"] != reference["metadata_text_hash"]
        ):
            raise ValueError(
                f"{case.case_id}: 메타 색인과 기준 스냅샷이 다릅니다. 재색인 후 실행하세요."
            )
        if case.reference_kind == "document":
            manifest = vectors.store.get(
                "manifest", f"{case.pokemon_id}:{case.reference_document_id}"
            )
            chunks = vectors.docs.get(
                where={
                    "$and": [
                        {"pokemon_id": case.pokemon_id},
                        {"document_id": case.reference_document_id},
                    ]
                }
            )
            active = set(manifest["ids"]) if manifest else set()
            matching = [
                identifier
                for identifier, metadata in zip(chunks["ids"], chunks["metadatas"])
                if identifier in active and metadata.get("revision_id") == reference["revision_id"]
            ]
            if not matching:
                raise ValueError(f"{case.case_id}: 기준 원문의 활성 색인을 확인할 수 없습니다.")


class CountedModel:
    def __init__(self, model):
        self.model, self.calls = model, 0
        self.validation_feedback = []

    def invoke(self, *args, **kwargs):
        self.calls += 1
        if len(args) > 2 and args[2].get("validation_feedback"):
            self.validation_feedback.append(args[2]["validation_feedback"])
        return self.model.invoke(*args, **kwargs)


def checks(case, answer, evidence):
    """Mechanical checks only; citation linkage is not semantic source support."""
    claims = answer.get("claims", [])
    text = "\n".join(claims) if claims else answer.get("answer", "")
    citations = answer.get("citations", [])
    by_id = {e["evidence_id"]: e for e in evidence}
    matched = [bool(re.search(p, text, re.IGNORECASE)) for p in case.expected_patterns]
    abstained = answer["answer_status"] == "abstained"
    return {
        "reference_pattern_matches": matched,
        "reference_pattern_count": len(matched),
        "matched_pattern_count": sum(matched),
        "expected_behavior_observed": (abstained and not claims)
        if case.expected_behavior == "abstain"
        else not abstained,
        "citation_count": len(citations),
        "citation_ids_valid": all(c["evidence_id"] in by_id for c in citations)
        if citations
        else None,
        "external_citation_observed": any(c.get("source_type") != "metadata" for c in citations),
        "percentage_claim_requires_review": bool(re.search(r"\d+(?:\.\d+)?\s*(?:%|퍼센트)", text)),
        "semantic_accuracy": None,
        "semantic_source_support": None,
        "review_status": "pending_manual_review",
    }


def compare(cases, vectors, model, reference_data, *, model_id):
    validate_index(cases, vectors, reference_data)
    outputs = []
    for number, case in enumerate(cases):
        row = {
            "case_id": case.case_id,
            "pokemon_id": case.pokemon_id,
            "question": case.question,
            "expected_behavior": case.expected_behavior,
            "review_focus": case.review_focus,
            "requires_external_citation": case.requires_external_citation,
            "reference": reference_data[case.case_id],
            "modes": {},
        }
        # Alternate order; no chat history is shared between questions or modes.
        order = ["no_rag", "rag"] if number % 2 == 0 else ["rag", "no_rag"]
        row["execution_order"] = order
        for mode in order:
            counted = CountedModel(model)
            started = time.perf_counter()
            try:
                evidence = []
                if mode == "rag":
                    state = build_graph(vectors, counted).invoke(
                        {"pokemon_id": case.pokemon_id, "question": case.question, "history": []}
                    )
                    raw = state["result"]
                    evidence = state["evidence"]
                    answer = {**raw, "claims": [f["text"] for f in raw["facts"]]}
                else:
                    generated = counted.invoke(
                        "generate", BASELINE_PROMPT, {"question": case.question}, UncitedAnswer
                    )
                    answer = {**generated.model_dump(mode="json"), "citations": []}
                    if (generated.answer_status == "abstained") != (not generated.claims) or any(
                        not c.strip() for c in generated.claims
                    ):
                        raise ServiceError(
                            "GENERATION_INVALID", "응답 상태와 사실 주장 형식이 일치하지 않습니다."
                        )
                row["modes"][mode] = {
                    "execution_status": "completed",
                    "answer": answer,
                    "evidence": evidence,
                    "checks": checks(case, answer, evidence),
                }
            except Exception as error:
                # Never serialize provider exceptions, API keys, or internal traces.
                row["modes"][mode] = {
                    "execution_status": "failed",
                    "error_code": error.code
                    if isinstance(error, ServiceError)
                    else "EVALUATION_FAILED",
                    "checks": None,
                }
            row["modes"][mode].update(
                elapsed_seconds=round(time.perf_counter() - started, 3),
                logical_model_invocations=counted.calls,
                validation_feedback=counted.validation_feedback,
            )
        outputs.append(row)
    summary = {}
    for mode in ("no_rag", "rag"):
        completed = [
            r["modes"][mode] for r in outputs if r["modes"][mode]["execution_status"] == "completed"
        ]
        summary[mode] = {
            "completed": len(completed),
            "failed": len(outputs) - len(completed),
            "expected_behavior_observed": sum(
                r["checks"]["expected_behavior_observed"] for r in completed
            ),
            "matched_reference_patterns": sum(
                r["checks"]["matched_pattern_count"] for r in completed
            ),
            "reference_pattern_count": sum(
                r["checks"]["reference_pattern_count"] for r in completed
            ),
            "answers_with_citations": sum(r["checks"]["citation_count"] > 0 for r in completed),
        }
    return {
        "verified_at": now(),
        "model_id": model_id,
        "temperature": 0,
        "case_count": len(cases),
        "retrieval": vectors.retrieval_settings,
        "prompt_hashes": {"rag": digest(GENERATION_PROMPT), "no_rag": digest(BASELINE_PROMPT)},
        "summary": summary,
        "cases": outputs,
        "limitations": [
            "Reference-pattern matches are lexical checks, not factual accuracy scores.",
            "Valid citation IDs do not prove semantic support; manual review is pending.",
            "No-RAG has no citations by design and receives only the exact user question.",
            "RAG uses the production prompt/schema/citation validation; baseline prompt/schema differ.",
            "Same model ID and temperature do not guarantee deterministic provider behavior.",
            "Elapsed time includes RAG retrieval/validation; logical invocation counts exclude hidden provider retries.",
            "This is a small generic reference evaluation, not Champions mechanics verification.",
        ],
    }


def review_template(report):
    return {
        "report_fingerprint": digest(report),
        "reviewer": "",
        "reviewer_kind": "human",
        "reviews": [
            {
                "case_id": row["case_id"],
                "mode": mode,
                "accuracy": None,
                "citation_support": None,
                "abstention_quality": None,
                "notes": "",
            }
            for row in report["cases"]
            for mode, value in row["modes"].items()
            if value["execution_status"] == "completed"
        ],
    }


def apply_review(report, review):
    if review.get("report_fingerprint") != digest(report):
        raise ValueError("검토 파일과 실행 보고서의 fingerprint가 다릅니다.")
    if not review.get("reviewer") or review.get("reviewer_kind") not in {
        "human",
        "assistant_source_audit",
    }:
        raise ValueError("검토자와 검토 유형을 명시하세요.")
    expected = {
        (r["case_id"], mode)
        for r in report["cases"]
        for mode, v in r["modes"].items()
        if v["execution_status"] == "completed"
    }
    actual = [(r["case_id"], r["mode"]) for r in review["reviews"]]
    if len(actual) != len(set(actual)) or set(actual) != expected:
        raise ValueError("검토 항목이 누락·중복되었거나 실행 결과와 다릅니다.")
    allowed = {None, "correct", "partial", "incorrect", "not_applicable"}
    for item in review["reviews"]:
        for field in ("accuracy", "citation_support", "abstention_quality"):
            if item.get(field) not in allowed:
                raise ValueError("지원하지 않는 검토 판정입니다.")
    result = copy.deepcopy(report)
    result["review"] = review
    result["review_summary"] = {}
    for mode in ("no_rag", "rag"):
        items = [r for r in review["reviews"] if r["mode"] == mode]
        result["review_summary"][mode] = {
            field: {
                label or "unreviewed": sum(r.get(field) == label for r in items)
                for label in (None, "correct", "partial", "incorrect", "not_applicable")
            }
            for field in ("accuracy", "citation_support", "abstention_quality")
        }
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cases", type=Path, default=ROOT / "data/evaluation/rag_cases.json")
    parser.add_argument("--output", type=Path)
    parser.add_argument("--live", action="store_true", help="현재 설정한 모델 공급자 호출")
    parser.add_argument("--report", type=Path, help="기존 실행 결과, --review와 함께 사용")
    parser.add_argument("--review", type=Path, help="기존 실행 결과에 연결할 검토 JSON")
    args = parser.parse_args()
    if args.report or args.review:
        if not args.report or not args.review or args.live:
            parser.error("--report·--review를 함께 사용하고 --live는 제외하세요.")
        report = json.loads(args.report.read_text())
        reviewed = apply_review(report, json.loads(args.review.read_text()))
        output = args.output or args.report.with_suffix(".reviewed.json")
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(reviewed, ensure_ascii=False, indent=2) + "\n")
        print(
            json.dumps(
                {
                    "reviewer_kind": reviewed["review"]["reviewer_kind"],
                    "review_summary": reviewed["review_summary"],
                },
                ensure_ascii=False,
            )
        )
        raise SystemExit(0)
    settings = Settings.from_env()
    dataset, cases = load_cases(args.cases)
    catalog = Catalog(settings.data_dir / "pokemon.json")
    document_entries = json.loads((settings.data_dir / "documents/species.json").read_text())
    reference_data = references(cases, catalog, document_entries)
    if not args.live:
        print(
            json.dumps(
                {
                    "execution_status": "not_run",
                    "case_count": len(cases),
                    "reference_snapshots_checked": True,
                    "next": "--live 옵션으로 실제 모델 비교 실행",
                },
                ensure_ascii=False,
            )
        )
    else:
        if not settings.model_configured:
            raise SystemExit("모델 키·CHAT_MODEL 설정 필요")
        from backend.app.rag.vector_store import VectorStore

        vectors = VectorStore(settings, Store(settings.database_url, settings.database_schema))
        from backend.app.core.usage import UsageGuard

        guard = UsageGuard(Store(settings.database_url, settings.database_schema), settings)
        with guard.scope(guard.begin(["local-answer-comparison"])):
            report = compare(
                cases, vectors, StructuredModel(settings), reference_data, model_id=settings.chat_model
            )
        report.update(dataset_version=dataset["version"], dataset_hash=digest(dataset))
        output = args.output or settings.runtime_dir / "answer_comparison.json"
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
        output.with_suffix(".review.json").write_text(
            json.dumps(review_template(report), ensure_ascii=False, indent=2) + "\n"
        )
        print(
            json.dumps(
                {"case_count": report["case_count"], "summary": report["summary"]},
                ensure_ascii=False,
            )
        )
        if any(v["failed"] for v in report["summary"].values()):
            raise SystemExit(1)
