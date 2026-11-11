import asyncio
import json
from concurrent.futures import ThreadPoolExecutor
from threading import Lock
from types import SimpleNamespace

from backend.app.core.config import Settings
from backend.app.core.usage import active_usage
from backend.app.rag.model import StructuredModel
from backend.app.schemas import Generation


def test_parallel_calls_share_transport_without_sharing_answers_or_quota(monkeypatch):
    clients, reservations, settlements, closed = [], [], [], []
    lock = Lock()

    class Client:
        def __init__(self, **kwargs):
            clients.append(kwargs)
            self.root_client = SimpleNamespace(close=lambda: closed.append('sync'))

            async def close_async():
                closed.append('async')

            self.root_async_client = SimpleNamespace(close=close_async)

        def with_structured_output(self, *args, **kwargs):
            return self

        def invoke(self, messages):
            value = json.loads(messages[1].content)['number']
            return {'parsed': Generation(answer_status='abstained', claims=[], assumptions=[], unknowns=[str(value)]),
                    'parsing_error': None, 'raw': SimpleNamespace(usage_metadata={
                        'input_tokens': 10, 'output_tokens': 5, 'total_tokens': 15})}

    def reserve(lease, tokens):
        with lock:
            reservations.append(lease)
        return lease, 'gpt-5.6-luna'

    def settle(ticket, usage):
        with lock:
            settlements.append(ticket)

    monkeypatch.setattr('backend.app.rag.model.ChatOpenAI', Client)
    guard = SimpleNamespace(reserve_model=reserve, settle=settle)
    model = StructuredModel(Settings(api_key='synthetic'))

    def invoke(number):
        token = active_usage.set((guard, str(number)))
        try:
            return model.invoke('generate', 'test', {'number': number}, Generation).unknowns[0]
        finally:
            active_usage.reset(token)

    with ThreadPoolExecutor(max_workers=20) as pool:
        answers = list(pool.map(invoke, range(100)))
    assert answers == list(map(str, range(100)))
    assert len(clients) == 1
    assert sorted(reservations) == sorted(settlements) == sorted(map(str, range(100)))
    asyncio.run(model.aclose())
    asyncio.run(model.aclose())
    assert closed == ['sync', 'async']
