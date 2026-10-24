from types import SimpleNamespace

import pytest

from backend.app.core.config import Settings
from backend.app.rag.model import StructuredModel
from backend.app.schemas import Generation


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
            assert kwargs == {'method': 'json_schema', 'strict': True}
            return SimpleNamespace(invoke=lambda messages: result)

    monkeypatch.setattr('backend.app.rag.model.ChatOpenAI', Client)
    settings = Settings(api_key='synthetic-test-key', chat_model=model)
    from backend.app.core.usage import active_usage
    token = active_usage.set((SimpleNamespace(reserve=lambda *args: None), "test"))
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
