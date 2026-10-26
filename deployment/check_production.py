"""Read-only public smoke check without sessions, questions or model charges."""

import json
import os
import re
import urllib.request
from urllib.parse import urljoin, urlsplit


def check(base):
    if urlsplit(base).scheme != "https":
        raise ValueError("HTTPS production URL required")
    pages = {"/": "배틀 준비는 PokeTact에서.", "/chat": "전략 챗봇"}
    assets = set()
    for path, marker in pages.items():
        with urllib.request.urlopen(urljoin(base, path), timeout=15) as response:
            html = response.read().decode()
            if response.status != 200 or urlsplit(response.url).path != path or marker not in html:
                raise ValueError("Server-rendered content not found")
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
