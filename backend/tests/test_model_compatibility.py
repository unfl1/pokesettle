from types import SimpleNamespace

import pytest

from backend.app.core.config import Settings
from backend.app.rag.model import StructuredModel
from backend.app.schemas import Generation


def test_installed_sdk_preserves_usage_with_structured_response(monkeypatch):
    import json

    import httpx
    from langchain_openai import ChatOpenAI

    from backend.app.core.usage import active_usage

    result = Generation(answer_status='abstained', claims=[], assumptions=[], unknowns=[])
    requests, settled = [], []

    def respond(request):
        requests.append(json.loads(request.content))
        return httpx.Response(200, json={
            'id': 'synthetic-completion', 'object': 'chat.completion', 'created': 1,
            'model': 'gpt-4.1-mini',
            'choices': [{'index': 0, 'finish_reason': 'stop', 'message': {
                'role': 'assistant', 'content': result.model_dump_json(), 'refusal': None,
            }}],
            'usage': {'prompt_tokens': 1200, 'completion_tokens': 300, 'total_tokens': 1500},
        })

    with httpx.Client(transport=httpx.MockTransport(respond)) as client:
        monkeypatch.setattr('backend.app.rag.model.ChatOpenAI',
                            lambda **kwargs: ChatOpenAI(**kwargs, http_client=client))
        guard = SimpleNamespace(reserve=lambda *args: 'reservation',
                                settle=lambda ticket, usage: settled.append((ticket, usage)))
        token = active_usage.set((guard, 'lease'))
        try:
            settings = Settings(api_key='synthetic', chat_model='gpt-4.1-mini', base_url='https://provider.test/v1')
            assert StructuredModel(settings).invoke('generate', 'test', {}, Generation) == result
        finally:
            active_usage.reset(token)
    assert len(requests) == 1
    assert requests[0]['response_format']['type'] == 'json_schema'
    assert settled[0][0] == 'reservation'
    assert {key: settled[0][1][key] for key in ('input_tokens', 'output_tokens', 'total_tokens')} == {
        'input_tokens': 1200, 'output_tokens': 300, 'total_tokens': 1500,
    }


@pytest.mark.parametrize('base_url', ['', 'https://provider.example/v1'])
def test_empty_endpoint_uses_openai_and_custom_endpoint_is_preserved(monkeypatch, base_url):
    monkeypatch.setattr('backend.app.core.config.load_dotenv', lambda *args, **kwargs: None)
    monkeypatch.setenv('OPENAI_BASE_URL', base_url)
    settings = Settings.from_env()
    assert settings.base_url == (base_url or 'https://api.openai.com/v1')


@pytest.mark.parametrize('model, purpose, expected', [
    ('gpt-6-luna', 'generate', None),
    ('gpt-6-luna', 'discovery', None),
    ('gpt-6-luna', 'battle_state', None),
    ('gpt-4.1-mini', 'generate', 0),
    ('gpt-4.1-mini', 'battle_state', None),
])
def test_structured_calls_preserve_contract_and_omit_unsupported_temperature(monkeypatch, model, purpose, expected):
    captured = {}
    result = Generation(answer_status='abstained', claims=[], assumptions=[], unknowns=[])

    class Client:
        def __init__(self, **kwargs):
            captured.update(kwargs)

        def with_structured_output(self, schema, **kwargs):
            assert schema is Generation
            assert kwargs == {'method': 'json_schema', 'strict': True, 'include_raw': True}
            return SimpleNamespace(invoke=lambda messages: {'parsed': result, 'raw': None, 'parsing_error': None})

    monkeypatch.setattr('backend.app.rag.model.ChatOpenAI', Client)
    settings = Settings(api_key='synthetic-test-key', chat_model=model)
    from backend.app.core.usage import active_usage
    token = active_usage.set((SimpleNamespace(reserve=lambda *args: None, settle=lambda *args: None), "test"))
    try:
        assert StructuredModel(settings).invoke(purpose, 'test', {}, Generation) is result
    finally:
        active_usage.reset(token)
    assert captured['max_retries'] == 0
    assert captured['max_completion_tokens'] == settings.model_max_output_tokens
    assert captured['model'] == model
    assert captured['temperature'] == expected
    expected_reasoning = ('medium' if purpose == 'battle_state' else 'none') if model == 'gpt-6-luna' else None
    assert captured['reasoning_effort'] == expected_reasoning


@pytest.mark.parametrize('exchanges', [1, 6])
def test_followup_does_not_resend_stored_citations_or_battle_results(monkeypatch, exchanges):
    import json

    from backend.app.core.usage import active_usage
    from backend.app.rag.model import input_reservation

    history = []
    for _ in range(exchanges):
        history.extend([
            {'role': 'user', 'content': '피카츄와 갸라도스 대면에서 어떻게 해?'},
            {'role': 'assistant', 'content': {
                'answer': '전기 타입 상성을 확인해 주세요.',
                'citations': [{'text': '이전 참고 자료' * 3000}],
                'battle_context': {'old_calculation': '지난 계산' * 3000},
            }},
        ])
    payload = {
        'question': '상대가 바뀌면?',
        'history_for_interpretation_only': history,
        'evidence': [{'evidence_id': 'current', 'text': '현재 근거'}],
        'battle_context_from_user_inputs_and_type_tool': {'state': {'own_id': 'pokemon:25'}},
    }
    settings = Settings(api_key='synthetic', chat_model='test')
    assert input_reservation('test', payload, Generation.model_json_schema()) > settings.model_max_input_tokens
    captured, reserved = [], []

    class Client:
        def __init__(self, **kwargs):
            pass

        def with_structured_output(self, *args, **kwargs):
            return self

        def invoke(self, messages):
            captured.append(json.loads(messages[1].content))
            return {'parsed': Generation(answer_status='abstained', claims=[], assumptions=[], unknowns=[]), 'raw': None, 'parsing_error': None}

    monkeypatch.setattr('backend.app.rag.model.ChatOpenAI', Client)
    token = active_usage.set((SimpleNamespace(reserve=lambda lease, amount: reserved.append(amount), settle=lambda *args: None), 'test'))
    try:
        StructuredModel(settings).invoke('generate', 'test', payload, Generation)
    finally:
        active_usage.reset(token)
    sent = captured[0]
    assert sent['question'] == payload['question']
    assert sent['evidence'] == payload['evidence']
    assert sent['battle_context_from_user_inputs_and_type_tool'] == payload['battle_context_from_user_inputs_and_type_tool']
    assert len(sent['history_for_interpretation_only']) == exchanges * 2
    assert sent['history_for_interpretation_only'][-1]['content'] == '전기 타입 상성을 확인해 주세요.'
    assert isinstance(history[-1]['content'], dict)  # Stored UI result remains untouched.
    assert reserved == [input_reservation('test', sent, Generation.model_json_schema()) + settings.model_max_output_tokens]


def test_input_limit_discards_oldest_prose_but_preserves_current_evidence():
    from backend.app.rag.model import input_reservation, prepare_payload

    schema = Generation.model_json_schema()
    payload = {
        'question': '지금은?',
        'evidence': [{'text': '현재 근거'}],
        'history_for_interpretation_only': [
            {'role': 'user', 'content': '옛 질문' * 3000},
            {'role': 'assistant', 'content': {'answer': '옛 답변' * 3000}},
            {'role': 'user', 'content': '최근 질문'},
        ],
    }
    prepared = prepare_payload('test', payload, schema, 4000)
    assert input_reservation('test', prepared, schema) <= 4000
    assert prepared['history_for_interpretation_only'] == [{'role': 'user', 'content': '최근 질문'}]
    assert prepared['evidence'] == payload['evidence']
    assert len(payload['history_for_interpretation_only']) == 3


def test_current_material_is_never_truncated_to_fit_input_limit(monkeypatch):
    from backend.app.core.errors import ServiceError
    from backend.app.core.usage import active_usage

    def unexpected(*args, **kwargs):
        raise AssertionError('Oversized current material must not call or reserve a model')

    monkeypatch.setattr('backend.app.rag.model.ChatOpenAI', unexpected)
    token = active_usage.set((SimpleNamespace(reserve=unexpected), 'test'))
    try:
        with pytest.raises(ServiceError) as error:
            StructuredModel(Settings(api_key='synthetic', chat_model='test')).invoke(
                'generate', 'test', {'evidence': ['가' * 10000], 'history_for_interpretation_only': []}, Generation
            )
        assert error.value.code == 'MODEL_INPUT_LIMIT'
    finally:
        active_usage.reset(token)
