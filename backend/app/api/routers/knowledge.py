from fastapi import APIRouter, BackgroundTasks, Request

from backend.app.api.dependencies import ServiceDep, SettingsDep, StoreDep
from backend.app.api.jobs import submit
from backend.app.api.responses import ok
from backend.app.api.validation import session
from backend.app.schemas import ChatRequest, CollectRequest

router = APIRouter()


@router.post("/documents/collect")
def collect(
    request: Request,
    background: BackgroundTasks,
    body: CollectRequest,
    *,
    settings: SettingsDep,
    service: ServiceDep,
):
    return submit(request, background, body, "collect", service, settings)


@router.post("/chat")
def chat(
    request: Request,
    background: BackgroundTasks,
    body: ChatRequest,
    *,
    settings: SettingsDep,
    service: ServiceDep,
):
    return submit(request, background, body, "chat", service, settings)


@router.get("/jobs/{job_id}")
def job(request: Request, job_id: str, *, store: StoreDep):
    return ok(request, store.job(job_id, session(request, store)))
