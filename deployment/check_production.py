"""Read-only public smoke check without sessions, questions or model charges."""

import json
import os
import re
import urllib.request
from urllib.parse import urljoin, urlsplit


def check(base):
    if urlsplit(base).scheme != "https":
        raise ValueError("HTTPS production URL required")
    detail_path = "/ko/pokedex/%ED%94%BC%EC%B9%B4%EC%B8%84-25"
    pages = {"/ko": "배틀 준비는 PokeSettle에서", "/ko/chat": "전략 챗봇", detail_path: "종족값"}
    assets = set()
    for path, marker in pages.items():
        with urllib.request.urlopen(urljoin(base, path), timeout=15) as response:
            html = response.read().decode()
            if (response.status != 200 or urlsplit(response.url).path != path
                    or urlsplit(response.url)[:2] != urlsplit(base)[:2] or marker not in html):
                raise ValueError("Server-rendered content not found")
        if path == detail_path:
            visible_html = re.sub(r"<script\b[^>]*>.*?</script>", "", html, flags=re.S | re.I)
            canonical = urljoin(base, detail_path)
            if ("피카츄" not in visible_html or "종족값" not in visible_html
                    or 'data-testid="profile-details"' not in visible_html
                    or f'rel="canonical" href="{canonical}"' not in html):
                raise ValueError("Public Pokédex detail is not server-rendered at its canonical URL")
        page_assets = re.findall(r'(?:src|href)="(/_next/static/[^"\s]+)"', html)
        if not page_assets:
            raise ValueError("Frontend assets not found")
        assets.update(page_assets)
    for asset in assets:
        with urllib.request.urlopen(urljoin(base, asset), timeout=15) as response:
            if response.status != 200:
                raise ValueError("Frontend asset unavailable")
    with urllib.request.urlopen(urljoin(base, "/api/status"), timeout=15) as response:
        if not json.load(response)["data"]["ready"]:
            raise ValueError("API not ready")
    print("Frontend assets and API ready")


if __name__ == "__main__":
    try:
        check(os.environ["PRODUCTION_URL"])
    except Exception:
        raise SystemExit("Production smoke check failed; inspect privately") from None
