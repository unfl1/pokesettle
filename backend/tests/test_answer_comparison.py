import copy
import json

import pytest

from backend.app.schemas import Generation
from backend.app.storage import digest
from backend.scripts.compare_answers import (
    EvaluationCase,
    UncitedAnswer,
    apply_review,
    compare,
    load_cases,
    references,
    review_template,
)
from backend.tests.conftest import document


def cases():
    result = []
    for index in range(5):
        missing = index == 4
        result.append(
            EvaluationCase(
                case_id=f"case-{index}",
                pokemon_id="pokemon:1",
                question="unknown" if missing else f"test question {index}",
                reference_kind="unavailable" if missing else "metadata",
                reference_fields={} if missing else {"types": ["test-type"]},
                expected_patterns=[] if missing else ["test-type"],
                expected_behavior="abstain" if missing else "answer",
                review_focus="TEST fixture only",
            )
        )
    return result


class ComparisonModel:
    def __init__(self):
        self.calls = []

    def invoke(self, purpose, system, payload, schema):
        self.calls.append((purpose, payload, schema))
        missing = payload["question"] == "unknown"
        status = "abstained" if missing else "answered"
        if schema is UncitedAnswer:
            return UncitedAnswer(
                answer_status=status,
                claims=[] if missing else ["test-type"],
                assumptions=[],
                unknowns=["unknown"] if missing else [],
            )
        return Generation(
            answer_status=status,
            claims=[]
            if missing
            else [{"text": "test-type", "evidence_ids": [payload["evidence"][0]["evidence_id"]]}],
            assumptions=[],
            unknowns=["unknown"] if missing else [],
        )


def run_comparison(setup):
    data = cases()
    model = ComparisonModel()
    refs = references(data, setup.catalog, [])
    report = compare(data, setup.vectors, model, refs, model_id="synthetic-model-not-live")
    return model, report


def test_baseline_has_no_evidence_reference_or_history_and_uses_same_generation_purpose(setup):
    model, report = run_comparison(setup)
    baseline = [payload for _, payload, schema in model.calls if schema is UncitedAnswer]
    assert len(baseline) == 5 and all(set(payload) == {"question"} for payload in baseline)
    assert all(purpose == "generate" for purpose, _, _ in model.calls)
    assert all(
        payload.get("history_for_interpretation_only", []) == [] for _, payload, _ in model.calls
    )
    assert report["cases"][0]["execution_order"] == ["no_rag", "rag"]
    assert report["cases"][1]["execution_order"] == ["rag", "no_rag"]
    assert report["summary"]["rag"]["completed"] == report["summary"]["no_rag"]["completed"] == 5
    assert report["summary"]["rag"]["answers_with_citations"] == 4
    assert report["summary"]["no_rag"]["answers_with_citations"] == 0
    assert report["summary"]["rag"]["expected_behavior_observed"] == 5
    assert all(
        row["modes"]["rag"]["checks"]["semantic_accuracy"] is None for row in report["cases"]
    )


def test_failures_are_reported_without_raw_provider_secrets_or_false_abstention(setup):
    class BrokenModel:
        def invoke(self, *args, **kwargs):
            raise RuntimeError("SECRET_TEST_KEY raw provider URL and traceback")

    data = cases()
    report = compare(
        data, setup.vectors, BrokenModel(), references(data, setup.catalog, []), model_id="test"
    )
    assert "SECRET_TEST_KEY" not in json.dumps(report)
    assert report["summary"]["rag"]["failed"] == report["summary"]["no_rag"]["failed"] == 5
    assert report["summary"]["rag"]["expected_behavior_observed"] == 0
    assert all(r["modes"]["rag"]["checks"] is None for r in report["cases"])


def test_invalid_baseline_claim_status_is_not_counted_as_completed(setup):
    class InconsistentModel(ComparisonModel):
        def invoke(self, purpose, system, payload, schema):
            if schema is UncitedAnswer:
                return UncitedAnswer(
                    answer_status="answered", claims=[], assumptions=[], unknowns=[]
                )
            return super().invoke(purpose, system, payload, schema)

    data = cases()
    report = compare(
        data,
        setup.vectors,
        InconsistentModel(),
        references(data, setup.catalog, []),
        model_id="test",
    )
    assert report["summary"]["no_rag"]["failed"] == 5
    assert report["summary"]["rag"]["completed"] == 5


def test_reference_snapshot_mismatch_and_missing_document_terms_are_rejected(setup):
    data = cases()
    wrong = data[0].model_copy(update={"reference_fields": {"base_stats.speed": 999}})
    with pytest.raises(ValueError, match="기준 메타데이터"):
        references([wrong], setup.catalog, [])
    doc = document()
    external = data[0].model_copy(
        update={
            "reference_kind": "document",
            "reference_document_id": doc.document_id,
            "reference_terms": ["not in reference body"],
        }
    )
    with pytest.raises(ValueError, match="기준 원문"):
        references(
            [external],
            setup.catalog,
            [{"pokemon_id": "pokemon:1", "document": doc.model_dump(mode="json")}],
        )


def test_cases_require_at_least_five_unique_questions_identifiers(tmp_path):
    path = tmp_path / "cases.json"
    data = [c.model_dump(mode="json") for c in cases()]
    path.write_text(json.dumps({"cases": data[:4]}))
    with pytest.raises(ValueError, match="5개 이상"):
        load_cases(path)
    data[-1]["case_id"] = data[0]["case_id"]
    path.write_text(json.dumps({"cases": data}))
    with pytest.raises(ValueError, match="5개 이상"):
        load_cases(path)


def test_review_requires_matching_fingerprint_and_complete_nonduplicate_rows(setup):
    _, report = run_comparison(setup)
    review = review_template(report)
    review.update(reviewer="Test reviewer", reviewer_kind="human")
    result = apply_review(report, review)
    assert result["review_summary"]["rag"]["accuracy"]["unreviewed"] == 5
    wrong = copy.deepcopy(review)
    wrong["report_fingerprint"] = digest("different run")
    with pytest.raises(ValueError, match="fingerprint"):
        apply_review(report, wrong)
    wrong = copy.deepcopy(review)
    wrong["reviews"][-1] = wrong["reviews"][0]
    with pytest.raises(ValueError, match="누락·중복"):
        apply_review(report, wrong)


def test_assistant_audit_remains_distinct_from_human_review(setup):
    _, report = run_comparison(setup)
    review = review_template(report)
    review.update(reviewer="TEST source audit", reviewer_kind="assistant_source_audit")
    for item in review["reviews"]:
        item.update(
            accuracy="correct",
            citation_support="not_applicable",
            abstention_quality="not_applicable",
        )
    result = apply_review(report, review)
    assert result["review"]["reviewer_kind"] == "assistant_source_audit"
    assert result["review_summary"]["no_rag"]["accuracy"]["correct"] == 5
    assert report["cases"][0]["modes"]["rag"]["checks"]["semantic_accuracy"] is None


def test_stale_index_is_rejected_before_model_calls(setup):
    data = cases()
    refs = references(data, setup.catalog, [])
    refs[data[0].case_id]["metadata_text_hash"] = "different reference"
    model = ComparisonModel()
    with pytest.raises(ValueError, match="메타 색인"):
        compare(data, setup.vectors, model, refs, model_id="test")
    assert model.calls == []


def test_missing_active_document_index_is_rejected_before_model_calls(setup):
    doc = document()
    data = cases()
    data[0] = data[0].model_copy(
        update={
            "reference_kind": "document",
            "reference_document_id": doc.document_id,
            "reference_terms": ["alpha"],
        }
    )
    refs = references(
        data, setup.catalog, [{"pokemon_id": "pokemon:1", "document": doc.model_dump(mode="json")}]
    )
    model = ComparisonModel()
    with pytest.raises(ValueError, match="활성 색인"):
        compare(data, setup.vectors, model, refs, model_id="test")
    assert model.calls == []


def test_rag_validation_feedback_is_available_for_diagnosis_without_disabling_guard(setup):
    class CorrectingModel(ComparisonModel):
        def invoke(self, purpose, system, payload, schema):
            if (
                schema is not UncitedAnswer
                and payload["question"] != "unknown"
                and not payload.get("validation_feedback")
            ):
                return Generation(
                    answer_status="answered",
                    claims=[{"text": "test", "evidence_ids": ["invalid-id"]}],
                    assumptions=[],
                    unknowns=[],
                )
            return super().invoke(purpose, system, payload, schema)

    data = cases()
    report = compare(
        data, setup.vectors, CorrectingModel(), references(data, setup.catalog, []), model_id="test"
    )
    row = report["cases"][0]["modes"]["rag"]
    assert row["execution_status"] == "completed"
    assert row["logical_model_invocations"] == 2
    assert len(row["validation_feedback"]) == 1
    assert "유효하지 않은 근거" in row["validation_feedback"][0]
