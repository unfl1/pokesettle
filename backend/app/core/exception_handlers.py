import logging

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

from backend.app.core.errors import ServiceError

logger = logging.getLogger(__name__)


async def service_error(request, error):
    return JSONResponse(
        {"error": error.as_dict(), "requestId": request.state.request_id},
        status_code=error.status,
        headers={"Retry-After": "60"} if error.status == 429 else None,
    )


async def input_error(request, error):
    details = [{"field": ".".join(map(str, e["loc"])), "code": e["type"]} for e in error.errors()]
    return JSONResponse(
        {
            "error": {
                "code": "INVALID_INPUT",
                "message": "입력 형식을 확인하세요.",
                "retryable": False,
                "details": details,
            },
            "requestId": request.state.request_id,
        },
        status_code=422,
    )


async def http_error(request, error):
    return JSONResponse(
        {
            "error": {
                "code": "RESOURCE_NOT_FOUND" if error.status_code == 404 else "HTTP_ERROR",
                "message": "요청 경로 또는 방식을 확인하세요.",
                "retryable": False,
                "details": [],
            },
            "requestId": request.state.request_id,
        },
        status_code=error.status_code,
    )


async def internal_error(request, error):
    # Do not log raw provider exceptions: they may contain prompts or credentials.
    logger.error(
        "Internal failure request_id=%s type=%s", request.state.request_id, type(error).__name__
    )
    return JSONResponse(
        {
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "처리 중 오류가 발생했습니다.",
                "retryable": False,
                "details": [],
            },
            "requestId": request.state.request_id,
        },
        status_code=500,
    )


def register_exception_handlers(app: FastAPI):
    app.add_exception_handler(ServiceError, service_error)
    app.add_exception_handler(RequestValidationError, input_error)
    app.add_exception_handler(HTTPException, http_error)
    app.add_exception_handler(Exception, internal_error)
