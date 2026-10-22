"""Resolve only explicit catalog names; never infer sides, sets or alternate forms."""

import re


def mentioned_pokemon(catalog, question, limit=2):
    matches = []
    text = question.casefold()
    for pokemon in catalog.items.values():
        for name in {pokemon.name_ko, pokemon.name_en} - {None, ""}:
            pattern = re.escape(name.casefold())
            if name.isascii():
                pattern = r"(?<![a-z0-9-])" + pattern + r"(?![a-z0-9-])"
            for match in re.finditer(pattern, text):
                matches.append((match.start(), match.end(), pokemon))
    selected, spans = [], []
    for start, end, pokemon in sorted(matches, key=lambda m: (-(m[1] - m[0]), m[0])):
        if any(start < right and end > left for left, right in spans):
            continue
        # A partial base name in an unrecognized Mega name is ambiguous.
        if not pokemon.form_identifier and text[max(0, start - 5) : start].strip().endswith(
            ("메가", "mega")
        ):
            continue
        spans.append((start, end))
        selected.append((start, pokemon.pokemon_id))
    return list(dict.fromkeys(pid for _, pid in sorted(selected)))[:limit]
