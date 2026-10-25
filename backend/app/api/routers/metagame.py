from fastapi import APIRouter, Query, Request

from backend.app.api.dependencies import CatalogDep
from backend.app.api.responses import ok

router = APIRouter()


@router.get("/meta/singles")
def singles_meta(request: Request, catalog: CatalogDep, limit: int = Query(30, ge=1, le=30)):
    return ok(
        request,
        request.app.state.metagame.singles(catalog, limit),
        headers={"Cache-Control": "no-store"},
    )
