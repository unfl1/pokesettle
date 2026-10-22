from fastapi import APIRouter, BackgroundTasks, Query, Request

from backend.app.api.dependencies import (
    CatalogDep,
    ServiceDep,
    SettingsDep,
    StoreDep,
)
from backend.app.api.jobs import submit
from backend.app.api.responses import ok
from backend.app.api.validation import (
    ensure_ready,
    regulations,
    session,
)
from backend.app.core.errors import ServiceError
from backend.app.schemas import (
    ChatRequest,
    DiscoveryRequest,
    GuideRequest,
)
from backend.app.services.discovery import discover

router = APIRouter()


@router.get("/pokemon")
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
    *,
    settings: SettingsDep,
    catalog: CatalogDep,
):
    allowed = {"q", "type", "regulationId", "eligibilityStatus", "limit", "offset"}
    if set(request.query_params) - allowed:
        raise ServiceError("INVALID_INPUT", "지원하지 않는 필터입니다.", 422)
    if regulation_id and regulation_id not in {r["regulation_id"] for r in regulations(settings)}:
        raise ServiceError("UNKNOWN_REGULATION", "등록되지 않은 규칙입니다.", 422)
    items = list(catalog.items.values())
    if q:
        items = [p for p in items if q.casefold() in f"{p.name_ko or ''} {p.name_en}".casefold()]
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
                "species_id",
                "is_default",
                "form_identifier",
                "images",
            }
        }
        for p in items[offset : offset + limit]
    ]
    return ok(request, {"items": summaries, "total": len(items), "limit": limit, "offset": offset})


@router.get("/pokemon/{pokemon_id}")
def detail(request: Request, pokemon_id: str, *, catalog: CatalogDep):
    return ok(request, catalog.profile(pokemon_id))


@router.post("/pokemon/search")
def discovery(
    request: Request,
    body: DiscoveryRequest,
    *,
    store: StoreDep,
    settings: SettingsDep,
    service: ServiceDep,
):
    session(request, store)
    if body.regulation_id and body.regulation_id not in {
        r["regulation_id"] for r in regulations(settings)
    }:
        raise ServiceError("UNKNOWN_REGULATION", "등록되지 않은 규칙입니다.", 422)
    ensure_ready(service, settings)
    return ok(
        request,
        discover(service, body),
        warnings=["일반 도감 속성으로 검증한 결과이며 Champions 적격성을 뜻하지 않습니다."],
    )


@router.post("/pokemon/{pokemon_id}/guide")
def guide(
    request: Request,
    background: BackgroundTasks,
    pokemon_id: str,
    body: GuideRequest,
    *,
    settings: SettingsDep,
    service: ServiceDep,
):
    guide_question = "선택한 포켓몬의 근거 기반 운용 가이드를 작성해 주세요. 먼저 일반 도감에서 확인되는 타입, 종족값의 특징, 특성 이름과 수집 문서에 설명된 특성 작용을 근거와 함께 정리하세요. 운용 역할과 주의점은 문서가 직접 뒷받침할 때만 설명하고, 없으면 미확인으로 구분하세요. Champions의 적격성·추천 세트·승률·데미지는 추측하지 마세요. 도감의 생태 이야기는 생략하고 타입·종족값·특성 설명에 집중해 최대 6개 주장으로 간결하게 답하세요. 문서에 없는 운용 역할과 Champions 적용 여부는 claims가 아니라 unknowns에 따로 기록하세요."
    chat_body = ChatRequest(**body.model_dump(), pokemon_id=pokemon_id, question=guide_question)
    return submit(request, background, chat_body, "guide", service, settings)
