import threading
import time

from backend.app.core.errors import ServiceError
from backend.app.rag.graph import build_graph
from backend.app.rag.prompts import PROMPT_VERSION, QUERY_PROMPT, SELECTION_PROMPT
from backend.app.schemas import Candidate, Document, QueryPlan, Selection
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
                stage("filtering")
                selection = self.model.invoke(
                    "selection",
                    SELECTION_PROMPT,
                    {
                        "question": question,
                        "candidates": [c.model_dump() for c in candidates],
                    },
                    Selection,
                )
                available = {c.candidate_id for c in candidates}
                if not set(selection.selected_candidate_ids).issubset(available) or any(
                    d.candidate_id not in available for d in selection.decisions
                ):
                    raise ServiceError(
                        "GENERATION_INVALID", "후보 선별 결과에 없는 문서 ID가 포함되었습니다."
                    )
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
                    document = self.source.fetch_document(candidate)
                    if not document:
                        raise ServiceError(
                            "SUBJECT_DOCUMENT_UNAVAILABLE"
                            if candidate.is_subject_document
                            else "SOURCE_UNAVAILABLE",
                            "선별한 문서를 확보하지 못했습니다.",
                            retryable=True,
                        )
                    stage("indexing")
                    self.vectors.index_document(pokemon_id, document)
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

    def chat(self, request, session_id, stage=lambda _: None, feature=None):
        self.catalog.get(request.pokemon_id)
        conversation_id = self.store.conversation(
            session_id, request.pokemon_id, request.regulation_id, request.conversation_id
        )
        collection = self.collect(
            request.pokemon_id, request.question, request.regulation_id, stage
        )
        graph = build_graph(self.vectors, self.model, stage)
        state = graph.invoke(
            {
                "pokemon_id": request.pokemon_id,
                "question": request.question,
                "retrieval_query": request.question + " " + " ".join(collection["queries"]),
                "regulation_id": request.regulation_id,
                "history": self.store.history(conversation_id),
            }
        )
        stage("saving")
        result = state["result"]
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
        user_id, assistant_id = self.store.save_exchange(conversation_id, display_question, result)
        return {
            **result,
            "conversation_id": conversation_id,
            "user_message_id": user_id,
            "assistant_message_id": assistant_id,
            "collection": collection,
        }
