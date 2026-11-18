import asyncio
import json
import time

from fastapi import APIRouter, Request, Response
from fastapi.responses import StreamingResponse

from backend.app.api import schemas
from backend.app.api.dependencies import ServiceDep, SessionDep, SettingsDep, StoreDep
from backend.app.api.jobs import submit
from backend.app.api.responses import error_responses, ok, wire
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


@router.get("/jobs/{job_id}/events", response_class=StreamingResponse, responses={
    200: {"description": "Session-owned job snapshots", "content": {"text/event-stream": {"schema": {"type": "string"}}}},
})
async def job_events(request: Request, job_id: str, *, store: StoreDep, session_id: SessionDep):
    # Check ownership before sending HTTP 200; never start or repeat model work here.
    initial = await asyncio.to_thread(store.job, job_id, session_id)

    async def events():
        snapshot, previous = initial, None
        started = time.monotonic()
        heartbeat = started
        while time.monotonic() - started < 55:
            if await request.is_disconnected():
                break
            data = json.dumps(wire(snapshot), ensure_ascii=False, separators=(",", ":"))
            if data != previous:
                yield f"event: job\ndata: {data}\n\n"
                previous = data
            elif time.monotonic() - heartbeat >= 10:
                yield ": heartbeat\n\n"
                heartbeat = time.monotonic()
            if snapshot["status"] in {"completed", "failed", "interrupted"}:
                break
            await asyncio.sleep(0.25)
            snapshot = await asyncio.to_thread(store.job, job_id, session_id)

    return StreamingResponse(events(), media_type="text/event-stream", headers={
        "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no",
    })
