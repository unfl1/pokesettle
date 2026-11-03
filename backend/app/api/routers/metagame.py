from fastapi import APIRouter, Query, Request, Response

from backend.app.api import schemas
from backend.app.api.dependencies import CatalogDep
from backend.app.api.responses import error_responses, ok

router = APIRouter(tags=["metagame"], responses=error_responses(503))


@router.get(
    "/meta/singles",
    status_code=200,
    response_model=schemas.Envelope[schemas.SinglesMetaData],
    response_model_exclude_unset=True,
)
def singles_meta(
    request: Request, response: Response, catalog: CatalogDep, limit: int = Query(30, ge=1, le=30)
):
    response.headers["Cache-Control"] = "no-store"
    return ok(
        request,
        request.app.state.metagame.singles(catalog, limit),
    )
