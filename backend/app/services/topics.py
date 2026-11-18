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


def explicit_team_rosters(catalog, question):
    """Resolve named roster clauses without trusting model-assigned sides."""
    markers = list(re.finditer(
        r"(?P<own>(?:내|우리)\s*(?:팀|파티|엔트리|포켓몬|라인업))"
        r"|(?P<opponent>상대(?:방)?\s*(?:(?:팀|파티|엔트리|포켓몬|라인업)(?:는|은|:)?|는|은|:))",
        question,
    ))
    rosters = {}
    for index, marker in enumerate(markers):
        end = markers[index + 1].start() if index + 1 < len(markers) else len(question)
        text = re.split(r"[.?!]", question[marker.end():end], maxsplit=1)[0]
        roster = mentioned_pokemon(catalog, text, limit=7)
        if roster:
            rosters[f"{marker.lastgroup}_team_ids"] = roster
    # Korean also places ownership after the list: 'A B ... 가 내거고 상대는 ...'.
    owner = re.search(r"(?:이|가)?\s*내\s*(?:거|꺼|것)(?:고|이고|야|이야)", question)
    if owner:
        text = re.split(r"[.?!]", question[:owner.start()])[-1]
        if not re.search(r"상대", text):
            roster = mentioned_pokemon(catalog, text, limit=7)
            if roster:
                rosters["own_team_ids"] = roster
    return rosters
