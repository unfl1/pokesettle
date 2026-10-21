import re
from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from backend.errors import ServiceError
from backend.models import Generation
from backend.rag.prompts import GENERATION_PROMPT
from backend.rag.retriever import retrieve


class RagState(TypedDict, total=False):
    pokemon_id: str
    question: str
    retrieval_query: str
    regulation_id: str | None
    history: list
    evidence: list
    result: dict


def render_answer(generated, evidence, regulation_id):
    by_id = {item["evidence_id"]: item for item in evidence}
    if generated.answer_status == "abstained":
        if generated.claims:
            raise ServiceError("GENERATION_INVALID", "유보 응답의 형식이 올바르지 않습니다.")
    elif not generated.claims:
        raise ServiceError("GENERATION_INVALID", "주장에 근거가 없습니다.")
    used, sentences, facts = {}, [], []
    for claim in generated.claims:
        if re.search(r"\[근거|https?://", claim.text):
            raise ServiceError("GENERATION_INVALID", "인용 표식은 서버에서만 생성할 수 있습니다.")
        ids = list(dict.fromkeys(claim.evidence_ids))
        if not ids or any(eid not in by_id for eid in ids):
            raise ServiceError("GENERATION_INVALID", "답변에 유효하지 않은 근거가 있습니다.")
        selected = [by_id[eid] for eid in ids]
        available_versions = {
            version
            for item in selected
            for version in re.findall(r"Description \([^,\n]+, ([a-z0-9-]+)\):", item["text"])
        }
        if any(version not in available_versions for version in claim.source_versions):
            raise ServiceError(
                "GENERATION_INVALID", "인용 본문에서 게임 버전을 확인할 수 없습니다."
            )
        version_notice = (
            (" (원문 버전: " + ", ".join(dict.fromkeys(claim.source_versions)) + ")")
            if claim.source_versions
            else ""
        )
        for item in selected:
            used[item["evidence_id"]] = item
        sentences.append(
            claim.text
            + version_notice
            + " "
            + " ".join(f"[근거 {item['number']}]" for item in selected)
        )
        facts.append(
            {
                "text": claim.text,
                "verification_status": "unknown"
                if any(e.get("verification_status") != "verified" for e in selected)
                else "verified",
                "origin": "source",
                "scope": selected[0].get("game", "generic"),
                "evidence_ids": ids,
            }
        )
    citations = []
    for item in sorted(used.values(), key=lambda e: e["number"]):
        citations.append(
            {
                key: item.get(key)
                for key in [
                    "evidence_id",
                    "number",
                    "document_id",
                    "title",
                    "source_type",
                    "source_url",
                    "pokemon_id",
                    "revision_id",
                    "collected_at",
                    "licence",
                    "game",
                    "battle_format",
                    "regulation_id",
                ]
            }
        )
    return {
        "answer_status": generated.answer_status,
        "answer": "\n\n".join(sentences) or "수집된 문서에서 확인되지 않습니다.",
        "facts": facts,
        "assumptions": [
            {
                "text": value,
                "reason": "모델이 명시한 가정이며 검증된 사실이 아님",
                "affected_fields": [],
            }
            for value in generated.assumptions
        ],
        "unknowns": [
            {"field": "answer", "reason": value, "required_for": "질의응답"}
            for value in generated.unknowns
        ],
        "calculation": {
            "status": "not_requested",
            "engine_version": None,
            "ruleset_version": None,
            "inputs": None,
            "outputs": None,
            "limitations": [],
        },
        "citations": citations,
        "citation_notice": None if citations else "이 답변에 인용된 근거가 없습니다.",
        "regulation_id": regulation_id,
    }


def build_graph(vector_store, model, stage=lambda _: None):
    def retrieve_node(state):
        stage("retrieving")
        return {
            "evidence": retrieve(
                vector_store,
                state["pokemon_id"],
                state.get("retrieval_query") or state["question"],
                state.get("regulation_id"),
            )
        }

    def generate_node(state):
        stage("generating")
        if not state["evidence"]:
            output = Generation(
                answer_status="abstained", claims=[], assumptions=[], unknowns=["검색된 근거 없음"]
            )
        else:
            payload = {
                "question": state["question"],
                "history_for_interpretation_only": state.get("history", []),
                "regulation_id": state.get("regulation_id"),
                "evidence": state["evidence"],
                "allowed_versions_by_evidence": {
                    item["evidence_id"]: sorted(
                        set(re.findall(r"Description \([^,\n]+, ([a-z0-9-]+)\):", item["text"]))
                    )
                    for item in state["evidence"]
                },
            }
            for attempt in range(2):
                output = model.invoke("generate", GENERATION_PROMPT, payload, Generation)
                stage("validating_citations")
                try:
                    return {
                        "result": render_answer(
                            output, state["evidence"], state.get("regulation_id")
                        )
                    }
                except ServiceError as error:
                    payload["validation_feedback"] = error.message
                    payload["previous_invalid_output"] = output.model_dump()
                    if attempt == 0:
                        stage("generating")
            output = Generation(
                answer_status="abstained",
                claims=[],
                assumptions=[],
                unknowns=["검증 가능한 인용·버전 표기를 만들지 못했습니다."],
            )
        stage("validating_citations")
        return {"result": render_answer(output, state["evidence"], state.get("regulation_id"))}

    builder = StateGraph(RagState)
    builder.add_node("retrieve", retrieve_node)
    builder.add_node("generate", generate_node)
    builder.add_edge(START, "retrieve")
    builder.add_edge("retrieve", "generate")
    builder.add_edge("generate", END)
    return builder.compile()
