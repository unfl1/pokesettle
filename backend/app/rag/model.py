import json
from contextlib import nullcontext

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from openai import APITimeoutError

from backend.app.core.errors import ServiceError
from backend.app.core.usage import active_usage


def input_reservation(system, payload, schema_data):
    # Keep the same conservative byte bound used for the daily budget.
    return len(json.dumps([system, payload, schema_data], ensure_ascii=False, default=str).encode()) + 1024


def prepare_payload(system, payload, schema_data, input_limit):
    """Keep past prose for interpretation, never resend stored result objects."""
    history_key = "history_for_interpretation_only"
    if history_key not in payload:
        return payload
    history = []
    for message in payload[history_key]:
        content = message.get("content")
        if message.get("role") == "assistant" and isinstance(content, dict):
            content = content.get("answer", "")
        if message.get("role") in {"user", "assistant"} and isinstance(content, str) and content:
            history.append({"role": message["role"], "content": content})
    prepared = {**payload, history_key: history}
    # Current inputs and evidence take priority over old interpretation-only prose.
    while history and input_reservation(system, prepared, schema_data) > input_limit:
        history.pop(0)
    return prepared


class StructuredModel:
    def __init__(self, settings, telemetry=None):
        self.settings = settings
        self.telemetry = telemetry

    def invoke(self, purpose, system, payload, schema):
        if not self.settings.model_configured:
            raise ServiceError(
                "MODEL_KEY_MISSING", "서버의 API 키와 CHAT_MODEL 설정을 확인하세요.", 503
            )
        usage = active_usage.get()
        if usage is None:
            raise ServiceError("USAGE_CONTEXT_MISSING", "모델 사용량 검증 경로가 필요합니다.", 503)
        # UTF-8 bytes bound byte-level tokens conservatively, including schema and framing.
        schema_data = schema.model_json_schema()
        payload = prepare_payload(system, payload, schema_data, self.settings.model_max_input_tokens)
        input_bound = input_reservation(system, payload, schema_data)
        if input_bound > self.settings.model_max_input_tokens:
            raise ServiceError("MODEL_INPUT_LIMIT", "현재 질문과 서버의 분석 자료가 처리 한도를 초과했습니다. 질문을 나누거나 비교할 대상을 줄여 주세요.", 422)
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
            # SDK retries must never bypass a reservation; retries happen explicitly below.
            max_retries=0,
            max_completion_tokens=self.settings.model_max_output_tokens,
        )
        attempts = min(2, self.settings.max_retries + 1)
        for attempt in range(attempts):
            reservation = usage[0].reserve(usage[1], input_bound + self.settings.model_max_output_tokens)
            try:
                with self.telemetry.model_attempt(purpose) if self.telemetry else nullcontext():
                    response = model.with_structured_output(
                        schema, method="json_schema", strict=True, include_raw=True
                    ).invoke(
                        [
                            SystemMessage(content=system),
                            HumanMessage(content=json.dumps(payload, ensure_ascii=False, default=str, separators=(",", ":"))),
                        ]
                    )
                    if response["parsing_error"] is not None or response["parsed"] is None:
                        raise ValueError("Invalid structured response")
            except ServiceError:
                raise
            except APITimeoutError:
                raise ServiceError(
                    "MODEL_TIMEOUT", "모델 응답 시간이 초과되었습니다.", 504, True
                ) from None
            except Exception:
                if attempt == attempts - 1:
                    raise ServiceError(
                        "GENERATION_INVALID",
                        "모델 호출 또는 구조화 출력 검증에 실패했습니다. 서버 모델 설정을 확인하세요.",
                        retryable=True,
                    ) from None
            else:
                # Settlement failures must not trigger a second paid provider call.
                usage[0].settle(reservation, getattr(response["raw"], "usage_metadata", None))
                return response["parsed"]
