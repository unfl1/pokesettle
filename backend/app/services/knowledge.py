import threading
import time

from backend.app.battle.conversation import (
    STATE_PROMPT,
    BattleUpdate,
    evaluate_state,
    grounded_update,
    merge_state,
    needs_battle_update,
    resolve_named_opponent,
)
from backend.app.core.errors import ServiceError
from backend.app.rag.graph import build_graph
from backend.app.rag.guide import metadata_guide
from backend.app.rag.prompts import PROMPT_VERSION, QUERY_PROMPT, SELECTION_PROMPT
from backend.app.schemas import Candidate, Document, QueryPlan, Selection
from backend.app.services.catalog_answers import answer_catalog, catalog_question
from backend.app.services.topics import mentioned_pokemon
from backend.app.storage import digest


class KnowledgeService:
    def __init__(self, settings, catalog, store, vectors, source, model):
        self.settings, self.catalog, self.store = settings, catalog, store
        self.vectors, self.source, self.model = vectors, source, model
        self.collection_lock = threading.RLock()

    def collect(self, pokemon_id, question, regulation_id=None, stage=lambda _: None):
        pokemon = self.catalog.get(pokemon_id)
        # Serializes query cache publication and document manifests across jobs.
        with self.collection_lock:
            started = time.monotonic()
            stage("extracting_queries")
            plan_key = digest([pokemon_id, question, regulation_id, PROMPT_VERSION])
            plan_data = self.store.get("query_plan", plan_key)
            if plan_data:
                plan = QueryPlan.model_validate(plan_data)
            else:
                plan = self.model.invoke(
                    "queries",
                    QUERY_PROMPT,
                    {
                        "pokemon": pokemon.model_dump(),
                        "question": question,
                        "regulation_id": regulation_id,
                    },
                    QueryPlan,
                )
                self.store.put("query_plan", plan_key, plan.model_dump())
            queries = list(dict.fromkeys([pokemon.name_en, *(q.query for q in plan.queries)]))
            queries = [" ".join(q.casefold().split()) for q in queries]
            reports = []
            subject_found = False
            pending = []
            all_candidates = {}
            collected_documents = {}
            client = self.source.client
            calls_before, hits_before = client.network_calls, client.cache_hits
            for query in dict.fromkeys(queries):
                stage("searching")
                search_key = digest([self.source.name, pokemon_id, query, regulation_id, "generic"])
                key = digest([search_key, question, PROMPT_VERSION])
                cached = self.store.get("query_complete", key)
                if cached:
                    # Reapply splitter configuration to cached bodies without fetching again.
                    for document in cached["documents"]:
                        stage("indexing")
                        self.vectors.index_document(pokemon_id, Document.model_validate(document))
                    subject_found |= cached["subject_found"]
                    reports.append({**cached["report"], "cache_hit": True})
                    continue
                search_cache = self.store.get("search_candidates", search_key)
                if search_cache:
                    candidates = [Candidate.model_validate(c) for c in search_cache]
                    own = next(c for c in candidates if c.is_subject_document)
                else:
                    candidates = self.source.search(query, pokemon)
                    own = self.source.subject(pokemon)
                    if not own:
                        raise ServiceError(
                            "SUBJECT_DOCUMENT_UNAVAILABLE",
                            "선택한 포켓몬 자체 문서를 확보하지 못했습니다.",
                        )
                    candidates = list({c.candidate_id: c for c in [*candidates, own]}.values())
                    self.store.put(
                        "search_candidates", search_key, [c.model_dump() for c in candidates]
                    )
                pending.append((query, key, candidates, own))
                all_candidates.update({c.candidate_id: c for c in candidates})
            if pending:
                stage("filtering")
                selection = self.model.invoke(
                    "selection",
                    SELECTION_PROMPT,
                    {
                        "question": question,
                        "candidates": [c.model_dump() for c in all_candidates.values()],
                    },
                    Selection,
                )
                available = set(all_candidates)
                if not set(selection.selected_candidate_ids).issubset(available) or any(
                    d.candidate_id not in available for d in selection.decisions
                ):
                    raise ServiceError(
                        "GENERATION_INVALID", "후보 선별 결과에 없는 문서 ID가 포함되었습니다."
                    )
            for query, key, candidates, own in pending:
                chosen = set(selection.selected_candidate_ids) | {own.candidate_id}
                documents, decisions = [], []
                reasons = {d.candidate_id: d.reason for d in selection.decisions}
                for candidate in candidates:
                    accepted = candidate.candidate_id in chosen
                    decisions.append(
                        {
                            "candidate_id": candidate.candidate_id,
                            "title": candidate.title,
                            "source_url": candidate.source_url,
                            "accepted": accepted,
                            "reason": "선택 항목 자체 문서 강제 유지"
                            if candidate.is_subject_document
                            else reasons.get(candidate.candidate_id, "모델 선별 결과"),
                            "is_subject_document": candidate.is_subject_document,
                        }
                    )
                    if not accepted:
                        continue
                    stage("collecting")
                    document = collected_documents.get(candidate.candidate_id)
                    if document is None:
                        document = self.source.fetch_document(candidate)
                    if not document:
                        raise ServiceError(
                            "SUBJECT_DOCUMENT_UNAVAILABLE"
                            if candidate.is_subject_document
                            else "SOURCE_UNAVAILABLE",
                            "선별한 문서를 확보하지 못했습니다.",
                            retryable=True,
                        )
                    if candidate.candidate_id not in collected_documents:
                        stage("indexing")
                        self.vectors.index_document(pokemon_id, document)
                        collected_documents[candidate.candidate_id] = document
                    documents.append(document.model_dump(mode="json"))
                subject_found = True
                report = {"query": query, "cache_hit": False, "decisions": decisions}
                self.store.put(
                    "query_complete",
                    key,
                    {"documents": documents, "subject_found": True, "report": report},
                )
                reports.append(report)
            return {
                "queries": queries,
                "reports": reports,
                "subject_document_status": "indexed" if subject_found else "missing",
                "document_count": len(
                    {d["candidate_id"] for r in reports for d in r["decisions"] if d["accepted"]}
                ),
                "chunk_count": len(self.vectors.docs.get(where={"pokemon_id": pokemon_id})["ids"]),
                "cache": {
                    "query_hits": sum(r["cache_hit"] for r in reports),
                    "network_calls": client.network_calls - calls_before,
                    "http_hits": client.cache_hits - hits_before,
                },
                "elapsed_seconds": round(time.monotonic() - started, 3),
            }

    def chat_focus(self, request, session_id):
        if request.pokemon_id:
            return request.pokemon_id
        names = mentioned_pokemon(self.catalog, request.question, limit=2)
        if names:
            return names[0]
        if request.conversation_id:
            record = self.store.messages(session_id, request.conversation_id, limit=1)
            previous = self.store.get("battle_state", request.conversation_id) or {}
            return (
                previous.get("own_id")
                or self.store.get("chat_topic", request.conversation_id)
                or (record["pokemon_id"] if record["pokemon_id"] in self.catalog.items else None)
            )
        return None

    def chat(self, request, session_id, stage=lambda _: None, feature=None):
        focus = self.chat_focus(request, session_id)
        conversation_id = self.store.conversation(
            session_id, request.pokemon_id, request.regulation_id, request.conversation_id
        )
        if focus is None:
            result = {
                "answer_status": "partial",
                "answer": "내 포켓몬과 상대 포켓몬, 또는 궁금한 포켓몬 이름을 질문에 적어주세요. 도감에서 선택할 필요는 없어요.",
                "citations": [],
                "assumptions": [],
                "unknowns": [],
            }
            user_id, assistant_id = self.store.save_exchange(
                conversation_id, request.question, result
            )
            return {
                **result,
                "conversation_id": conversation_id,
                "user_message_id": user_id,
                "assistant_message_id": assistant_id,
            }
        request = request.model_copy(update={"pokemon_id": focus})
        self.catalog.get(focus)
        self.store.put("chat_topic", conversation_id, focus)
        direct = (
            catalog_question(self.catalog, request.pokemon_id, request.question)
            if feature is None
            else None
        )
        if direct:
            stage("catalog_lookup")
            result = answer_catalog(*direct, regulation_id=request.regulation_id)
            stage("saving")
            user_id, assistant_id = self.store.save_exchange(
                conversation_id, request.question, result
            )
            return {
                **result,
                "conversation_id": conversation_id,
                "user_message_id": user_id,
                "assistant_message_id": assistant_id,
            }
        previous_battle = self.store.get("battle_state", conversation_id) or {}
        battle_state, battle_context = previous_battle, None
        if feature is None and needs_battle_update(request.question, previous_battle):
            stage("interpreting_battle")
            candidate_ids = list(
                dict.fromkeys(
                    [
                        *mentioned_pokemon(self.catalog, request.question, limit=8),
                        *[
                            previous_battle.get(key)
                            for key in ("own_id", "opponent_id")
                            if previous_battle.get(key)
                        ],
                        *previous_battle.get("bench_ids", []),
                    ]
                )
            )
            update = self.model.invoke(
                "battle_state",
                STATE_PROMPT,
                {
                    "question": request.question,
                    "previous_user_inputs": previous_battle,
                    "candidate_pokemon": [
                        {
                            "pokemon_id": pid,
                            "name_ko": self.catalog.get(pid).name_ko,
                            "name_en": self.catalog.get(pid).name_en,
                        }
                        for pid in candidate_ids
                    ],
                },
                BattleUpdate,
            )
            update = grounded_update(
                BattleUpdate.model_validate(update), request.question, previous_battle, self.catalog
            )
            battle_state = merge_state(previous_battle, update, set(candidate_ids), self.catalog)
            battle_state = resolve_named_opponent(request.question, battle_state, self.catalog)
            if update.relevant or battle_state.get("unresolved_opponent"):
                battle_context = evaluate_state(
                    battle_state, self.catalog, self.settings.data_dir, self.settings
                )
        if battle_context and battle_state.get("unresolved_opponent"):
            result = {
                "answer_status": "partial",
                "answer": battle_context["questions"][0]
                + " 이전 상대를 그대로 적용하지 않고 확인 후 다시 비교할게요.",
                "citations": [],
                "assumptions": [],
                "unknowns": [],
                "battle_context": battle_context,
            }
            user_id, assistant_id = self.store.save_exchange(
                conversation_id, request.question, result, battle_state=battle_state
            )
            return {
                **result,
                "conversation_id": conversation_id,
                "user_message_id": user_id,
                "assistant_message_id": assistant_id,
            }
        collection = self.collect(
            request.pokemon_id, request.question, request.regulation_id, stage
        )
        if battle_context and battle_state.get("opponent_id") not in {None, request.pokemon_id}:
            opponent_collection = self.collect(
                battle_state["opponent_id"], request.question, request.regulation_id, stage
            )
            collection["queries"] = list(
                dict.fromkeys([*collection["queries"], *opponent_collection["queries"]])
            )
        context_ids = mentioned_pokemon(self.catalog, request.question) if feature is None else []
        if battle_context:
            context_ids = list(
                dict.fromkeys(
                    [
                        *[
                            battle_state[key]
                            for key in ("own_id", "opponent_id")
                            if battle_state.get(key)
                        ],
                        *context_ids,
                    ]
                )
            )[:2]
        graph = build_graph(self.vectors, self.model, stage)
        state = graph.invoke(
            {
                "pokemon_id": request.pokemon_id,
                "context_pokemon_ids": context_ids,
                "battle_context": battle_context,
                "question": request.question,
                "retrieval_query": request.question + " " + " ".join(collection["queries"]),
                "regulation_id": request.regulation_id,
                "history": self.store.history(conversation_id),
            }
        )
        stage("saving")
        result = state["result"]
        if (
            feature == "pokemon_guide"
            and result["answer_status"] == "abstained"
            and any(
                item["reason"] == "검증 가능한 인용·버전 표기를 만들지 못했습니다."
                for item in result["unknowns"]
            )
        ):
            result = (
                metadata_guide(
                    self.catalog.get(request.pokemon_id), state["evidence"], request.regulation_id
                )
                or result
            )
        if battle_context:
            result["battle_context"] = battle_context
        result["retrieval"] = self.vectors.retrieval_settings
        if feature:
            result["feature"] = feature
            result["guide_scope"] = "generic_reference"
            result["guide_limitations"] = [
                "일반 도감과 수집 문서에서 확인한 정보입니다.",
                "Champions 전략 역할·적격성은 확인된 근거가 있을 때만 설명합니다.",
            ]
        display_question = (
            "근거 기반 운용 가이드를 작성해 줘." if feature == "pokemon_guide" else request.question
        )
        user_id, assistant_id = self.store.save_exchange(
            conversation_id,
            display_question,
            result,
            battle_state=battle_state if feature is None else None,
        )
        return {
            **result,
            "conversation_id": conversation_id,
            "user_message_id": user_id,
            "assistant_message_id": assistant_id,
            "collection": collection,
        }
