from fastapi import APIRouter

from backend.app.api.routers import (
    battle,
    conversations,
    knowledge,
    metagame,
    pokemon,
    system,
    teams,
)

api_router = APIRouter(prefix="/api")
for route_module in (system, pokemon, conversations, knowledge, teams, battle, metagame):
    api_router.include_router(route_module.router)
