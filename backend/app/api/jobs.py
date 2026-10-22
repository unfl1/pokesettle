from backend.app.api.responses import ok
from backend.app.api.validation import check_scope, ensure_ready, session
from backend.app.services.catalog_answers import catalog_question
from backend.app.services.jobs import run_job


def submit(request, background, body, kind, service, settings):
    store = service.store
    session_id = session(request, store)
    check_scope(body, service, settings)
    if kind != "chat" or not catalog_question(service.catalog, body.pokemon_id, body.question):
        ensure_ready(service, settings)
    if kind in {"chat", "guide"} and body.conversation_id:
        store.conversation(session_id, body.pokemon_id, body.regulation_id, body.conversation_id)
    job_id, created = store.create_job(
        session_id, kind, str(body.client_request_id), body.model_dump(mode="json")
    )
    if created:
        background.add_task(run_job, service, job_id, kind, body, session_id)
    url = f"/api/jobs/{job_id}"
    current = store.job(job_id, session_id)
    return ok(
        request,
        {"job_id": job_id, "status": current["status"], "status_url": url},
        202,
        {"Location": url},
    )
