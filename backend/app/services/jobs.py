import logging
from contextlib import nullcontext

from backend.app.core.errors import ServiceError

logger = logging.getLogger(__name__)


def run_job(service, job_id, kind, body, session_id, guard=None, lease=None):
    with guard.scope(lease) if guard else nullcontext():
        _run_job(service, job_id, kind, body, session_id)


def _run_job(service, job_id, kind, body, session_id):
    store = service.store
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
