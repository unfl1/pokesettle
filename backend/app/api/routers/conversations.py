from fastapi import APIRouter, Query, Request
from fastapi.responses import Response

from backend.app.api import schemas
from backend.app.api.dependencies import CatalogDep, ServiceDep, SessionDep, SettingsDep, StoreDep
from backend.app.api.responses import error_responses, ok
from backend.app.api.validation import check_scope
from backend.app.schemas import ConversationRequest

router = APIRouter(tags=["conversations"], responses=error_responses(401, 404, 409))


@router.post(
    "/conversations",
    status_code=201,
    response_model=schemas.Envelope[schemas.ConversationCreated],
    response_model_exclude_unset=True,
)
def new_conversation(
    request: Request,
    body: ConversationRequest,
    *,
    store: StoreDep,
    session_id: SessionDep,
    settings: SettingsDep,
    service: ServiceDep,
):
    check_scope(body, service, settings)
    identifier = store.conversation(session_id, body.pokemon_id, body.regulation_id)
    return ok(
        request,
        {
            "conversation_id": identifier,
            "pokemon_id": body.pokemon_id,
            "regulation_id": body.regulation_id,
        },
    )


@router.get(
    "/conversations",
    status_code=200,
    response_model=schemas.Envelope[schemas.Page[schemas.ConversationData]],
    response_model_exclude_unset=True,
)
def conversation_list(
    request: Request,
    pokemon_id: str | None = Query(None, alias="pokemonId"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    *,
    store: StoreDep,
    session_id: SessionDep,
    catalog: CatalogDep,
):
    if pokemon_id:
        catalog.get(pokemon_id)
    return ok(request, store.conversations(session_id, pokemon_id, limit, offset))


@router.get(
    "/conversations/{conversation_id}/messages",
    status_code=200,
    response_model=schemas.Envelope[schemas.MessagesData],
    response_model_exclude_unset=True,
)
def conversation_messages(
    request: Request,
    conversation_id: str,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    *,
    store: StoreDep,
    session_id: SessionDep,
):
    return ok(request, store.messages(session_id, conversation_id, limit, offset))


@router.delete("/conversations/{conversation_id}", status_code=204, response_class=Response)
def conversation_delete(
    request: Request, conversation_id: str, *, store: StoreDep, session_id: SessionDep
):
    store.delete_conversation(session_id, conversation_id)
    return Response(status_code=204)
