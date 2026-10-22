from fastapi import APIRouter, Request

from backend.app.api.dependencies import CatalogDep, SettingsDep, StoreDep, VectorDep
from backend.app.api.responses import ok
from backend.app.api.validation import regulations

router = APIRouter()


@router.get("/status")
def status(request: Request, *, settings: SettingsDep, catalog: CatalogDep, vectors: VectorDep):
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
            "species_count": len({p.species_id for p in catalog.items.values()}),
            "alternate_variety_count": sum(not p.is_default for p in catalog.items.values()),
            "document_chunk_count": vectors.docs.count(),
            "retrieval": vectors.retrieval_settings,
            "missing": missing,
            "regulation_verification_status": "unknown",
        },
        warnings=["일반 도감 정보이며 Champions 적격성과 전투 규칙은 미확인입니다."],
    )


@router.post("/session")
def create_session(request: Request, *, store: StoreDep):
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


@router.get("/regulations")
def regulation_list(request: Request, *, settings: SettingsDep):
    return ok(request, {"items": regulations(settings)})
