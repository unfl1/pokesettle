"""Resolve catalog names with conservative spelling repair; never infer sides or forms."""

import re
from functools import lru_cache

from backend.app.pokemon_names import normalize_pokemon_names


@lru_cache(maxsize=4)
def _matcher(records):
    by_name = {}
    for identifier, korean, english, form in records:
        for name in {korean, english} - {None, ""}:
            by_name.setdefault(name.casefold(), []).append((identifier, form))
    patterns = []
    for name in sorted(by_name, key=len, reverse=True):
        pattern = re.escape(name)
        if name.isascii():
            pattern = r"(?<![a-z0-9-])" + pattern + r"(?![a-z0-9-])"
        patterns.append(pattern)
    return re.compile("(?=(" + "|".join(patterns) + "))"), by_name


def mentioned_pokemon(catalog, question, limit=2):
    matches = []
    text = normalize_pokemon_names(catalog, question).casefold()
    records = tuple((p.pokemon_id, p.name_ko, p.name_en, p.form_identifier) for p in catalog.items.values())
    matcher, by_name = _matcher(records)
    for match in matcher.finditer(text):
        for identifier, form in by_name[match[1]]:
            matches.append((match.start(1), match.end(1), identifier, form))
    selected, spans = [], []
    for start, end, identifier, form in sorted(matches, key=lambda m: (-(m[1] - m[0]), m[0])):
        if any(start < right and end > left for left, right in spans):
            continue
        # A partial base name in an unrecognized Mega name is ambiguous.
        if not form and text[max(0, start - 5) : start].strip().endswith(
            ("메가", "mega")
        ):
            continue
        spans.append((start, end))
        selected.append((start, identifier))
    return list(dict.fromkeys(pid for _, pid in sorted(selected)))[:limit]
