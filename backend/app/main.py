from contextlib import asynccontextmanager

from fastapi import FastAPI

from backend.app.api.router import api_router
from backend.app.catalog import Catalog
from backend.app.core.config import Settings
from backend.app.core.exception_handlers import register_exception_handlers
from backend.app.core.middleware import configure_middleware
from backend.app.data_preparation.pokeapi import PokeApiSource
from backend.app.http_client import SourceClient
from backend.app.rag.model import StructuredModel
from backend.app.rag.vector_store import VectorStore
from backend.app.services.knowledge import KnowledgeService
from backend.app.storage import Store


def create_app(settings=None, *, service=None):
    settings = settings or Settings.from_env()
    if service is None:
        store = Store(settings.runtime_dir / "state.sqlite3")
        catalog = Catalog(settings.data_dir / "pokemon.json")
        vectors = VectorStore(settings, store)
        source = PokeApiSource(SourceClient(settings, store))
        service = KnowledgeService(
            settings, catalog, store, vectors, source, StructuredModel(settings)
        )

    @asynccontextmanager
    async def lifespan(app):
        service.store.recover_jobs()
        yield

    app = FastAPI(title="PokéCoach AI", version="0.1.0", lifespan=lifespan)
    app.state.service = service
    app.state.settings = settings
    configure_middleware(app, settings)
    register_exception_handlers(app)
    app.include_router(api_router)
    return app


app = create_app()
