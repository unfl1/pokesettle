import json
import re
from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from backend.app.battle.conversation import coach_fallback
from backend.app.core.errors import ServiceError
from backend.app.rag.prompts import GENERATION_PROMPT
from backend.app.rag.retriever import retrieve
from backend.app.schemas import Generation
from backend.app.storage import digest


class RagState(TypedDict, total=False):
    pokemon_id: str
    question: str
    retrieval_query: str
    regulation_id: str | None
    history: list
    evidence: list
    context_pokemon_ids: list[str]
    battle_context: dict | None
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
                "verification_status": (
                    "assumed"
                    if any(e.get("verification_status") == "assumed" for e in selected)
                    else "unknown"
                    if any(e.get("verification_status") != "verified" for e in selected)
                    else "verified"
                ),
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
                    "licence_url",
                    "game",
                    "battle_format",
                    "regulation_id",
                ]
            }
        )
    return {
        "answer_status": "partial"
        if generated.claims and generated.unknowns
        else generated.answer_status,
        "answer": "\n\n".join(sentences)
        or (
            "답변의 인용·버전 표기를 검증하지 못했습니다. 다시 요청해 주세요."
            if "검증 가능한 인용·버전 표기를 만들지 못했습니다." in generated.unknowns
            else "수집된 문서에서 확인되지 않습니다."
        ),
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
        query = state.get("retrieval_query") or state["question"]
        ids = list(dict.fromkeys([state["pokemon_id"], *state.get("context_pokemon_ids", [])]))
        groups = [retrieve(vector_store, pid, query, state.get("regulation_id")) for pid in ids]
        # Preserve selected metadata and explicitly mentioned metadata within total Top-k.
        metadata = [group[0] for group in groups if group]
        documents = [item for group in groups for item in group[1:]]
        if not state.get("regulation_id"):
            for pid in ids:
                curated = vector_store.docs.get(where={"pokemon_id": pid})
                for eid, text, meta in zip(
                    curated["ids"], curated["documents"], curated["metadatas"]
                ):
                    if not meta["document_id"].startswith(
                        ("poketact:strategy:", "pokeapi:ability:", "pokeapi:move:")
                    ):
                        continue
                    manifest = vector_store.store.get("manifest", f"{pid}:{meta['document_id']}")
                    if manifest and eid in manifest["ids"]:
                        documents.append(vector_store.evidence(eid, text, meta))
        # Species strategy notes have their own retrieval lane so Pokédex prose cannot crowd them out.
        context_ids = set(state.get("context_pokemon_ids", []) or [state["pokemon_id"]])

        def priority(item):
            doc_id = item.get("document_id", "")
            first_chunk = item.get("chunk_index", 0) == 0
            if doc_id.startswith("poketact:strategy:"):
                return 0 if first_chunk else 2
            if item.get("pokemon_id") in context_ids:
                if doc_id.startswith(("pokeapi:ability:", "pokeapi:move:")):
                    return 1 if first_chunk else 3
                return 4
            return 5

        documents.sort(key=priority)
        calculations = []
        context = state.get("battle_context")
        if context and context.get("sources"):
            source = context["sources"][-1]
            calculations = [
                {
                    "evidence_id": "battle-calculation:" + digest(context),
                    "document_id": "battle-type-scenario",
                    "title": "6대6 선출 비교 · 일반 타입 기준"
                    if context.get("scope") == "generic_team_selection"
                    else "일반 타입표로 계산한 현재 대면 · 조건부 판단",
                    "source_type": "calculation",
                    "source_url": source["source_url"],
                    "collected_at": source["collected_at"],
                    "licence": source.get("licence"),
                    "licence_url": source.get("licence_url"),
                    "game": "generic",
                    "battle_format": "singles",
                    "verification_status": "assumed",
                    "text": json.dumps(context, ensure_ascii=False),
                }
            ]
        combined, seen = [], set()
        for item in [*metadata, *calculations, *documents]:
            if item["evidence_id"] not in seen:
                combined.append(item)
                seen.add(item["evidence_id"])
        combined = combined[: vector_store.settings.top_k]
        for number, item in enumerate(combined, 1):
            item["number"] = number
        return {"evidence": combined}

    def generate_node(state):
        stage("generating")
        if not state["evidence"]:
            output = Generation(
                answer_status="abstained", claims=[], assumptions=[], unknowns=["검색된 근거 없음"]
            )
        else:
            payload = {
                "question": state["question"],
                "battle_context_from_user_inputs_and_type_tool": state.get("battle_context"),
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
                if state.get("battle_context"):
                    calculated = coach_fallback(state["battle_context"], state["evidence"])
                    if calculated:
                        # Numerical type multipliers are rendered from the rule engine only.
                        # Keep non-numerical sourced explanations after the action-first lead.
                        extra = [
                            claim
                            for claim in output.claims
                            if not re.search(
                                r"(?:\d+(?:\.\d+)?\s*(?:배|[×x])|[×x]\s*\d|(?:두|네|반)\s*배)",
                                claim.text,
                            )
                        ]
                        context = state["battle_context"]
                        # A move definition cannot establish ownership or matchup damage.
                        # Battle move/type advice is rendered from the user's inputs and tool.
                        move_evidence = {
                            item["evidence_id"]
                            for item in state["evidence"]
                            if item.get("document_id", "").startswith("pokeapi:move:")
                        }
                        extra = [
                            claim for claim in extra
                            if not move_evidence.intersection(claim.evidence_ids)
                        ]
                        if context.get("scope") == "generic_team_selection":
                            # The selection rank is computed, not an invitation to invent
                            # per-species abilities or reinterpret unrelated strategy prose.
                            extra = []
                        if not any(
                            context["state"].get(key) for key in ("own_ability", "opponent_ability")
                        ):
                            ability_evidence = {
                                item["evidence_id"]
                                for item in state["evidence"]
                                if item.get("document_id", "").startswith("pokeapi:ability:")
                            }
                            extra = [
                                claim
                                for claim in extra
                                if not ability_evidence.intersection(claim.evidence_ids)
                            ]
                        output = Generation(
                            answer_status="partial",
                            claims=[
                                *[
                                    claim
                                    for claim in calculated.claims
                                    if not claim.text.startswith("주의사항\n")
                                ],
                                *[
                                    claim
                                    for claim in extra
                                    if any(
                                        item["evidence_id"] in claim.evidence_ids
                                        and item.get("source_type")
                                        not in {"metadata", "calculation"}
                                        for item in state["evidence"]
                                    )
                                ][:2],
                                *[
                                    claim
                                    for claim in calculated.claims
                                    if claim.text.startswith("주의사항\n")
                                ],
                            ],
                            assumptions=list(dict.fromkeys(calculated.assumptions)),
                            unknowns=list(dict.fromkeys(calculated.unknowns))[:2],
                        )
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
        if output.answer_status == "abstained" and state.get("battle_context"):
            output = coach_fallback(state["battle_context"], state["evidence"]) or output
        stage("validating_citations")
        return {"result": render_answer(output, state["evidence"], state.get("regulation_id"))}

    builder = StateGraph(RagState)
    builder.add_node("retrieve", retrieve_node)
    builder.add_node("generate", generate_node)
    builder.add_edge(START, "retrieve")
    builder.add_edge("retrieve", "generate")
    builder.add_edge("generate", END)
    return builder.compile()
