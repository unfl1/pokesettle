from typing import Annotated

from fastapi import Depends, Request

from backend.app.catalog import Catalog
from backend.app.core.config import Settings
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
