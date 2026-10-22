from fastapi import APIRouter, Query, Request

from backend.app.api.dependencies import CatalogDep, ServiceDep, SettingsDep, StoreDep
from backend.app.api.responses import ok
from backend.app.api.validation import check_scope, session
from backend.app.schemas import ConversationRequest

router = APIRouter()


@router.post("/conversations")
def new_conversation(
    request: Request,
    body: ConversationRequest,
    *,
    store: StoreDep,
    settings: SettingsDep,
    service: ServiceDep,
):
    session_id = session(request, store)
    check_scope(body, service, settings)
    identifier = store.conversation(session_id, body.pokemon_id, body.regulation_id)
    return ok(
        request,
        {
            "conversation_id": identifier,
            "pokemon_id": body.pokemon_id,
            "regulation_id": body.regulation_id,
        },
        201,
    )


@router.get("/conversations")
def conversation_list(
    request: Request,
    pokemon_id: str | None = Query(None, alias="pokemonId"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    *,
    store: StoreDep,
    catalog: CatalogDep,
):
    session_id = session(request, store)
    if pokemon_id:
        catalog.get(pokemon_id)
    return ok(request, store.conversations(session_id, pokemon_id, limit, offset))


@router.get("/conversations/{conversation_id}/messages")
def conversation_messages(
    request: Request,
    conversation_id: str,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    *,
    store: StoreDep,
):
    return ok(request, store.messages(session(request, store), conversation_id, limit, offset))
