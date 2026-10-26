"""Conservative Korean name spelling repair; no species or form inference."""

import re
import unicodedata
from functools import lru_cache

_KEYBOARD = str.maketrans(dict(zip(
    "rsefaqtdwczxvgREQTWkoijpuhynbmlOP",
    "ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎㄲㄸㅃㅆㅉㅏㅐㅑㅓㅔㅕㅗㅛㅜㅠㅡㅣㅒㅖ",
)))
_SUFFIXES = ("이야", "인데", "이고", "이랑", "한테", "처럼", "으로", "야", "은", "는", "이", "가", "을", "를", "의", "와", "과", "랑", "도")
_WORDS = re.compile(r"[가-힣ㄱ-ㅣᄀ-ᇿA-Za-z0-9♀♂-]+")
_FINALS = {
    unicodedata.normalize("NFKD", consonant): chr(0x11A8 + index)
    for index, consonant in enumerate("ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ")
}


@lru_cache(maxsize=4096)
def _jamo(text):
    return unicodedata.normalize("NFD", text)


def _compose_input(text, keyboard=True):
    decomposed = unicodedata.normalize("NFKD", text.translate(_KEYBOARD) if keyboard else text)
    result = []
    for index, char in enumerate(decomposed):
        # Compatibility consonants use initial-letter codepoints. Before another
        # consonant or at word end, a consonant following LV is a final instead.
        if (
            char in _FINALS and "\u1100" <= char <= "\u115F"
            and len(result) >= 2 and "\u1100" <= result[-2] <= "\u1112"
            and "\u1161" <= result[-1] <= "\u1175"
            and not (index + 1 < len(decomposed) and "\u1161" <= decomposed[index + 1] <= "\u1175")
        ):
            char = _FINALS[char]
        result.append(char)
    return unicodedata.normalize("NFC", "".join(result))


def _deletions(text):
    first = {text[:i] + text[i + 1:] for i in range(len(text))}
    return {text, *first, *(part[:i] + part[i + 1:] for part in first for i in range(len(part)))}


@lru_cache(maxsize=4)
def _name_index(names):
    index = {}
    common_errors = {}
    for name in names:
        for key in _deletions(_jamo(name)):
            index.setdefault(key, set()).add(name)
        # A syllable omission or swap can be more than two jamo edits away.
        # Include these origins as ambiguity blockers, even when not repairable.
        variants = {name[:i] + name[i + 1:] for i in range(len(name))}
        variants.update(name[:i] + name[i + 1] + name[i] + name[i + 2:] for i in range(len(name) - 1))
        for variant in variants:
            common_errors.setdefault(_jamo(variant), set()).add(name)
    return index, common_errors


def _distance(left, right):
    """Levenshtein distance, stopping once a two-edit match is impossible."""
    if abs(len(left) - len(right)) > 2:
        return 3
    previous = list(range(len(right) + 1))
    for i, char in enumerate(left, 1):
        row = [i]
        for j, other in enumerate(right, 1):
            row.append(min(row[-1] + 1, previous[j] + 1, previous[j - 1] + (char != other)))
        if min(row) > 2:
            return 3
        previous = row
    return previous[-1]


def normalize_pokemon_names(catalog, question):
    """Repair unambiguous names within two jamo edits, preserving prose.

    Short names, ties and ambiguous localized form names stay untouched. Latin
    keyboard keys are interpreted only inside a word that already contains Hangul.
    """
    names = {}
    for pokemon in catalog.items.values():
        if pokemon.name_ko:
            names.setdefault(pokemon.name_ko, set()).add(pokemon.pokemon_id)
    index, common_errors = _name_index(tuple(sorted(names)))
    max_length = max((len(name) for name in names), default=0)

    def replace(match):
        raw = match[0]
        if not re.search(r"[가-힣ㄱ-ㅣᄀ-ᇿ]", raw):
            return raw
        word = _compose_input(raw)
        variants = [(word, ""), *[(word[:-len(suffix)], suffix) for suffix in _SUFFIXES if word.endswith(suffix)]]
        # A real catalog name always wins over any approximate interpretation.
        for stem, suffix in variants:
            if stem in names:
                return stem + suffix
        if question[max(0, match.start() - 5):match.start()].strip().endswith(("메가", "mega")):
            return raw
        matches = set()
        for stem, suffix in variants:
            if not 1 <= len(stem) <= max_length + 1 or not re.fullmatch(r"[가-힣]+", stem):
                continue
            decomposed = _jamo(stem)
            # Even short stems can block another reading that consumes a particle.
            # They cannot be selected automatically below.
            candidates = set().union(*(index.get(key, ()) for key in _deletions(decomposed)))
            candidates.update(common_errors.get(decomposed, ()))
            for name in candidates:
                distance = _distance(decomposed, _jamo(name))
                if distance <= 2 or name in common_errors.get(decomposed, ()):
                    matches.add((name, suffix, distance))
        if len(matches) == 1:
            name, suffix, distance = matches.pop()
            minimum = 4 if distance == 2 else 3
            if (
                distance <= 2 and len(names[name]) == 1
                and re.fullmatch(r"[가-힣]+", name)
                and len(name) >= minimum and len(word) - len(suffix) >= minimum
            ):
                return name + suffix
        # Compose complete Unicode syllables even in punctuation-separated names
        # such as 타입:널. Do not reinterpret Latin keys or incomplete initials here.
        composed = _compose_input(raw, keyboard=False)
        return composed if re.fullmatch(r"[가-힣A-Za-z0-9♀♂-]+", composed) else raw

    return _WORDS.sub(replace, question)
