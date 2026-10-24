from contextlib import asynccontextmanager

from fastapi import FastAPI

from backend.app.api.router import api_router
from backend.app.catalog import Catalog
from backend.app.core.config import Settings
from backend.app.core.exception_handlers import register_exception_handlers
from backend.app.core.middleware import configure_middleware
from backend.app.core.telemetry import Telemetry, TelemetryMiddleware
from backend.app.core.usage import UsageGuard
from backend.app.data_preparation.sources import build_source
from backend.app.http_client import SourceClient
from backend.app.rag.model import StructuredModel
from backend.app.rag.vector_store import VectorStore
from backend.app.services.knowledge import KnowledgeService
from backend.app.storage import Store


def create_service(settings, telemetry=None):
    store = Store(settings.database_url, settings.database_schema)
    catalog = Catalog(settings.data_dir / "pokemon.json")
    vectors = VectorStore(settings, store)
    source = build_source(settings, SourceClient(settings, store))
    return KnowledgeService(settings, catalog, store, vectors, source, StructuredModel(settings, telemetry))


def create_app(settings=None, *, service=None, usage=None):
    settings = settings or Settings.from_env()
    telemetry = Telemetry()

    @asynccontextmanager
    async def lifespan(app):
        # Importing the module must not open a database connection.
        app.state.service = service if service is not None else create_service(settings, telemetry)
        app.state.service.store.recover_jobs()
        app.state.usage = usage if usage is not None else UsageGuard(app.state.service.store, settings, telemetry)
        if settings.telemetry_enabled:
            telemetry.start(settings.runtime_dir / "telemetry")
        try:
            yield
        finally:
            telemetry.close()

    app = FastAPI(title="PokeTact", version="0.1.0", lifespan=lifespan)
    app.state.service = service
    app.state.settings = settings
    app.state.telemetry = telemetry
    configure_middleware(app, settings)
    app.add_middleware(TelemetryMiddleware, telemetry=telemetry)
    register_exception_handlers(app)
    app.include_router(api_router)
    return app


app = create_app()
