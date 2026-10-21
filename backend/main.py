import json
import logging
from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import BackgroundTasks, FastAPI, Query, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic.alias_generators import to_camel
from starlette.exceptions import HTTPException

from backend.catalog import Catalog
from backend.config import Settings
from backend.data_preparation.pokeapi import PokeApiSource
from backend.discovery import discover
from backend.errors import ServiceError
from backend.http_client import SourceClient
from backend.models import (
    ChatRequest,
    CollectRequest,
    ConversationRequest,
    DiscoveryRequest,
    GuideRequest,
)
from backend.rag.model import StructuredModel
from backend.rag.vector_store import VectorStore
from backend.services import KnowledgeService
from backend.storage import Store

logger = logging.getLogger(__name__)


def wire(value):
    value = jsonable_encoder(value)
    if isinstance(value, dict):
        return {to_camel(k): wire(v) for k, v in value.items()}
    if isinstance(value, list):
        return [wire(v) for v in value]
    return value


def create_app(settings=None, *, service=None):
    settings = settings or Settings.from_env()
    if service is None:
        store = Store(settings.runtime_dir / "state.sqlite3")
        catalog = Catalog(settings.data_dir / "pokemon.json")
        vectors = VectorStore(settings, store)
        source = PokeApiSource(SourceClient(settings, store))
        service = KnowledgeService(
            settings, catalog, store, vectors, source, StructuredModel(settings)
        )
    store, catalog, vectors = service.store, service.catalog, service.vectors

    @asynccontextmanager
    async def lifespan(app):
        store.recover_jobs()
        yield

    app = FastAPI(title="PokéCoach AI", version="0.1.0", lifespan=lifespan)
    app.state.service = service
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.allowed_origins),
        allow_credentials=True,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )

    @app.middleware("http")
    async def request_context(request, call_next):
        request.state.request_id = str(uuid4())
        origin = request.headers.get("origin")
        if (
            request.method not in {"GET", "HEAD", "OPTIONS"}
            and origin
            and origin not in settings.allowed_origins
        ):
            return JSONResponse(
                {
                    "error": {
                        "code": "ORIGIN_NOT_ALLOWED",
                        "message": "허용되지 않은 요청 출처입니다.",
                        "retryable": False,
                        "details": [],
                    },
                    "requestId": request.state.request_id,
                },
                status_code=403,
            )
        response = await call_next(request)
        response.headers["X-Request-ID"] = request.state.request_id
        return response

    def ok(request, data, status=200, headers=None, warnings=None):
        return JSONResponse(
            {"data": wire(data), "requestId": request.state.request_id, "warnings": warnings or []},
            status_code=status,
            headers=headers,
        )

    @app.exception_handler(ServiceError)
    async def service_error(request, error):
        return JSONResponse(
            {"error": error.as_dict(), "requestId": request.state.request_id},
            status_code=error.status,
        )

    @app.exception_handler(RequestValidationError)
    async def input_error(request, error):
        details = [
            {"field": ".".join(map(str, e["loc"])), "code": e["type"]} for e in error.errors()
        ]
        return JSONResponse(
            {
                "error": {
                    "code": "INVALID_INPUT",
                    "message": "입력 형식을 확인하세요.",
                    "retryable": False,
                    "details": details,
                },
                "requestId": request.state.request_id,
            },
            status_code=422,
        )

    @app.exception_handler(HTTPException)
    async def http_error(request, error):
        return JSONResponse(
            {
                "error": {
                    "code": "RESOURCE_NOT_FOUND" if error.status_code == 404 else "HTTP_ERROR",
                    "message": "요청 경로 또는 방식을 확인하세요.",
                    "retryable": False,
                    "details": [],
                },
                "requestId": request.state.request_id,
            },
            status_code=error.status_code,
        )

    @app.exception_handler(Exception)
    async def internal_error(request, error):
        # Do not log raw provider exceptions: they may contain prompts or credentials.
        logger.error(
            "Internal failure request_id=%s type=%s", request.state.request_id, type(error).__name__
        )
        return JSONResponse(
            {
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": "처리 중 오류가 발생했습니다.",
                    "retryable": False,
                    "details": [],
                },
                "requestId": request.state.request_id,
            },
            status_code=500,
        )

    def session(request):
        session_id = request.cookies.get("pokecoach_session")
        if not store.session_valid(session_id):
            raise ServiceError("SESSION_REQUIRED", "세션을 먼저 생성하세요.", 401)
        return session_id

    def regulations():
        return [
            json.loads(p.read_text())
            for p in sorted((settings.data_dir / "regulations").glob("*.json"))
        ]

    def check_scope(request_data):
        catalog.get(request_data.pokemon_id)
        if request_data.regulation_id and request_data.regulation_id not in {
            r["regulation_id"] for r in regulations()
        }:
            raise ServiceError("UNKNOWN_REGULATION", "등록되지 않은 규칙입니다.", 422)

    def ensure_ready():
        if not vectors.meta.count():
            raise ServiceError("INDEX_NOT_READY", "메타데이터 색인을 먼저 준비하세요.", 503)
        if not settings.model_configured:
            raise ServiceError("MODEL_KEY_MISSING", "서버 API 키와 CHAT_MODEL을 설정하세요.", 503)

    def run_job(job_id, kind, body, session_id):
        store.update_job(job_id, status="running")

        def stage(value):
            store.update_job(job_id, stage=value)

        try:
            if kind in {"chat", "guide"}:
                result = service.chat(
                    body, session_id, stage, feature="pokemon_guide" if kind == "guide" else None
                )
            else:
                result = service.collect(body.pokemon_id, body.question, body.regulation_id, stage)
            store.update_job(
                job_id,
                status="completed",
                stage="done",
                result=result,
                cache=result.get("cache", result.get("collection", {}).get("cache", {})),
            )
        except ServiceError as error:
            store.update_job(job_id, status="failed", error=error.as_dict())
        except Exception as error:
            logger.error("Job failure job_id=%s type=%s", job_id, type(error).__name__)
            store.update_job(
                job_id,
                status="failed",
                error=ServiceError(
                    "INTERNAL_ERROR", "작업 처리 중 오류가 발생했습니다.", 500
                ).as_dict(),
            )

    def submit(request, background, body, kind):
        session_id = session(request)
        check_scope(body)
        ensure_ready()
        if kind in {"chat", "guide"} and body.conversation_id:
            store.conversation(
                session_id, body.pokemon_id, body.regulation_id, body.conversation_id
            )
        job_id, created = store.create_job(
            session_id, kind, str(body.client_request_id), body.model_dump(mode="json")
        )
        if created:
            background.add_task(run_job, job_id, kind, body, session_id)
        url = f"/api/jobs/{job_id}"
        current = store.job(job_id, session_id)
        return ok(
            request,
            {"job_id": job_id, "status": current["status"], "status_url": url},
            202,
            {"Location": url},
        )

    @app.get("/api/status")
    def status(request: Request):
        missing = []
        if not settings.model_configured:
            missing.append("MODEL_KEY_MISSING")
        if not vectors.meta.count():
            missing.append("INDEX_NOT_READY")
        return ok(
            request,
            {
                "ready": not missing,
                "model_configured": settings.model_configured,
                "metadata_count": vectors.meta.count(),
                "document_chunk_count": vectors.docs.count(),
                "missing": missing,
                "regulation_verification_status": "unknown",
            },
            warnings=["일반 도감 정보이며 Champions 적격성과 전투 규칙은 미확인입니다."],
        )

    @app.post("/api/session")
    def create_session(request: Request):
        current = request.cookies.get("pokecoach_session")
        session_id = current if store.session_valid(current) else store.new_session()
        response = ok(request, {"active": True})
        response.set_cookie(
            "pokecoach_session",
            session_id,
            httponly=True,
            samesite="lax",
            secure=request.url.scheme == "https",
            max_age=604800,
        )
        return response

    @app.get("/api/pokemon")
    def pokemon_list(
        request: Request,
        q: str | None = Query(None, min_length=1, max_length=200),
        type_: str | None = Query(None, alias="type"),
        regulation_id: str | None = Query(None, alias="regulationId"),
        eligibility_status: str | None = Query(
            None, alias="eligibilityStatus", pattern="^(eligible|ineligible|unknown)$"
        ),
        limit: int = Query(20, ge=1, le=100),
        offset: int = Query(0, ge=0),
    ):
        allowed = {"q", "type", "regulationId", "eligibilityStatus", "limit", "offset"}
        if set(request.query_params) - allowed:
            raise ServiceError("INVALID_INPUT", "지원하지 않는 필터입니다.", 422)
        if regulation_id and regulation_id not in {r["regulation_id"] for r in regulations()}:
            raise ServiceError("UNKNOWN_REGULATION", "등록되지 않은 규칙입니다.", 422)
        items = list(catalog.items.values())
        if q:
            items = [
                p for p in items if q.casefold() in f"{p.name_ko or ''} {p.name_en}".casefold()
            ]
        if type_:
            items = [p for p in items if type_ in p.types]
        if regulation_id:
            items = [p for p in items if regulation_id in (p.eligible_regulations or [])]
        if eligibility_status:
            items = [p for p in items if p.champions_eligibility_status == eligibility_status]
        summaries = [
            {
                k: v
                for k, v in p.model_dump().items()
                if k
                in {
                    "pokemon_id",
                    "name_ko",
                    "name_en",
                    "types",
                    "champions_eligibility_status",
                    "scope",
                }
            }
            for p in items[offset : offset + limit]
        ]
        return ok(
            request, {"items": summaries, "total": len(items), "limit": limit, "offset": offset}
        )

    @app.get("/api/pokemon/{pokemon_id}")
    def detail(request: Request, pokemon_id: str):
        return ok(request, catalog.get(pokemon_id).model_dump())

    @app.post("/api/pokemon/search")
    def discovery(request: Request, body: DiscoveryRequest):
        session(request)
        if body.regulation_id and body.regulation_id not in {
            r["regulation_id"] for r in regulations()
        }:
            raise ServiceError("UNKNOWN_REGULATION", "등록되지 않은 규칙입니다.", 422)
        ensure_ready()
        return ok(
            request,
            discover(service, body),
            warnings=["일반 도감 속성으로 검증한 결과이며 Champions 적격성을 뜻하지 않습니다."],
        )

    @app.post("/api/conversations")
    def new_conversation(request: Request, body: ConversationRequest):
        session_id = session(request)
        check_scope(body)
        identifier = store.conversation(session_id, body.pokemon_id, body.regulation_id)
        return ok(
            request,
            {
                "conversation_id": identifier,
                "pokemon_id": body.pokemon_id,
                "regulation_id": body.regulation_id,
            },
            201,
        )

    @app.get("/api/conversations")
    def conversation_list(
        request: Request,
        pokemon_id: str = Query(..., alias="pokemonId"),
        limit: int = Query(20, ge=1, le=100),
        offset: int = Query(0, ge=0),
    ):
        session_id = session(request)
        catalog.get(pokemon_id)
        return ok(request, store.conversations(session_id, pokemon_id, limit, offset))

    @app.get("/api/conversations/{conversation_id}/messages")
    def conversation_messages(
        request: Request,
        conversation_id: str,
        limit: int = Query(50, ge=1, le=100),
        offset: int = Query(0, ge=0),
    ):
        return ok(request, store.messages(session(request), conversation_id, limit, offset))

    @app.post("/api/pokemon/{pokemon_id}/guide")
    def guide(request: Request, background: BackgroundTasks, pokemon_id: str, body: GuideRequest):
        guide_question = "선택한 포켓몬의 근거 기반 운용 가이드를 작성해 주세요. 먼저 일반 도감에서 확인되는 타입, 종족값의 특징, 특성 이름과 수집 문서에 설명된 특성 작용을 근거와 함께 정리하세요. 운용 역할과 주의점은 문서가 직접 뒷받침할 때만 설명하고, 없으면 미확인으로 구분하세요. Champions의 적격성·추천 세트·승률·데미지는 추측하지 마세요. 도감의 생태 이야기는 생략하고 타입·종족값·특성 설명에 집중해 최대 6개 주장으로 간결하게 답하세요. 문서에 없는 운용 역할과 Champions 적용 여부는 claims가 아니라 unknowns에 따로 기록하세요."
        chat_body = ChatRequest(**body.model_dump(), pokemon_id=pokemon_id, question=guide_question)
        return submit(request, background, chat_body, "guide")

    @app.get("/api/regulations")
    def regulation_list(request: Request):
        return ok(request, {"items": regulations()})

    @app.post("/api/documents/collect")
    def collect(request: Request, background: BackgroundTasks, body: CollectRequest):
        return submit(request, background, body, "collect")

    @app.post("/api/chat")
    def chat(request: Request, background: BackgroundTasks, body: ChatRequest):
        return submit(request, background, body, "chat")

    @app.get("/api/jobs/{job_id}")
    def job(request: Request, job_id: str):
        return ok(request, store.job(job_id, session(request)))

    return app


app = create_app()
