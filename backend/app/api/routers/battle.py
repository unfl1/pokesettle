from fastapi import APIRouter, Request

from backend.app.api.dependencies import ServiceDep, SettingsDep, StoreDep
from backend.app.api.responses import ok
from backend.app.api.validation import session
from backend.app.battle.damage import DamageInput, calculate_damage
from backend.app.battle.engine import BattleEngine
from backend.app.battle.models import BattleInput

router = APIRouter()


@router.post("/battle/damage")
def damage(
    request: Request,
    body: DamageInput,
    *,
    store: StoreDep,
    service: ServiceDep,
    settings: SettingsDep,
):
    session(request, store)
    return ok(request, calculate_damage(body, service.catalog, settings))


@router.post("/battle/analyze")
@router.post("/battle/recommend")
def analyze_battle(
    request: Request,
    body: BattleInput,
    *,
    store: StoreDep,
    service: ServiceDep,
    settings: SettingsDep,
):
    session(request, store)
    engine = BattleEngine(service.catalog, settings.data_dir)
    return ok(request, engine.battle(body))
