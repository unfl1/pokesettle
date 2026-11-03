from typing import Annotated

from fastapi import Cookie, Depends, Request

from backend.app.catalog import Catalog
from backend.app.core.config import Settings
from backend.app.core.errors import ServiceError
from backend.app.rag.vector_store import VectorStore
from backend.app.services.knowledge import KnowledgeService
from backend.app.storage import Store


def get_service(request: Request) -> KnowledgeService:
    return request.app.state.service


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


ServiceDep = Annotated[KnowledgeService, Depends(get_service)]
SettingsDep = Annotated[Settings, Depends(get_settings)]


def get_store(service: ServiceDep) -> Store:
    return service.store


def get_catalog(service: ServiceDep) -> Catalog:
    return service.catalog


def get_vectors(service: ServiceDep) -> VectorStore:
    return service.vectors


StoreDep = Annotated[Store, Depends(get_store)]
CatalogDep = Annotated[Catalog, Depends(get_catalog)]
VectorDep = Annotated[VectorStore, Depends(get_vectors)]


def get_session(
    store: StoreDep,
    session_id: Annotated[str | None, Cookie(alias="pokecoach_session")] = None,
) -> str:
    if not store.session_valid(session_id):
        raise ServiceError("SESSION_REQUIRED", "세션을 먼저 생성하세요.", 401)
    return session_id


SessionDep = Annotated[str, Depends(get_session)]
