import json
from types import SimpleNamespace

import pytest

from backend.scripts.load_chat import production_result, run_production


@pytest.mark.parametrize('flag', ['shared_ip', 'mock_model', 'serve', 'worker'])
def test_production_rejects_simulation_before_network(flag, monkeypatch):
    args = SimpleNamespace(shared_ip=False, mock_model=False, serve=False, worker=False)
    setattr(args, flag, True)
    monkeypatch.setattr('backend.scripts.load_chat.httpx.Client', lambda **_: pytest.fail('Network reached'))
    with pytest.raises(SystemExit, match='cannot simulate'):
        run_production(args)


def test_missing_users_do_not_pass_even_when_observed_users_succeed(tmp_path):
    values = {
        'chat_started': {'count': 100}, 'chat_finished': {'count': 99},
        'chat_accepted': {'passes': 99, 'fails': 0, 'rate': 1},
        'chat_completed': {'passes': 99, 'fails': 0, 'rate': 1},
    }
    (tmp_path / 'k6-summary.json').write_text(json.dumps({
        'metrics': {name: {'values': value} for name, value in values.items()},
    }))
    assert not production_result(tmp_path, 100)['all_users_completed']


def test_rejections_and_partial_answers_remain_visible(tmp_path):
    points = [
        {'metric': 'chat_rejected', 'data': {'value': 1, 'tags': {'code': 'USAGE_LIMIT'}}},
        {'metric': 'chat_answer_status', 'data': {'value': 1, 'tags': {'status': 'partial'}}},
        {'metric': 'http_reqs', 'data': {'value': 1, 'tags': {'status': '429'}}},
    ]
    (tmp_path / 'k6-samples.jsonl').write_text('\n'.join(
        json.dumps({'type': 'Point', **point}) for point in points
    ))
    result = production_result(tmp_path, 100)
    assert not result['all_users_completed']
    assert result['failure_reasons'] == {'USAGE_LIMIT': 1}
    assert result['answer_statuses'] == {'partial': 1}
    assert result['http_statuses'] == {'429': 1}
