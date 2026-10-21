from datetime import datetime, timedelta, timezone
from email.utils import format_datetime
from types import SimpleNamespace

import pytest
import requests

from backend.app.core.errors import ServiceError
from backend.app.data_preparation.pokeapi import PokeApiSource
from backend.app.http_client import SourceClient


def response(code=200, data=None, headers=None):
    return SimpleNamespace(
        status_code=code,
        ok=200 <= code < 300,
        is_redirect=False,
        headers=headers or {},
        json=lambda: data or {"id": 1, "name": "test"},
        text="test content",
    )


def test_http_success_cache_404_and_forbidden_are_separate(setup, monkeypatch):
    client = SourceClient(setup.settings, setup.store)
    calls = []

    def get(url, **kwargs):
        calls.append(url)
        return response(404 if "missing" in url else 403 if "forbidden" in url else 200)

    monkeypatch.setattr(client.session, "get", get)
    url = "https://pokeapi.co/api/v2/pokemon-species/1/"
    assert client.fetch(url)["body"]["name"] == "test"
    assert client.fetch(url)["body"]["name"] == "test"
    assert len(calls) == 1 and client.cache_hits == 1
    assert client.fetch(url + "missing") is None
    with pytest.raises(ServiceError):
        client.fetch(url + "forbidden")
    with pytest.raises(ServiceError):
        client.fetch("http://127.0.0.1/secret")
    assert len(calls) == 3


def test_retry_after_and_timeout_retries(setup, monkeypatch):
    client = SourceClient(setup.settings, setup.store)
    sleeps = []
    monkeypatch.setattr("backend.app.http_client.time.sleep", sleeps.append)
    responses = iter([response(429, headers={"Retry-After": "3"}), response()])
    monkeypatch.setattr(client.session, "get", lambda *args, **kwargs: next(responses))
    client.fetch("https://pokeapi.co/api/v2/ability/1/")
    assert sleeps == [3]
    assert client.network_calls == 2

    def timeout(*args, **kwargs):
        raise requests.Timeout("SECRET not for users")

    monkeypatch.setattr(client.session, "get", timeout)
    with pytest.raises(ServiceError) as error:
        client.fetch("https://pokeapi.co/api/v2/ability/2/")
    assert error.value.retryable
    assert "SECRET" not in str(error.value)
    assert client.network_calls == 5


def test_long_http_date_cooldown_not_retried_early(setup, monkeypatch):
    client = SourceClient(setup.settings, setup.store)
    cooldown = format_datetime(datetime.now(timezone.utc) + timedelta(hours=1), usegmt=True)
    monkeypatch.setattr(
        client.session,
        "get",
        lambda *args, **kwargs: response(429, headers={"Retry-After": cooldown}),
    )
    with pytest.raises(ServiceError) as error:
        client.fetch("https://pokeapi.co/api/v2/type/1/")
    assert error.value.code == "SOURCE_RATE_LIMITED"
    assert client.network_calls == 1


def test_pokeapi_subject_body_preserves_source_version_scope(setup):
    payload = {
        "id": 1,
        "name": "test-species",
        "names": [{"language": {"name": "ko"}, "name": "테스트"}],
        "flavor_text_entries": [
            {
                "language": {"name": "en"},
                "version": {"name": "test-version"},
                "flavor_text": "TEST DESCRIPTION\nwith whitespace",
            }
        ],
    }

    calls = []

    class Client:
        def fetch(self, url):
            calls.append(url)
            body = (
                {
                    "results": [
                        {
                            "name": "test-species",
                            "url": "https://pokeapi.co/api/v2/pokemon-species/1/",
                        }
                    ]
                }
                if "?limit=" in url
                else payload
            )
            return {"url": url, "body": body, "collected_at": "2026-10-21T00:00:00+00:00"}

    source = PokeApiSource(Client())
    candidate = source.subject(setup.catalog.get("pokemon:1"))
    assert all("?limit=" in url for url in calls)  # No body fetch before filtering.
    document = source.fetch_document(candidate)
    assert candidate.is_subject_document
    assert "test-version" in document.body
    assert "Champions applicability is unknown" in document.body
    assert document.game == document.battle_format == "generic"
    assert document.regulation_id == "unknown"
    assert document.licence_url


def test_restart_reuses_success_cache_and_recovers_jobs(setup):
    from backend.app.storage import Store

    session_id = setup.store.new_session()
    setup.store.put("http", "test", {"body": "cached"})
    job_id, _ = setup.store.create_job(session_id, "chat", "id", {})
    restarted = Store(setup.store.path)
    restarted.recover_jobs()
    assert restarted.get("http", "test")["body"] == "cached"
    assert restarted.job(job_id, session_id)["status"] == "interrupted"
