from dataclasses import replace
from uuid import uuid4

import pytest

from backend.app.battle.conversation import BattleUpdate, evaluate_state
from backend.app.catalog import Catalog
from backend.app.core.config import ROOT
from backend.app.rag.graph import build_graph
from backend.app.schemas import BattleExplanation, ChatRequest, Generation
from backend.tests.conftest import document


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
        setup.vectors.index_document(args[0], document('poketact:strategy:test', 'TEST ONLY: conditional strategy.'))
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
    assert ('generate' in invoked) == (not battle or research)
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
    assert '조합을 추천' in result['answer'] and '선봉으로는' in result['answer']
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
    setup.vectors.index_document('pokemon:908', document('poketact:strategy:test', 'TEST ONLY: conditional strategy.'))
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
                return {'parsed': BattleUpdate(relevant=True, own_id='pokemon:908', opponent_id='pokemon:911'), 'raw': None, 'parsing_error': None}
            return {'parsed': Generation(answer_status='abstained', claims=[], assumptions=[], unknowns=[]), 'raw': None, 'parsing_error': None}

    monkeypatch.setattr('backend.app.rag.model.ChatOpenAI', Client)
    monkeypatch.setattr(setup.service, 'collect', lambda *args: pytest.fail('battle should use prepared index'))
    session = setup.store.new_session()
    cid = None
    token = active_usage.set((SimpleNamespace(reserve=lambda *args: None, settle=lambda *args: None), 'test'))
    try:
        for question in ['내 선봉은 마스카나이고 상대 선봉은 라우드본이야. 어떻게 해?', *['그럼 어떻게 할까?'] * 6]:
            result = setup.service.chat(ChatRequest(question=question, conversation_id=cid, client_request_id=uuid4()), session)
            cid = result['conversation_id']
            assert result['citations']
            assert result['battle_context']['state']['own_id'] == 'pokemon:908'
    finally:
        active_usage.reset(token)
    generations = [payload for schema, payload in sent if schema is BattleExplanation]
    assert len(generations) == 7
    assert generations[-1]['history_for_interpretation_only']
    assert all(isinstance(message['content'], str) for message in generations[-1]['history_for_interpretation_only'])
    assert isinstance(setup.store.history(cid)[-1]['content'], dict)


@pytest.mark.parametrize('top_k', [2, 6])
def test_current_matchup_fits_input_limit_without_losing_calculation(setup, monkeypatch, top_k):
    import json
    from types import SimpleNamespace

    from backend.app.core.usage import active_usage
    from backend.app.rag.model import StructuredModel, input_reservation
    from backend.app.rag.vector_store import VectorStore
    from backend.app.schemas import Document
    from backend.tests.conftest import embed

    catalog = Catalog(ROOT / 'data/pokemon.json')
    settings = replace(
        setup.settings, data_dir=ROOT / 'data', chunk_size=1000, chunk_overlap=200,
        top_k=top_k, api_key='synthetic', chat_model='test',
    )
    vectors = VectorStore(settings, setup.store, embed, 'synthetic-test-32')
    pair = ['pokemon:637', 'pokemon:914']
    vectors.upsert_metadata([catalog.get(pid) for pid in pair])
    for row in json.loads((ROOT / 'data/documents/species.json').read_text()):
        if row['pokemon_id'] in pair:
            vectors.index_document(row['pokemon_id'], Document.model_validate(row['document']))
    context = evaluate_state({'own_id': pair[0], 'opponent_id': pair[1]}, catalog, settings.data_dir)
    question = '나 지금 불카모스 냈는데 상대 웨이니발이야 나 어케 해?'
    sent, reservations = [], []

    class Client:
        def __init__(self, **kwargs):
            pass

        def with_structured_output(self, *args, **kwargs):
            return self

        def invoke(self, messages):
            payload = json.loads(messages[1].content)
            assert input_reservation(messages[0].content, payload, Generation.model_json_schema()) <= settings.model_max_input_tokens
            if top_k == 6:
                duplicated = {**payload, 'battle_context_from_user_inputs_and_type_tool': context}
                assert input_reservation(messages[0].content, duplicated, Generation.model_json_schema()) > input_reservation(messages[0].content, payload, Generation.model_json_schema())
            sent.append(payload)
            return {'parsed': Generation(answer_status='abstained', claims=[], assumptions=[], unknowns=[]), 'raw': None, 'parsing_error': None}

    monkeypatch.setattr('backend.app.rag.model.ChatOpenAI', Client)
    token = active_usage.set((SimpleNamespace(reserve=lambda lease, amount: reservations.append(amount), settle=lambda *args: None), 'test'))
    try:
        state = build_graph(vectors, StructuredModel(settings)).invoke({
            'pokemon_id': pair[0], 'context_pokemon_ids': pair, 'question': question,
            'battle_context': context, 'history': [],
        })
    finally:
        active_usage.reset(token)
    payload = sent[0]
    assert payload['question'] == question
    if top_k == 6:
        reference = payload['battle_context_from_user_inputs_and_type_tool']['evidence_id']
        calculation = next(e for e in payload['evidence'] if e['evidence_id'] == reference)
        assert json.loads(calculation['text']) == context
        assert state['result']['citations']
    else:
        # Both selected metadata entries occupy Top-k: retain the full context.
        assert payload['battle_context_from_user_inputs_and_type_tool'] == context
    assert state['battle_context'] == context
    assert reservations and max(reservations) <= settings.model_max_input_tokens + settings.model_max_output_tokens


def test_registered_strategy_collection_uses_only_answer_model_and_preserves_sources(setup, monkeypatch):
    import json

    from backend.app.data_preparation.sources import CombinedSource
    from backend.app.schemas import Candidate
    from backend.tests.conftest import document

    source = CombinedSource(setup.source.client, directory=setup.settings.data_dir, wikipedia_enabled=False)
    source.strategy.notes = [{
        'pokemon_id': 'pokemon:1', 'slug': 'synthetic-strategy', 'title': 'Synthetic strategy',
        'body': 'TEST ONLY: conditional strategy; no verified Champions claims.',
        'references': ['https://example.org/synthetic-reference'],
    }]
    subject = Candidate(
        candidate_id='pokeapi:pokemon-species:1', title='Test subject', summary='Synthetic subject',
        source_url='https://pokeapi.co/api/v2/pokemon-species/1/', resource='pokemon-species',
        resource_id='1', is_subject_document=True,
    )
    ability = Candidate(
        candidate_id='pokeapi:ability:1', title='Test ability', summary='Synthetic ability',
        source_url='https://pokeapi.co/api/v2/ability/1/', resource='ability', resource_id='1',
    )
    monkeypatch.setattr(source.primary, 'subject', lambda pokemon: subject)
    monkeypatch.setattr(source.primary, 'search', lambda query, pokemon: [ability] if query == 'test-ability' else [subject])
    monkeypatch.setattr(source.primary, 'fetch_document', lambda candidate: document(candidate.candidate_id))
    setup.service.source = source
    request = ChatRequest(pokemon_id='pokemon:1', question='운영 전략 추천', client_request_id=uuid4())
    result = setup.service.chat(request, setup.store.new_session())
    assert [purpose for purpose, payload in setup.model.calls] == ['generate']
    assert setup.vectors.docs.get(where={'pokemon_id': 'pokemon:1'})['ids']
    assert result['citations'] and result['citations'][0]['source_url']

    # Complete source text and applicability reach the model; citation metadata stays on the server.
    payload = setup.model.calls[0][1]
    assert any(item['source_type'] == 'curated' and item['verification_status'] == 'assumed' for item in payload['evidence'])
    original = build_graph(setup.vectors, setup.model).invoke({
        'pokemon_id': 'pokemon:1', 'question': request.question,
    })['evidence']
    by_id = {item['evidence_id']: item for item in original}
    for item in payload['evidence']:
        full = by_id[item['evidence_id']]
        assert item['text'] == full['text']
        assert item['verification_status'] == full['verification_status']
        assert item['collected_at'] == full['collected_at']
        assert 'source_url' not in item and 'licence_url' not in item
    before = len(json.dumps(original, ensure_ascii=False).encode())
    after = len(json.dumps(payload['evidence'], ensure_ascii=False, separators=(',', ':')).encode())
    assert after < before * 0.85


@pytest.mark.parametrize('question,wikipedia_enabled', [
    ('특성 효과를 설명해줘', False),
    ('챔피언스 최신 규칙과 운영 전략', False),
    ('용의춤을 쓰는 운영 전략 추천', False),
    ('피카츄와 리자몽 비교 추천', False),
    ('운영 전략 추천', True),
])
def test_ambiguous_or_optional_source_queries_keep_model_planning(setup, question, wikipedia_enabled):
    from backend.app.data_preparation.sources import CombinedSource

    source = CombinedSource(setup.source.client, directory=setup.settings.data_dir, wikipedia_enabled=wikipedia_enabled)
    pokemon = setup.catalog.get('pokemon:1')
    assert source.plan_queries(pokemon, question) is None
    assert source.select_candidates(pokemon, question, setup.source.search('test', pokemon)) is None


@pytest.mark.parametrize('question', [
    '테스트1 운영법을 알려줘',
    '테스트1 전략을 근거와 함께 설명해줘',
    'how to build test-species-1?',
])
def test_only_plain_species_strategy_requests_use_local_query_planning(setup, question):
    from backend.app.data_preparation.sources import CombinedSource

    source = CombinedSource(setup.source.client, directory=setup.settings.data_dir, wikipedia_enabled=False)
    plan = source.plan_queries(setup.catalog.get('pokemon:1'), question)
    assert plan is not None and [item.query for item in plan.queries] == ['test-ability']


@pytest.mark.parametrize('battle', [False, True])
def test_generation_uses_battle_instructions_only_with_calculated_context(setup, monkeypatch, battle):
    from backend.app.rag.prompts import BATTLE_EXPLANATION_PROMPT, GENERATION_PROMPT

    catalog = Catalog(ROOT / 'data/pokemon.json')
    pid = 'pokemon:25'
    setup.vectors.upsert_metadata([catalog.get(pid)])
    setup.vectors.index_document(pid, document('poketact:strategy:test', 'TEST ONLY: conditional strategy.'))
    context = evaluate_state({'own_id': pid, 'opponent_id': 'pokemon:9'}, catalog, ROOT / 'data') if battle else None
    prompts = []

    def invoke(purpose, prompt, payload, schema):
        prompts.append(prompt)
        return Generation(answer_status='abstained', claims=[], assumptions=[], unknowns=[])

    monkeypatch.setattr(setup.model, 'invoke', invoke)
    build_graph(setup.vectors, setup.model).invoke({
        'pokemon_id': pid, 'question': '설명해줘', 'battle_context': context,
    })
    assert prompts == [BATTLE_EXPLANATION_PROMPT if battle else GENERATION_PROMPT]
    assert 'damage_comparisons' not in GENERATION_PROMPT
    assert 'supplemental_evidence_ids' in BATTLE_EXPLANATION_PROMPT
    assert 'Champions applicability is unknown' in GENERATION_PROMPT


@pytest.mark.parametrize('question,expected', [
    ('다시 설명해줘!', True), ('요약해줘', True), ('왜 그런지 설명해줘?', True),
    ('상대가 바뀌면?', False), ('HP 40%야. 다시 설명해줘', False),
    ('그럼 어떻게 할까?', False), ('다시 설명해줘. 상대는 리자몽', False),
    ('새 전투야 요약해줘', False),
])
def test_reexplanation_recognizes_only_explicit_unchanged_requests(question, expected):
    from backend.app.battle.conversation import is_battle_reexplanation

    assert is_battle_reexplanation(question, {'own_id': 'pokemon:25'}) == expected
    assert not is_battle_reexplanation(question, {})


def test_reexplanation_reuses_state_but_changes_and_topic_switches_use_extraction(setup, monkeypatch):
    from backend.app.battle.conversation import InputEvidence

    setup.service.catalog = catalog = Catalog(ROOT / 'data/pokemon.json')
    setup.service.settings = replace(setup.settings, data_dir=ROOT / 'data')
    setup.vectors.upsert_metadata([catalog.get('pokemon:25'), catalog.get('pokemon:130')])
    monkeypatch.setattr(setup.service, 'collect', lambda *args: {'queries': []})
    calls = []

    def invoke(purpose, prompt, payload, schema):
        calls.append(purpose)
        assert purpose == 'battle_state', 'no supplemental evidence should mean no generation'
        if '40%' in payload['question']:
            return BattleUpdate(relevant=True, own_hp_percent=40,
                                input_evidence=[InputEvidence(field='own_hp_percent', quote='HP 40%')])
        return BattleUpdate(relevant=True, own_id='pokemon:25', opponent_id='pokemon:130')

    monkeypatch.setattr(setup.model, 'invoke', invoke)
    session = setup.store.new_session()
    first = setup.service.chat(ChatRequest(question='내 선봉 피카츄 상대 갸라도스', client_request_id=uuid4()), session)
    cid = first['conversation_id']

    def ask(question):
        return setup.service.chat(ChatRequest(question=question, conversation_id=cid, client_request_id=uuid4()), session)

    second = ask('다시 설명해줘')
    assert calls == ['battle_state']
    assert second['battle_context'] == first['battle_context']
    assert second['citations'] and second['user_message_id'] != first['user_message_id']
    third = ask('내 HP 40%야. 다시 설명해줘')
    assert len(calls) == 2 and third['battle_context']['state']['own_hp_percent'] == 40
    ask('그럼 상대가 바뀌면?')
    assert len(calls) == 3
    setup.store.save_exchange(cid, '다른 주제', {'answer': '일반 설명'})
    ask('요약해줘')
    assert len(calls) == 4  # A stale battle must not replace the most recent topic.


def test_battle_supplement_schema_and_citation_validation(setup, monkeypatch):
    from pydantic import ValidationError

    from backend.app.rag.prompts import BATTLE_EXPLANATION_PROMPT

    catalog = Catalog(ROOT / 'data/pokemon.json')
    pid = 'pokemon:25'
    setup.vectors.upsert_metadata([catalog.get(pid)])
    setup.vectors.index_document(pid, document('poketact:strategy:test', 'TEST ONLY: conditional strategy.'))
    context = evaluate_state({'own_id': pid, 'opponent_id': 'pokemon:130'}, catalog, ROOT / 'data')
    calls = []

    def invoke(purpose, prompt, payload, schema):
        assert schema is BattleExplanation and prompt == BATTLE_EXPLANATION_PROMPT
        calls.append(payload.copy())
        eid = payload['supplemental_evidence_ids'][0]
        # Valid supporting ID plus an invented ID must still fail validation.
        return BattleExplanation(claims=[{'text': '조건부 보충 설명',
                                         'evidence_ids': [eid, 'invented'] if len(calls) == 1 else [eid]}])

    monkeypatch.setattr(setup.model, 'invoke', invoke)
    result = build_graph(setup.vectors, setup.model).invoke({
        'pokemon_id': pid, 'question': '어떻게 해?', 'battle_context': context,
    })['result']
    assert len(calls) == 2
    assert set(calls[1]['previous_invalid_output']) == {'claims'}
    assert '조건부 보충 설명' in result['answer'] and result['citations']
    assert result['answer'].index('공격하는 쪽을 추천') < result['answer'].index('조건부 보충 설명')
    assert '다만,' not in result['answer']
    with pytest.raises(ValidationError):
        BattleExplanation(claims=[{'text': 'test', 'evidence_ids': ['test']}] * 3)


def test_guide_cache_reuses_validated_answer_across_sessions_without_private_history(setup):
    session = setup.store.new_session()
    cid = setup.store.conversation(session, 'pokemon:1', None)
    setup.store.save_exchange(cid, 'PRIVATE QUESTION', {'answer': 'PRIVATE ANSWER'})
    request = ChatRequest(pokemon_id='pokemon:1', question='운용 가이드', conversation_id=cid, client_request_id=uuid4())
    first = setup.service.chat(request, session, feature='pokemon_guide')
    second = setup.service.chat(request.model_copy(update={'conversation_id': None, 'client_request_id': uuid4()}),
                                setup.store.new_session(), feature='pokemon_guide')
    generated = [payload for purpose, payload in setup.model.calls if purpose == 'generate']
    assert len(generated) == 1 and generated[0]['history_for_interpretation_only'] == []
    assert first['answer'] == second['answer'] and first['citations'] == second['citations']
    assert first['conversation_id'] != second['conversation_id']
    assert first['assistant_message_id'] != second['assistant_message_id']
    assert 'PRIVATE' not in second['answer']


@pytest.mark.parametrize('change', ['question', 'regulation', 'evidence', 'prompt', 'model', 'endpoint', 'output_limit'])
def test_guide_cache_invalidates_when_generation_inputs_change(setup, monkeypatch, change):
    import backend.app.rag.graph as graph_module

    state = {'pokemon_id': 'pokemon:1', 'question': '가이드', 'cache_guide': True}
    graph = build_graph(setup.vectors, setup.model)
    graph.invoke(state)
    graph.invoke(state)
    assert len(setup.model.calls) == 1
    if change in {'question', 'regulation'}:
        state['question' if change == 'question' else 'regulation_id'] = 'changed'
    elif change == 'evidence':
        setup.vectors.index_document('pokemon:1', document('new-source', 'TEST ONLY: new reference.'))
    elif change == 'prompt':
        monkeypatch.setattr(graph_module, 'GENERATION_PROMPT', graph_module.GENERATION_PROMPT + '\nChanged')
    else:
        field = {'model': 'chat_model', 'endpoint': 'base_url', 'output_limit': 'model_max_output_tokens'}[change]
        setup.vectors.settings = replace(setup.settings, **{field: 1000 if change == 'output_limit' else 'changed'})
    graph.invoke(state)
    assert len(setup.model.calls) == 2


@pytest.mark.parametrize('mode', ['ordinary_chat', 'private_history', 'abstained', 'invalid_cache'])
def test_guide_cache_never_reuses_unvalidated_or_personalized_results(setup, monkeypatch, mode):
    state = {'pokemon_id': 'pokemon:1', 'question': '가이드', 'cache_guide': mode != 'ordinary_chat'}
    if mode == 'private_history':
        state['history'] = [{'role': 'user', 'content': 'private context'}]
    if mode == 'abstained':
        setup.model.abstain = True
    graph = build_graph(setup.vectors, setup.model)
    graph.invoke(state)
    if mode == 'invalid_cache':
        original = setup.store.get
        monkeypatch.setattr(setup.store, 'get', lambda namespace, key:
                            {'answer_status': 'answered', 'claims': [{'text': 'bad', 'evidence_ids': ['invented']}],
                             'assumptions': [], 'unknowns': []}
                            if namespace == 'guide_answer' else original(namespace, key))
    result = graph.invoke(state)['result']
    assert len(setup.model.calls) == 2
    assert 'bad' not in result['answer']
