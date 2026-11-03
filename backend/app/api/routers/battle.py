from fastapi import APIRouter, Request

from backend.app.api import schemas
from backend.app.api.dependencies import ServiceDep, SessionDep, SettingsDep
from backend.app.api.responses import error_responses, ok
from backend.app.battle.damage import DamageInput, calculate_damage, damage_move_options
from backend.app.battle.engine import BattleEngine
from backend.app.battle.models import BattleInput

router = APIRouter(tags=["battle"], responses=error_responses(401, 404, 503, 504))


@router.get(
    "/battle/damage/moves/{pokemon_id}",
    status_code=200,
    response_model=schemas.Envelope[schemas.DamageMovesData],
    response_model_exclude_unset=True,
)
def damage_moves(request: Request, pokemon_id: str, *, session_id: SessionDep, service: ServiceDep):
    return ok(request, damage_move_options(service.catalog, pokemon_id))


@router.post(
    "/battle/damage",
    status_code=200,
    response_model=schemas.Envelope[schemas.DamageData],
    response_model_exclude_unset=True,
    responses=error_responses(502),
)
def damage(
    request: Request,
    body: DamageInput,
    *,
    session_id: SessionDep,
    service: ServiceDep,
    settings: SettingsDep,
):
    return ok(request, calculate_damage(body, service.catalog, settings))


@router.post(
    "/battle/analyze",
    status_code=200,
    response_model=schemas.Envelope[schemas.BattleData],
    response_model_exclude_unset=True,
)
@router.post(
    "/battle/recommend",
    status_code=200,
    response_model=schemas.Envelope[schemas.BattleData],
    response_model_exclude_unset=True,
)
def analyze_battle(
    request: Request,
    body: BattleInput,
    *,
    session_id: SessionDep,
    service: ServiceDep,
    settings: SettingsDep,
):
    engine = BattleEngine(service.catalog, settings.data_dir)
    return ok(request, engine.battle(body))
