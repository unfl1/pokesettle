from backend.app.api.responses import ok
from backend.app.api.validation import check_scope, ensure_ready
from backend.app.core.usage import request_subjects
from backend.app.services.catalog_answers import catalog_navigation


def submit(request, response, body, kind, service, settings, session_id):
    store = service.store
    check_scope(body, service, settings)
    focus = service.chat_focus(body, session_id) if kind == "chat" else body.pokemon_id
    model_free = kind == "chat" and catalog_navigation(service.catalog, focus, body.question)
    if not model_free and (kind != "chat" or focus):
        ensure_ready(service, settings)
    if kind in {"chat", "guide"} and body.conversation_id:
        store.conversation(session_id, body.pokemon_id, body.regulation_id, body.conversation_id)
    subjects = request_subjects(request, session_id, settings) if not model_free else []
    job_id = request.app.state.queue.enqueue(
        session_id, kind, body, subjects, model_free=bool(model_free),
    )
    url = f"/api/jobs/{job_id}"
    current = store.job(job_id, session_id)
    response.headers["Location"] = url
    return ok(
        request,
        {"job_id": job_id, "status": current["status"], "status_url": url},
    )
