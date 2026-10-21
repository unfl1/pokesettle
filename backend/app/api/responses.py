from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from pydantic.alias_generators import to_camel


def wire(value):
    value = jsonable_encoder(value)
    if isinstance(value, dict):
        return {to_camel(k): wire(v) for k, v in value.items()}
    if isinstance(value, list):
        return [wire(v) for v in value]
    return value


def ok(request, data, status=200, headers=None, warnings=None):
    return JSONResponse(
        {"data": wire(data), "requestId": request.state.request_id, "warnings": warnings or []},
        status_code=status,
        headers=headers,
    )
