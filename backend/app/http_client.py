import json
import threading
import time
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import urlparse

import requests

from backend.app.core.errors import ServiceError
from backend.app.storage import digest, now


class SourceClient:
    """Bounded, serial, cached public-source reads. No user-supplied URLs."""

    def __init__(self, settings, store):
        self.settings = settings
        self.store = store
        self.lock = threading.Lock()
        self.last_call = 0.0
        self.network_calls = 0
        self.cache_hits = 0
        self.session = requests.Session()
        contact = f" ({settings.source_contact})" if settings.source_contact else ""
        self.session.headers["User-Agent"] = f"PokeCoachAI/0.1 educational local research{contact}"

    def fetch(self, url, *, expect_json=True):
        parsed = urlparse(url)
        if parsed.scheme != "https" or parsed.hostname not in {
            "pokeapi.co",
            "raw.githubusercontent.com",
        }:
            raise ServiceError(
                "SOURCE_NOT_ALLOWED", "등록된 데이터 출처만 사용할 수 있습니다.", 422
            )
        key = digest(url)
        with self.lock:
            cached = self.store.get("http", key)
            if cached:
                self.cache_hits += 1
                return cached
            for attempt in range(self.settings.max_retries + 1):
                delay = self.settings.request_interval - (time.monotonic() - self.last_call)
                if delay > 0:
                    time.sleep(delay)
                self.last_call = time.monotonic()
                self.network_calls += 1
                try:
                    response = self.session.get(
                        url, timeout=self.settings.http_timeout, allow_redirects=False
                    )
                except requests.RequestException:
                    if attempt < self.settings.max_retries:
                        time.sleep(2**attempt)
                        continue
                    raise ServiceError(
                        "SOURCE_UNAVAILABLE", "외부 자료에 연결할 수 없습니다.", retryable=True
                    ) from None
                if response.status_code == 404:
                    return None
                if (
                    response.status_code in {429, 500, 502, 503, 504}
                    and attempt < self.settings.max_retries
                ):
                    header = response.headers.get("Retry-After", "")
                    try:
                        retry_after = float(header) if header else 0
                    except ValueError:
                        try:
                            retry_after = max(
                                0,
                                (
                                    parsedate_to_datetime(header) - datetime.now(timezone.utc)
                                ).total_seconds(),
                            )
                        except (ValueError, TypeError):
                            retry_after = 0
                    # Long provider cooldowns are reported, never retried early.
                    if retry_after > 60:
                        raise ServiceError(
                            "SOURCE_RATE_LIMITED",
                            "출처의 대기 시간이 길어졌습니다. 나중에 재시도하세요.",
                            retryable=True,
                        )
                    time.sleep(max(2**attempt, retry_after))
                    continue
                if not response.ok or response.is_redirect:
                    raise ServiceError(
                        "SOURCE_UNAVAILABLE",
                        "외부 출처가 요청을 허용하지 않았습니다.",
                        retryable=response.status_code >= 500,
                    )
                try:
                    body = response.json() if expect_json else response.text
                except (ValueError, json.JSONDecodeError):
                    raise ServiceError(
                        "SOURCE_INVALID", "외부 자료 형식을 확인할 수 없습니다."
                    ) from None
                result = {
                    "url": url,
                    "collected_at": now(),
                    "body": body,
                    "content_hash": digest(body),
                }
                self.store.put("http", key, result)
                return result
