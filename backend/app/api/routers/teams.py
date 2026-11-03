from fastapi import APIRouter, Request
from fastapi.responses import Response

from backend.app.api import schemas
from backend.app.api.dependencies import CatalogDep, ServiceDep, SessionDep, SettingsDep, StoreDep
from backend.app.api.responses import error_responses, ok
from backend.app.api.validation import validate_team
from backend.app.battle.engine import BattleEngine
from backend.app.battle.models import TeamAnalysis, TeamInput

router = APIRouter(tags=["teams"], responses=error_responses(401, 404, 503))


@router.get(
    "/teams",
    status_code=200,
    response_model=schemas.Envelope[schemas.Items[schemas.SavedTeam]],
    response_model_exclude_unset=True,
)
def team_list(request: Request, *, store: StoreDep, session_id: SessionDep):
    return ok(request, store.teams(session_id))


@router.post(
    "/teams",
    status_code=201,
    response_model=schemas.Envelope[schemas.SavedTeam],
    response_model_exclude_unset=True,
)
def team_create(
    request: Request,
    body: TeamInput,
    *,
    store: StoreDep,
    session_id: SessionDep,
    catalog: CatalogDep,
):
    validate_team(body, catalog)
    return ok(request, store.save_team(session_id, body))


@router.get(
    "/teams/{team_id}",
    status_code=200,
    response_model=schemas.Envelope[schemas.SavedTeam],
    response_model_exclude_unset=True,
)
def team_detail(request: Request, team_id: str, *, store: StoreDep, session_id: SessionDep):
    return ok(request, store.team(session_id, team_id))


@router.put(
    "/teams/{team_id}",
    status_code=200,
    response_model=schemas.Envelope[schemas.SavedTeam],
    response_model_exclude_unset=True,
)
def team_update(
    request: Request,
    team_id: str,
    body: TeamInput,
    *,
    store: StoreDep,
    session_id: SessionDep,
    catalog: CatalogDep,
):
    store.team(session_id, team_id)
    validate_team(body, catalog)
    return ok(request, store.save_team(session_id, body, team_id))


@router.delete("/teams/{team_id}", status_code=204, response_class=Response)
def team_delete(request: Request, team_id: str, *, store: StoreDep, session_id: SessionDep):
    store.delete_team(session_id, team_id)
    return Response(status_code=204)


@router.post(
    "/teams/analyze",
    status_code=200,
    response_model=schemas.Envelope[schemas.TeamAnalysisData],
    response_model_exclude_unset=True,
)
def analyze_team(
    request: Request,
    body: TeamAnalysis,
    *,
    session_id: SessionDep,
    service: ServiceDep,
    settings: SettingsDep,
):
    engine = BattleEngine(service.catalog, settings.data_dir)
    return ok(request, engine.team_analysis(body))


@router.post(
    "/teams/select",
    status_code=200,
    response_model=schemas.Envelope[schemas.SelectionData],
    response_model_exclude_unset=True,
)
def select_team(
    request: Request,
    body: TeamAnalysis,
    *,
    session_id: SessionDep,
    service: ServiceDep,
    settings: SettingsDep,
):
    engine = BattleEngine(service.catalog, settings.data_dir)
    return ok(request, engine.selection(body))
