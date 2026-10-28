"""Project-authored conditional analysis; not imported competitive analyses."""

import json
from pathlib import Path

from backend.app.core.errors import ServiceError
from backend.app.schemas import Candidate, Document
from backend.app.storage import digest


class StrategySource:
    def __init__(self, directory: Path):
        path = directory / "strategy/notes.json"
        self.notes = json.loads(path.read_text()) if path.exists() else []

    def search(self, query, pokemon):
        return [
            Candidate(
                candidate_id=f"poketact:strategy:{note['slug']}",
                title=note["title"],
                summary="PokeSettle이 직접 작성한 조건부 전략 분석. 일반 규칙 기반 가설이며 Champions 검증·실전 성과를 주장하지 않음. "
                + note["body"][:240],
                source_url="https://github.com/unfl1/poketact/blob/develop/data/strategy/notes.json",
                resource="strategy-note",
                resource_id=note["slug"],
            )
            for note in self.notes
            if note["pokemon_id"] == pokemon.pokemon_id
        ]

    def fetch_document(self, candidate):
        note = next(
            (
                n
                for n in self.notes
                if candidate.candidate_id == f"poketact:strategy:{n['slug']}"
                and candidate.resource_id == n["slug"]
                and candidate.resource == "strategy-note"
            ),
            None,
        )
        if note is None:
            raise ServiceError("SOURCE_NOT_ALLOWED", "등록된 전략 자료만 사용할 수 있습니다.", 422)
        return Document(
            document_id=candidate.candidate_id,
            title=note["title"],
            source_url="https://github.com/unfl1/poketact/blob/develop/data/strategy/notes.json",
            source_type="curated",
            body="\n".join(
                [
                    "작성: PokeSettle. 일반 메커니즘을 연결한 조건부 분석, 외부 전략 원문 전재 없음.",
                    "Game: generic; format: singles; Champions applicability: unknown; analysis: assumed.",
                    note["body"],
                    "기초 메커니즘 참고 출처:",
                    *note["references"],
                ]
            ),
            collected_at="2026-10-22T00:00:00+00:00",
            revision_id=digest(["pokesettle-strategy-render-v1", note]),
            licence="PokeSettle original conditional analysis · CC BY 4.0; underlying Pokémon rights reserved",
            licence_url="https://creativecommons.org/licenses/by/4.0/",
            battle_format="singles",
            verification_status="assumed",
        )
