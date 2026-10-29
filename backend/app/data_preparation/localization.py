"""Localized names from upstream CSV; absent translations stay absent."""

import re
import unicodedata

LOCALE_LANGUAGES = {"ko": "ko", "en": "en", "ja": "ja", "zh": "zh-hans"}


def slugify_name(name):
    text = unicodedata.normalize("NFC", name).lower().replace("♀", "-female").replace("♂", "-male")
    return re.sub(r"-+", "-", "".join(c if unicodedata.category(c)[0] in "LNM" else "-" for c in text)).strip("-")


def localized_routes(records, tables):
    languages = {r["identifier"]: r["id"] for r in tables["languages"]}
    names = {(r["pokemon_species_id"], r["local_language_id"]): r["name"] for r in tables["pokemon_species_names"]}
    forms = {r["pokemon_id"]: r for r in tables["pokemon_forms"] if r["is_default"] == "1"}
    labels = {(r["pokemon_form_id"], r["local_language_id"]): r for r in tables["pokemon_form_names"]}
    result = []
    for record in records:
        number = record["pokemon_id"].split(":")[1]
        form = forms.get(number)
        translated = {}
        for locale, language in LOCALE_LANGUAGES.items():
            language_id = languages[language]
            base = names.get((str(record["species_id"]), language_id))
            label = labels.get((form["id"], language_id), {}) if form else {}
            if record["is_default"] and base:
                translated[locale] = base
            elif label.get("pokemon_name"):
                translated[locale] = label["pokemon_name"]
            elif base and label.get("form_name"):
                translated[locale] = f"{base} ({label['form_name']})"
        # The known upstream resource identifier also identifies untranslated forms.
        translated.setdefault("en", record["name_en"])
        slugs = {locale: slugify_name(translated.get(locale) or record["name_en"]) for locale in LOCALE_LANGUAGES}
        # Preserve the established upstream identifier in English paths.
        slugs["en"] = slugify_name(record["form_identifier"] or record["name_en"])
        if not all(slugs.values()):
            raise ValueError(f"Empty localized slug: {record['pokemon_id']}")
        result.append({"pokemon_id": record["pokemon_id"], "names": translated, "slugs": slugs})
    if len({r["pokemon_id"] for r in result}) != len(result):
        raise ValueError("Duplicate localized resource IDs")
    return result


REFERENCE_TABLES = [
    "languages", "abilities", "ability_names", "moves", "move_names",
    "items", "item_names", "natures", "nature_names",
    "pokemon_species_flavor_text", "versions",
]


def localized_reference(tables):
    """Preserve upstream labels and per-language flavor-text versions, never translate."""
    languages = {r["identifier"]: r["id"] for r in tables["languages"]}
    locales = {languages[language]: locale for locale, language in LOCALE_LANGUAGES.items()}
    result = {}
    for category, entities, labels, foreign_key in [
        ("ability", "abilities", "ability_names", "ability_id"),
        ("move", "moves", "move_names", "move_id"),
        ("held_item", "items", "item_names", "item_id"),
        ("stat_alignment", "natures", "nature_names", "nature_id"),
    ]:
        identifiers = {r["id"]: r["identifier"] for r in tables[entities]}
        names = {}
        for row in tables[labels]:
            locale = locales.get(row["local_language_id"])
            if locale and row["name"] and row[foreign_key] in identifiers:
                names.setdefault(identifiers[row[foreign_key]], {})[locale] = row["name"]
        result[category] = names
    versions = {r["id"]: r["identifier"] for r in tables["versions"]}
    descriptions = {}
    latest = {}
    for row in tables["pokemon_species_flavor_text"]:
        locale = locales.get(row["language_id"])
        key = (row["species_id"], locale)
        version = int(row["version_id"])
        if locale and row["flavor_text"].strip() and version > latest.get(key, -1):
            latest[key] = version
            descriptions.setdefault(row["species_id"], {})[locale] = {
                "text": " ".join(row["flavor_text"].split()),
                "version": versions[row["version_id"]],
            }
    result["descriptions"] = descriptions
    return result
