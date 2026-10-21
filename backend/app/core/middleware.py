from uuid import uuid4

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.app.core.config import Settings


def configure_middleware(app: FastAPI, settings: Settings):
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.allowed_origins),
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE"],
        allow_headers=["Content-Type"],
    )

    @app.middleware("http")
    async def request_context(request, call_next):
        request.state.request_id = str(uuid4())
        origin = request.headers.get("origin")
        if (
            request.method not in {"GET", "HEAD", "OPTIONS"}
            and origin
            and origin not in settings.allowed_origins
        ):
            return JSONResponse(
                {
                    "error": {
                        "code": "ORIGIN_NOT_ALLOWED",
                        "message": "허용되지 않은 요청 출처입니다.",
                        "retryable": False,
                        "details": [],
                    },
                    "requestId": request.state.request_id,
                },
                status_code=403,
            )
        response = await call_next(request)
        response.headers["X-Request-ID"] = request.state.request_id
        return response
