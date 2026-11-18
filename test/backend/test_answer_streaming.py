import json
from dataclasses import replace
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from backend.app.core.config import Settings
from backend.app.core.errors import ServiceError
from backend.app.core.usage import active_usage
from backend.app.main import create_app
from backend.app.rag.model import StructuredModel
from backend.app.rag.streaming import AnswerPreviewHandler, active_answer_preview
from backend.app.schemas import ChatRequest, Generation
from backend.app.services.jobs import run_job


def test_partial_json_exposes_only_claim_text_and_unicode(monkeypatch):
    ticks = iter(range(1, 101))
    monkeypatch.setattr('backend.app.rag.streaming.time.monotonic', lambda: next(ticks))
    updates = []
    handler = AnswerPreviewHandler(updates.append)
    handler.on_llm_new_token('{"answer_status":"partial","claims":[{"text":"피카')
    assert updates == ['피카']
    handler.on_llm_new_token('츄는 전기 타입입니다.","evidence_ids":["E1"]}],"unknowns":["INTERNAL"]}')
    assert updates[-1] == '피카츄는 전기 타입입니다.'
    assert all('E1' not in text and 'INTERNAL' not in text for text in updates)


def test_model_streams_callbacks_and_settles_actual_usage(monkeypatch):
    updates, settlements, clients = [], [], []
    answer = Generation(answer_status='partial', claims=[{'text': '전기 타입입니다.', 'evidence_ids': ['E1']}], assumptions=[], unknowns=[])

    class Client:
        def __init__(self, **kwargs):
            clients.append(kwargs)
        def with_structured_output(self, *args, **kwargs):
            return self
        def invoke(self, messages, config):
            handler = config['callbacks'][0]
            handler.on_llm_new_token('{"claims":[{"text":"전기 타입')
            assert updates[-1] == '전기 타입'
            return {'parsed': answer, 'parsing_error': None, 'raw': SimpleNamespace(usage_metadata={'input_tokens': 20, 'output_tokens': 10, 'total_tokens': 30})}

    monkeypatch.setattr('backend.app.rag.model.ChatOpenAI', Client)
    token = active_usage.set((SimpleNamespace(reserve_model=lambda *a: ('ticket', 'gpt-5.6-luna'), settle=lambda *a: settlements.append(a)), 'lease'))
    preview = active_answer_preview.set(updates.append)
    try:
        assert StructuredModel(Settings(api_key='synthetic')).invoke('generate', 'test', {}, Generation) == answer
    finally:
        active_answer_preview.reset(preview)
        active_usage.reset(token)
    assert clients[0]['streaming'] is True
    assert clients[0]['stream_usage'] is True
    assert updates[0] == ''
    assert settlements[0][1]['total_tokens'] == 30


@pytest.mark.parametrize('fail', [False, True])
def test_job_preview_resets_and_terminal_state_clears_draft(setup, fail):
    store = setup.store
    session = store.new_session()
    body = ChatRequest(question='test', client_request_id=uuid4())
    job_id, _ = store.create_job(session, 'chat', str(body.client_request_id), body.model_dump(mode='json'))

    def chat(*args, **kwargs):
        publish = active_answer_preview.get()
        publish('first attempt')
        assert store.job(job_id, session)['preview_answer'] == 'first attempt'
        publish('')
        assert store.job(job_id, session)['preview_answer'] == ''
        if fail:
            raise ServiceError('GENERATION_INVALID', 'test')
        return {'answer': 'final'}

    run_job(SimpleNamespace(store=store, chat=chat), job_id, 'chat', body, session)
    result = store.job(job_id, session)
    assert result['status'] == ('failed' if fail else 'completed')
    assert result['preview_answer'] == ''
    assert active_answer_preview.get() is None


def test_event_stream_is_owned_private_and_finishes_with_job(setup, monkeypatch):
    with TestClient(create_app(replace(setup.settings, job_worker_embedded=False), service=setup.service)) as client:
        client.post('/api/session')
        session = client.cookies.get('pokecoach_session')
        job_id, _ = setup.store.create_job(session, 'chat', str(uuid4()), {'question': 'test'})
        setup.store.update_job(job_id, status='completed', result={'answer': 'final'})
        response = client.get(f'/api/jobs/{job_id}/events')
        assert response.status_code == 200
        assert response.headers['content-type'].startswith('text/event-stream')
        assert response.headers['cache-control'] == 'no-store, no-transform'
        assert 'event: job' in response.text
        snapshot = json.loads(response.text.split('data: ', 1)[1].strip())
        assert snapshot['jobId'] == job_id and snapshot['status'] == 'completed'
        assert snapshot['previewAnswer'] == ''
        client.cookies.clear()
        assert client.get(f'/api/jobs/{job_id}/events').status_code == 401
        client.post('/api/session')
        assert client.get(f'/api/jobs/{job_id}/events').status_code == 404


def test_installed_sdk_stream_retains_usage_and_emits_before_result(monkeypatch):
    import httpx
    from langchain_openai import ChatOpenAI

    answer = Generation(answer_status='partial', claims=[{'text': '전기 타입입니다.', 'evidence_ids': ['E1']}], assumptions=[], unknowns=[])
    updates, settlements, requests = [], [], []

    def respond(request):
        requests.append(json.loads(request.content))
        data = answer.model_dump_json()
        packets = []
        for fragment in [data[:data.index('전기') + 2], data[data.index('전기') + 2:]]:
            packets.append({'id': 'test', 'object': 'chat.completion.chunk', 'created': 1, 'model': 'gpt-4.1-mini', 'choices': [{'index': 0, 'delta': {**({'role': 'assistant'} if not packets else {}), 'content': fragment}, 'finish_reason': None}]})
        packets.append({'id': 'test', 'object': 'chat.completion.chunk', 'created': 1, 'model': 'gpt-4.1-mini', 'choices': [{'index': 0, 'delta': {}, 'finish_reason': 'stop'}]})
        packets.append({'id': 'test', 'object': 'chat.completion.chunk', 'created': 1, 'model': 'gpt-4.1-mini', 'choices': [], 'usage': {'prompt_tokens': 12, 'completion_tokens': 8, 'total_tokens': 20}})
        content = ''.join('data: ' + json.dumps(packet, ensure_ascii=False) + '\n\n' for packet in packets) + 'data: [DONE]\n\n'
        return httpx.Response(200, headers={'content-type': 'text/event-stream'}, content=content.encode())

    with httpx.Client(transport=httpx.MockTransport(respond)) as client:
        monkeypatch.setattr('backend.app.rag.model.ChatOpenAI', lambda **kw: ChatOpenAI(**kw, http_client=client))
        usage = active_usage.set((SimpleNamespace(reserve=lambda *a: 'ticket', settle=lambda *a: settlements.append(a)), 'lease'))
        preview = active_answer_preview.set(updates.append)
        try:
            result = StructuredModel(Settings(api_key='synthetic', chat_model='gpt-4.1-mini', base_url='https://provider.test/v1')).invoke('generate', 'test', {}, Generation)
        finally:
            active_answer_preview.reset(preview)
            active_usage.reset(usage)
    assert result == answer
    assert any('전기' in text for text in updates)
    assert requests[0]['stream'] is True
    assert requests[0]['stream_options']['include_usage'] is True
    assert settlements[0][1]['total_tokens'] == 20
