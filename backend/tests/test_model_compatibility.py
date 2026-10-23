from types import SimpleNamespace

import pytest

from backend.app.core.config import Settings
from backend.app.rag.model import StructuredModel
from backend.app.schemas import Generation


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
    assert StructuredModel(settings).invoke(purpose, 'test', {}, Generation) is result
    assert captured['model'] == model
    assert captured['temperature'] == expected
    expected_reasoning = ('medium' if purpose == 'battle_state' else 'none') if model == 'gpt-6-luna' else None
    assert captured['reasoning_effort'] == expected_reasoning

