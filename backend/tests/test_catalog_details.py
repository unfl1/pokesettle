from backend.scripts.prepare_catalog_details import build_details


def test_learnsets_keep_version_methods_and_deduplicate():
    tables = {
        "moves": [{"id": "1", "identifier": "pound"}],
        "move_names": [{"move_id": "1", "local_language_id": "3", "name": "막치기"}],
        "version_groups": [
            {"id": "99", "identifier": "old-game", "order": "0"},
            {"id": "1", "identifier": "red-blue", "order": "1"},
            {"id": "2", "identifier": "yellow", "order": "2"},
        ],
        "pokemon_move_methods": [
            {"id": "1", "identifier": "level-up"},
            {"id": "4", "identifier": "machine"},
        ],
        "pokemon_moves": [
            {
                "pokemon_id": "25",
                "move_id": "1",
                "version_group_id": group,
                "pokemon_move_method_id": method,
                "level": level,
            }
            for group, method, level in [
                ("99", "1", "1"),
                ("1", "1", "2"),
                ("2", "1", "5"),
                ("2", "1", "5"),
                ("2", "4", "0"),
            ]
        ],
    }
    detail = build_details(tables)["pokemon:25"]
    assert detail["version_group"] == "yellow"
    assert detail["moves"] == [
        {"name": "막치기", "method": "level-up", "level": 5},
        {"name": "막치기", "method": "machine", "level": 0},
    ]


def test_real_profile_has_stats_description_and_labelled_moves():
    from backend.app.catalog import Catalog
    from backend.app.core.config import ROOT

    catalog = Catalog(ROOT / "data" / "pokemon.json")
    profile = catalog.profile("pokemon:25")
    assert profile["base_stats"]["speed"] == 90
    assert profile["description"]
    assert profile["description_version"]
    assert profile["learnset"]["version_group"]
    assert any(
        m["method"] == "train" and m["name"] == "10만볼트" for m in profile["learnset"]["moves"]
    )
    thunderbolt = next(m for m in profile["learnset"]["moves"] if m["name"] == "10만볼트")
    assert thunderbolt["type"] == "electric"
    assert thunderbolt["power"] == 90
    assert profile["learnset_sources"][0]["collected_at"]


def test_localized_ability_names_preserve_source_identifiers():
    from backend.app.catalog import Catalog
    from backend.app.core.config import ROOT

    catalog = Catalog(ROOT / "data/pokemon.json")
    profile = catalog.profile("pokemon:1")
    assert profile["abilities"] == ["overgrow", "chlorophyll"]
    assert profile["ability_details"] == [
        {"name": "overgrow", "name_ko": "심록"},
        {"name": "chlorophyll", "name_ko": "엽록소"},
    ]
    assert any(
        source["url"].endswith("/ability_names.csv") for source in catalog.details["sources"]
    )
