import re

from backend.models import Candidate, Document
from backend.storage import digest

API = "https://pokeapi.co/api/v2"
LICENCE_URL = "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/LICENSE.md"


class PokeApiSource:
    """Exact resource lookup search against PokéAPI; no web-wide strategy search."""

    name = "pokeapi-resource-index-v1"

    def __init__(self, client):
        self.client = client

    def candidate(self, resource, identifier, subject=False):
        # Resource indexes expose names/URLs only: fetch full bodies AFTER selection.
        result = self.client.fetch(f"{API}/{resource}/?limit=2000")
        if not result:
            return None
        entries = result["body"]["results"]
        data = next(
            (
                entry
                for entry in entries
                if entry["name"] == str(identifier).lower()
                or entry["url"].rstrip("/").split("/")[-1] == str(identifier)
            ),
            None,
        )
        if data is None:
            return None
        resource_id = data["url"].rstrip("/").split("/")[-1]
        return Candidate(
            candidate_id=f"pokeapi:{resource}:{resource_id}",
            title=f"{data['name']} — PokéAPI {resource}",
            summary=f"PokéAPI resource index: {resource}, name={data['name']}. Full document not collected yet. Generic game reference; Champions applicability unknown.",
            source_url=data["url"],
            resource=resource,
            resource_id=resource_id,
            is_subject_document=subject,
        )

    def subject(self, pokemon):
        return self.candidate("pokemon-species", pokemon.species_id, True)

    def search(self, query, pokemon):
        # Domain resource-name search. The LLM must output exact English slugs.
        terms = re.findall(r"[a-z]+(?:-[a-z]+)*", query.lower())[:6]
        results = []
        if pokemon.name_en.lower() in query.lower() or (
            pokemon.name_ko and pokemon.name_ko in query
        ):
            own = self.subject(pokemon)
            if own:
                results.append(own)
        allowed_abilities = set(pokemon.abilities)
        # Queries are exact English resource names, not unrestricted user URLs.
        if (
            re.fullmatch(r"[a-z]+(?:-[a-z]+)*", query.lower())
            and query.lower() not in allowed_abilities
            and query.lower() not in pokemon.types
            and query.lower() != pokemon.name_en.lower()
        ):
            candidate = self.candidate("pokemon-species", query.lower())
            if candidate:
                results.append(candidate)
        for term in terms:
            if term in allowed_abilities:
                candidate = self.candidate("ability", term)
            elif term in pokemon.types:
                candidate = self.candidate("type", term)
            else:
                continue
            if candidate:
                results.append(candidate)
        return results

    @staticmethod
    def render(resource, data):
        lines = [
            f"PokéAPI resource: {resource}",
            f"Name: {data['name']}",
            f"ID: {data['id']}",
            "Scope: generic Pokémon; game-specific entries below retain their original version. Champions applicability is unknown.",
        ]
        if resource == "pokemon-species":
            for entry in data.get("names", []):
                if entry["language"]["name"] in {"ko", "en"}:
                    lines.append(f"Name ({entry['language']['name']}): {entry['name']}")
            for field in ("generation", "habitat", "color", "shape"):
                value = data.get(field)
                if value:
                    lines.append(f"{field}: {value['name']}")
            seen = set()
            for entry in data.get("flavor_text_entries", []):
                if entry["language"]["name"] not in {"en", "ko"}:
                    continue
                text = " ".join(entry["flavor_text"].split())
                if text not in seen:
                    lines.append(
                        f"Description ({entry['language']['name']}, {entry['version']['name']}): {text}"
                    )
                    seen.add(text)
        elif resource == "ability":
            for entry in data.get("effect_entries", []):
                if entry["language"]["name"] in {"en", "ko"}:
                    lines.append(f"Effect ({entry['language']['name']}): {entry['effect']}")
        elif resource == "type":
            # No type effectiveness transplanted into Champions calculations.
            lines.append(
                f"Original game generation: {data.get('generation', {}).get('name', 'unknown')}"
            )
        return "\n".join(lines)

    def fetch_document(self, candidate):
        result = self.client.fetch(candidate.source_url)
        if not result:
            return None
        return Document(
            document_id=candidate.candidate_id,
            title=candidate.title,
            source_url=result["url"],
            body=self.render(candidate.resource, result["body"]),
            collected_at=result["collected_at"],
            revision_id=digest(result["body"]),
            licence="PokéAPI project terms; Pokémon names and original text rights reserved to their owners",
            licence_url=LICENCE_URL,
        )
