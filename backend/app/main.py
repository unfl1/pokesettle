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
from backend.app.services.job_queue import JobQueue
from backend.app.services.knowledge import KnowledgeService
from backend.app.services.metagame import MetagameService
from backend.app.storage import Store
from backend.app.worker import JobWorker


def create_service(settings, telemetry=None):
    store = Store(settings.database_url, settings.database_schema,
                  pool_size=settings.database_pool_size, pool_timeout=settings.database_pool_timeout)
    try:
        catalog = Catalog(settings.data_dir / "pokemon.json")
        vectors = VectorStore(settings, store)
        source = build_source(settings, SourceClient(settings, store))
        return KnowledgeService(settings, catalog, store, vectors, source, StructuredModel(settings, telemetry))
    except BaseException:
        store.close()
        raise


def create_app(settings=None, *, service=None, usage=None):
    settings = settings or Settings.from_env()
    telemetry = Telemetry()

    @asynccontextmanager
    async def lifespan(app):
        # Importing the module must not open a database connection.
        app.state.service = service if service is not None else create_service(settings, telemetry)
        worker = None
        try:
            app.state.service.store.recover_jobs()
            app.state.usage = usage if usage is not None else UsageGuard(app.state.service.store, settings, telemetry)
            app.state.queue = JobQueue(app.state.service.store, app.state.usage)
            if settings.job_worker_embedded:
                worker = JobWorker(app.state.service, app.state.usage)
                worker.start()
            if settings.telemetry_enabled:
                telemetry.start(settings.runtime_dir / "telemetry")
            yield
        finally:
            if worker:
                worker.close()
            telemetry.close()
            if service is None:
                try:
                    model = getattr(app.state.service, "model", None)
                    if model is not None:
                        await model.aclose()
                finally:
                    embed = getattr(getattr(app.state.service, "vectors", None), "embed", None)
                    if callable(getattr(embed, "close", None)):
                        embed.close()
                    app.state.service.store.close()

    app = FastAPI(title="PokeSettle", version="0.1.0", lifespan=lifespan)
    app.state.service = service
    app.state.settings = settings
    app.state.metagame = MetagameService()
    app.state.telemetry = telemetry
    configure_middleware(app, settings)
    app.add_middleware(TelemetryMiddleware, telemetry=telemetry)
    register_exception_handlers(app)
    app.include_router(api_router)
    return app


app = create_app()
