from urllib.parse import quote

from backend.app.core.errors import ServiceError
from backend.app.schemas import Candidate, Document
from backend.app.storage import digest

API = "https://en.wikipedia.org/api/rest_v1/page/summary/"
LICENCE_URL = "https://creativecommons.org/licenses/by-sa/4.0/"
# Article identity checked against the summary API on 2026-10-22.
# Species-level references apply to shared background, never form-specific stats.
ARTICLES = {6: ("Charizard", "Q844940"), 25: ("Pikachu", "Q9351")}


class WikipediaSource:
    """Explicitly mapped English article summaries; no arbitrary URL/search input."""

    def __init__(self, client):
        self.client = client

    def search(self, query, pokemon):
        article = ARTICLES.get(pokemon.species_id)
        if not article:
            return []
        title, _ = article
        return [
            Candidate(
                candidate_id=f"wikipedia:en:{title}",
                title=f"{title} — English Wikipedia",
                summary="Species background and media-franchise overview. Wikipedia contributors, CC BY-SA 4.0. Not a Champions rules or strategy reference. Article body not collected yet.",
                source_url=f"https://en.wikipedia.org/wiki/{quote(title, safe='')}",
                resource="wikipedia-summary",
                resource_id=title,
            )
        ]

    def fetch_document(self, candidate):
        article = next((a for a in ARTICLES.values() if a[0] == candidate.resource_id), None)
        if (
            not article
            or candidate.resource != "wikipedia-summary"
            or candidate.candidate_id != f"wikipedia:en:{article[0]}"
        ):
            raise ServiceError(
                "SOURCE_NOT_ALLOWED", "등록된 Wikipedia 항목만 수집할 수 있습니다.", 422
            )
        title, wikidata_id = article
        result = self.client.fetch(API + quote(title, safe=""))
        if not result:
            return None
        data = result["body"]
        if (
            not isinstance(data, dict)
            or data.get("type") != "standard"
            or data.get("title") != title
            or data.get("wikibase_item") != wikidata_id
            or data.get("lang") != "en"
            or not isinstance(data.get("extract"), str)
            or not data["extract"].strip()
            or not str(data.get("revision", "")).isdigit()
        ):
            raise ServiceError(
                "SOURCE_INVALID", "Wikipedia 문서의 항목·본문·버전을 확인할 수 없습니다."
            )
        revision = str(data["revision"])
        page = (
            f"https://en.wikipedia.org/w/index.php?title={quote(title, safe='')}&oldid={revision}"
        )
        return Document(
            document_id=candidate.candidate_id,
            title=candidate.title,
            source_url=page,
            source_type="wiki",
            body="\n".join(
                [
                    f"Wikipedia article: {title}",
                    "Scope: species background only; Champions applicability is unknown. Not form-specific stats or battle rules.",
                    f"Attribution: Wikipedia contributors, {page}",
                    f"Licence: CC BY-SA 4.0 ({LICENCE_URL}); original plain-text extract unchanged; scope and attribution headers added.",
                    f"Article revision: {revision}",
                    data["extract"],
                ]
            ),
            collected_at=result["collected_at"],
            revision_id=f"{revision}:{digest(data['extract'])}",
            licence="Wikipedia contributors · CC BY-SA 4.0 · original extract unchanged",
            licence_url=LICENCE_URL,
        )
