from fastapi import APIRouter, Request
from fastapi.responses import Response

from backend.app.api.dependencies import CatalogDep, ServiceDep, SettingsDep, StoreDep
from backend.app.api.responses import ok
from backend.app.api.validation import session, validate_team
from backend.app.battle.engine import BattleEngine
from backend.app.battle.models import TeamAnalysis, TeamInput

router = APIRouter()


@router.get("/teams")
def team_list(request: Request, *, store: StoreDep):
    return ok(request, store.teams(session(request, store)))


@router.post("/teams")
def team_create(request: Request, body: TeamInput, *, store: StoreDep, catalog: CatalogDep):
    session_id = session(request, store)
    validate_team(body, catalog)
    return ok(request, store.save_team(session_id, body), 201)


@router.get("/teams/{team_id}")
def team_detail(request: Request, team_id: str, *, store: StoreDep):
    return ok(request, store.team(session(request, store), team_id))


@router.put("/teams/{team_id}")
def team_update(
    request: Request, team_id: str, body: TeamInput, *, store: StoreDep, catalog: CatalogDep
):
    session_id = session(request, store)
    store.team(session_id, team_id)
    validate_team(body, catalog)
    return ok(request, store.save_team(session_id, body, team_id))


@router.delete("/teams/{team_id}")
def team_delete(request: Request, team_id: str, *, store: StoreDep):
    store.delete_team(session(request, store), team_id)
    return Response(status_code=204)


@router.post("/teams/analyze")
def analyze_team(
    request: Request,
    body: TeamAnalysis,
    *,
    store: StoreDep,
    service: ServiceDep,
    settings: SettingsDep,
):
    session(request, store)
    engine = BattleEngine(service.catalog, settings.data_dir)
    return ok(request, engine.team_analysis(body))


@router.post("/teams/select")
def select_team(
    request: Request,
    body: TeamAnalysis,
    *,
    store: StoreDep,
    service: ServiceDep,
    settings: SettingsDep,
):
    session(request, store)
    engine = BattleEngine(service.catalog, settings.data_dir)
    return ok(request, engine.selection(body))
