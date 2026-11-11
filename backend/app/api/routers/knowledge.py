from fastapi import APIRouter, Request, Response

from backend.app.api import schemas
from backend.app.api.dependencies import ServiceDep, SessionDep, SettingsDep, StoreDep
from backend.app.api.jobs import submit
from backend.app.api.responses import error_responses, ok
from backend.app.schemas import ChatRequest, CollectRequest

router = APIRouter(tags=["knowledge"], responses=error_responses(401, 404, 409, 429, 503))


@router.post(
    "/documents/collect",
    status_code=202,
    response_model=schemas.Envelope[schemas.JobAccepted],
    response_model_exclude_unset=True,
)
def collect(
    request: Request,
    response: Response,
    body: CollectRequest,
    *,
    settings: SettingsDep,
    session_id: SessionDep,
    service: ServiceDep,
):
    return submit(request, response, body, "collect", service, settings, session_id)


@router.post(
    "/chat",
    status_code=202,
    response_model=schemas.Envelope[schemas.JobAccepted],
    response_model_exclude_unset=True,
)
def chat(
    request: Request,
    response: Response,
    body: ChatRequest,
    *,
    settings: SettingsDep,
    session_id: SessionDep,
    service: ServiceDep,
):
    return submit(request, response, body, "chat", service, settings, session_id)


@router.get(
    "/jobs/{job_id}",
    status_code=200,
    response_model=schemas.Envelope[schemas.JobData],
    response_model_exclude_unset=True,
)
def job(request: Request, job_id: str, *, store: StoreDep, session_id: SessionDep):
    return ok(request, store.job(job_id, session_id))
