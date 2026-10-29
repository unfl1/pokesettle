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
