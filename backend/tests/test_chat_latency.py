from dataclasses import replace
from uuid import uuid4

import pytest

from backend.app.battle.conversation import BattleUpdate, evaluate_state
from backend.app.catalog import Catalog
from backend.app.core.config import ROOT
from backend.app.rag.graph import build_graph
from backend.app.schemas import ChatRequest, Generation


@pytest.mark.parametrize('battle,research', [(True, False), (False, False), (True, True)])
def test_only_evaluated_battles_reuse_prepared_index_without_external_collection(setup, monkeypatch, battle, research):
    catalog = Catalog(ROOT / 'data/pokemon.json')
    setup.service.catalog = catalog
    setup.service.settings = replace(setup.settings, data_dir=ROOT / 'data')
    setup.vectors.upsert_metadata([catalog.get('pokemon:908'), catalog.get('pokemon:911')])
    collected, invoked = [], []

    def collect(*args):
        assert not (battle and not research), 'simple evaluated battle must not collect external documents'
        collected.append(args)
        return {'queries': []}

    def invoke(purpose, prompt, payload, schema):
        invoked.append(purpose)
        if purpose == 'battle_state':
            return BattleUpdate(relevant=True, own_id='pokemon:908', opponent_id='pokemon:911')
        return Generation(answer_status='abstained', claims=[], assumptions=[], unknowns=[])

    monkeypatch.setattr(setup.service, 'collect', collect)
    monkeypatch.setattr(setup.model, 'invoke', invoke)
    question = '내 선봉은 마스카나이고 상대 선봉은 라우드본이야. 어떻게 해?' if battle else '마스카나 운영 전략을 근거와 함께 설명해줘'
    if research:
        question = '내 선봉은 마스카나이고 상대 선봉은 라우드본이야. 특성 설명과 근거를 검색해줘'
    result = setup.service.chat(ChatRequest(question=question, client_request_id=uuid4()), setup.store.new_session())
    assert bool(collected) == (not battle or research)
    assert 'generate' in invoked  # Strategy generation and RAG remain available.
    if battle:
        assert result['citations']
        assert '악 타입 기술로 공격' in result['answer']


def test_selection_retrieves_evidence_without_discarded_generation_call(setup):
    from types import SimpleNamespace

    catalog = Catalog(ROOT / 'data/pokemon.json')
    own = ['pokemon:25', 'pokemon:3', 'pokemon:6', 'pokemon:9', 'pokemon:445', 'pokemon:468']
    context = evaluate_state({'selection_requested': True, 'own_team_ids': own, 'opponent_team_ids': own}, catalog, ROOT / 'data')
    setup.vectors.upsert_metadata([catalog.get(own[0])])
    stages = []

    def invoke(*args):
        raise AssertionError('computed selection must not generate discarded prose')

    result = build_graph(setup.vectors, SimpleNamespace(invoke=invoke), stages.append).invoke({'pokemon_id': own[0], 'question': '3마리와 선봉 추천', 'battle_context': context})['result']
    assert 'retrieving' in stages and 'validating_citations' in stages
    assert '선출을 추천' in result['answer'] and '선봉 후보' in result['answer']
    assert result['citations']


def test_repeated_battle_followups_fit_model_limit_with_stored_results(setup, monkeypatch):
    import json
    from types import SimpleNamespace

    from backend.app.core.usage import active_usage
    from backend.app.rag.model import StructuredModel, input_reservation

    catalog = Catalog(ROOT / 'data/pokemon.json')
    setup.service.catalog = catalog
    settings = replace(setup.settings, data_dir=ROOT / 'data', api_key='synthetic', chat_model='test')
    setup.service.settings = settings
    setup.service.model = StructuredModel(settings)
    setup.vectors.upsert_metadata([catalog.get('pokemon:908'), catalog.get('pokemon:911')])
    sent = []

    class Client:
        def __init__(self, **kwargs):
            pass

        def with_structured_output(self, schema, **kwargs):
            self.schema = schema
            return self

        def invoke(self, messages):
            payload = json.loads(messages[1].content)
            sent.append((self.schema, payload))
            assert input_reservation(messages[0].content, payload, self.schema.model_json_schema()) <= settings.model_max_input_tokens
            if self.schema is BattleUpdate:
                return BattleUpdate(relevant=True, own_id='pokemon:908', opponent_id='pokemon:911')
            return Generation(answer_status='abstained', claims=[], assumptions=[], unknowns=[])

    monkeypatch.setattr('backend.app.rag.model.ChatOpenAI', Client)
    monkeypatch.setattr(setup.service, 'collect', lambda *args: pytest.fail('battle should use prepared index'))
    session = setup.store.new_session()
    cid = None
    token = active_usage.set((SimpleNamespace(reserve=lambda *args: None), 'test'))
    try:
        for question in ['내 선봉은 마스카나이고 상대 선봉은 라우드본이야. 어떻게 해?', *['그럼 어떻게 할까?'] * 6]:
            result = setup.service.chat(ChatRequest(question=question, conversation_id=cid, client_request_id=uuid4()), session)
            cid = result['conversation_id']
            assert result['citations']
            assert result['battle_context']['state']['own_id'] == 'pokemon:908'
    finally:
        active_usage.reset(token)
    generations = [payload for schema, payload in sent if schema is Generation]
    assert len(generations) == 7
    assert generations[-1]['history_for_interpretation_only']
    assert all(isinstance(message['content'], str) for message in generations[-1]['history_for_interpretation_only'])
    assert isinstance(setup.store.history(cid)[-1]['content'], dict)
