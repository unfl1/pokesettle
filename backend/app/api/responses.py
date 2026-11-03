from http import HTTPStatus

from fastapi.encoders import jsonable_encoder
from pydantic.alias_generators import to_camel

from backend.app.api.schemas import ErrorResponse


def wire(value):
    value = jsonable_encoder(value)
    if isinstance(value, dict):
        return {to_camel(k): wire(v) for k, v in value.items()}
    if isinstance(value, list):
        return [wire(v) for v in value]
    return value


def ok(request, data, *, warnings=None):
    """Return ordinary data so FastAPI validates and serializes the declared response model."""
    return {"data": wire(data), "requestId": request.state.request_id, "warnings": warnings or []}


def error_responses(*statuses: int):
    """Document the same safe error envelope used by handlers and middleware."""
    return {
        status: {"model": ErrorResponse, "description": HTTPStatus(status).phrase}
        for status in statuses
    }
