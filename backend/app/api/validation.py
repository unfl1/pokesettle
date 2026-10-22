import json

from backend.app.core.errors import ServiceError


def session(request, store):
    session_id = request.cookies.get("pokecoach_session")
    if not store.session_valid(session_id):
        raise ServiceError("SESSION_REQUIRED", "세션을 먼저 생성하세요.", 401)
    return session_id


def regulations(settings):
    return [
        json.loads(p.read_text())
        for p in sorted((settings.data_dir / "regulations").glob("*.json"))
    ]


def check_scope(request_data, service, settings):
    service.catalog.get(request_data.pokemon_id)
    if request_data.regulation_id and request_data.regulation_id not in {
        r["regulation_id"] for r in regulations(settings)
    }:
        raise ServiceError("UNKNOWN_REGULATION", "등록되지 않은 규칙입니다.", 422)


def ensure_ready(service, settings):
    if not service.vectors.meta.count():
        raise ServiceError("INDEX_NOT_READY", "메타데이터 색인을 먼저 준비하세요.", 503)
    if not settings.model_configured:
        raise ServiceError("MODEL_KEY_MISSING", "서버 API 키와 CHAT_MODEL을 설정하세요.", 503)


def validate_team(body, catalog):
    pokemon = [catalog.get(m.pokemon_id) for m in body.members]
    if len({p.species_id for p in pokemon}) != len(pokemon):
        raise ServiceError("DUPLICATE_SPECIES", "팀 편집에서는 같은 종을 하나씩만 입력하세요.", 422)
