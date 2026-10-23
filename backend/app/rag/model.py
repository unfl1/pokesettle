import json

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from openai import APITimeoutError

from backend.app.core.errors import ServiceError


class StructuredModel:
    def __init__(self, settings):
        self.settings = settings

    def invoke(self, purpose, system, payload, schema):
        if not self.settings.model_configured:
            raise ServiceError(
                "MODEL_KEY_MISSING", "서버의 API 키와 CHAT_MODEL 설정을 확인하세요.", 503
            )
        model = ChatOpenAI(
            model=self.settings.chat_model,
            reasoning_effort=(
                "medium" if purpose == "battle_state" else "none"
            ) if self.settings.chat_model == "gpt-6-luna" else None,
            temperature=0
            if purpose in {"discovery", "generate"} and self.settings.chat_model != "gpt-6-luna"
            else None,
            api_key=self.settings.api_key,
            base_url=self.settings.base_url,
            timeout=self.settings.llm_timeout,
            max_retries=self.settings.max_retries,
        )
        for attempt in range(2):
            try:
                return model.with_structured_output(
                    schema, method="json_schema", strict=True
                ).invoke(
                    [
                        SystemMessage(content=system),
                        HumanMessage(content=json.dumps(payload, ensure_ascii=False, default=str)),
                    ]
                )
            except APITimeoutError:
                raise ServiceError(
                    "MODEL_TIMEOUT", "모델 응답 시간이 초과되었습니다.", 504, True
                ) from None
            except Exception:
                if attempt == 1:
                    raise ServiceError(
                        "GENERATION_INVALID",
                        "모델 호출 또는 구조화 출력 검증에 실패했습니다. 서버 모델 설정을 확인하세요.",
                        retryable=True,
                    ) from None
