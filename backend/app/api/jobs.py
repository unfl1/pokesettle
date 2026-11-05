from backend.app.api.responses import ok
from backend.app.api.validation import check_scope, ensure_ready
from backend.app.core.usage import request_subjects
from backend.app.services.catalog_answers import catalog_navigation, catalog_question
from backend.app.services.jobs import run_job


def submit(request, response, background, body, kind, service, settings, session_id):
    store = service.store
    check_scope(body, service, settings)
    focus = service.chat_focus(body, session_id) if kind == "chat" else body.pokemon_id
    model_free = kind == "chat" and (
        (focus and catalog_question(service.catalog, focus, body.question))
        or catalog_navigation(service.catalog, focus, body.question)
    )
    if not model_free and (kind != "chat" or focus):
        ensure_ready(service, settings)
    if kind in {"chat", "guide"} and body.conversation_id:
        store.conversation(session_id, body.pokemon_id, body.regulation_id, body.conversation_id)
    job_id, created = store.create_job(
        session_id, kind, str(body.client_request_id), body.model_dump(mode="json")
    )
    if created and model_free:
        background.add_task(run_job, service, job_id, kind, body, session_id)
    elif created:
        guard = request.app.state.usage
        try:
            lease = guard.begin(request_subjects(request, session_id, settings))
        except Exception:
            store.update_job(
                job_id,
                status="failed",
                error={
                    "code": "USAGE_REJECTED",
                    "message": "사용 한도로 요청이 차단되었습니다.",
                    "retryable": False,
                    "details": [],
                },
            )
            raise
        background.add_task(run_job, service, job_id, kind, body, session_id, guard, lease)
    url = f"/api/jobs/{job_id}"
    current = store.job(job_id, session_id)
    response.headers["Location"] = url
    return ok(
        request,
        {"job_id": job_id, "status": current["status"], "status_url": url},
    )
