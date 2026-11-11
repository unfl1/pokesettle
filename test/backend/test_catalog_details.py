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
    assert [{"name": a["name"], "name_ko": a["name_ko"]} for a in profile["ability_details"]] == [
        {"name": "overgrow", "name_ko": "심록"},
        {"name": "chlorophyll", "name_ko": "엽록소"},
    ]
    assert any(
        source["url"].endswith("/ability_names.csv") for source in catalog.details["sources"]
    )


def test_profile_localizes_reference_data_without_changing_identifiers():
    from backend.app.catalog import Catalog
    from backend.app.core.config import ROOT

    catalog = Catalog(ROOT / "data/pokemon.json")
    profile = catalog.profile("pokemon:25")
    thunderbolt = next(m for m in profile["learnset"]["moves"] if m["name"] == "10만볼트")
    assert thunderbolt["name_en"] == "thunderbolt"
    assert thunderbolt["names"] == {"ko": "10만볼트", "en": "Thunderbolt", "ja": "１０まんボルト", "zh": "十万伏特"}
    assert {"ko", "en", "ja", "zh"} <= profile["descriptions"].keys()
    assert all(row["text"] and row["version"] for row in profile["descriptions"].values())
    assert profile["localization_sources"] and profile["localization_licence_url"]
    assert catalog.profile("pokemon:1")["ability_details"][0]["names"]["ja"] == "しんりょく"
    assert catalog.localization["held_item"]["leftovers"]["zh"] == "吃剩的东西"
    assert catalog.localization["stat_alignment"]["adamant"]["en"] == "Adamant"


def test_localized_reference_keeps_missing_names_absent_and_versions_per_language():
    from backend.app.data_preparation.localization import localized_reference

    tables = {
        "languages": [{"id": str(i), "identifier": key} for i, key in enumerate(["ko", "en", "ja", "zh-hans"], 1)],
        "versions": [{"id": "1", "identifier": "old"}, {"id": "2", "identifier": "new"}],
        "pokemon_species_flavor_text": [
            {"species_id": "1", "language_id": "2", "version_id": "1", "flavor_text": "Old English."},
            {"species_id": "1", "language_id": "2", "version_id": "2", "flavor_text": "New\nEnglish."},
            {"species_id": "1", "language_id": "3", "version_id": "1", "flavor_text": "日本語"},
        ],
    }
    for table, labels, foreign_key in [
        ("abilities", "ability_names", "ability_id"), ("moves", "move_names", "move_id"),
        ("items", "item_names", "item_id"), ("natures", "nature_names", "nature_id"),
    ]:
        tables[table] = [{"id": "1", "identifier": "synthetic"}]
        tables[labels] = [{foreign_key: "1", "local_language_id": "2", "name": "Synthetic"}]
    result = localized_reference(tables)
    assert result["move"]["synthetic"] == {"en": "Synthetic"}
    assert result["descriptions"]["1"] == {
        "en": {"text": "New English.", "version": "new"},
        "ja": {"text": "日本語", "version": "old"},
    }


def test_defense_profile_reuses_type_chart_and_keeps_immunities():
    from backend.app.battle.engine import BattleEngine
    from backend.app.core.config import ROOT
    engine = BattleEngine(None, ROOT / "data")
    fire_flying = engine.defense_profile(["fire", "flying"])
    multipliers = {entry["type"]: entry["multiplier"] for entry in fire_flying["multipliers"]}
    assert len(multipliers) == 18
    assert multipliers["rock"] == 4
    assert multipliers["water"] == 2
    assert multipliers["grass"] == 0.25
    assert multipliers["ground"] == 0
    assert fire_flying["scope"] == "generic"
    assert fire_flying["sources"][0]["collected_at"]
    ghost_poison = engine.defense_profile(["ghost", "poison"])
    assert {entry["type"]: entry["multiplier"] for entry in ghost_poison["multipliers"]}["ground"] == 2
    assert engine.defense_profile(["unknown"]) is None
    assert engine.defense_profile([]) is None


def test_public_detail_includes_defense_and_sources_without_session(setup):
    from fastapi.testclient import TestClient

    from backend.app.catalog import Catalog
    from backend.app.core.config import ROOT
    from backend.app.main import create_app
    setup.service.catalog = Catalog(ROOT / "data/pokemon.json")
    (setup.settings.data_dir / "type_chart.json").write_text((ROOT / "data/type_chart.json").read_text())
    with TestClient(create_app(setup.settings, service=setup.service)) as client:
        response = client.get("/api/pokemon/pokemon:6")
        assert response.status_code == 200
        defense = response.json()["data"]["typeDefense"]
        assert defense["scope"] == "generic"
        assert {entry["type"]: entry["multiplier"] for entry in defense["multipliers"]}["rock"] == 4
        assert defense["sources"][0]["sourceUrl"]
        assert defense["sources"][0]["collectedAt"]
        (setup.settings.data_dir / "type_chart.json").unlink()
        assert client.get("/api/pokemon/pokemon:6").json()["data"]["typeDefense"] is None
    assert setup.model.calls == []


def test_move_effect_builder_uses_stat_recipient_not_attack_target():
    from backend.scripts.prepare_catalog_details import build_move_effects
    tables = {
        "stats": [{"id": "4", "identifier": "special-attack"}, {"id": "5", "identifier": "special-defense"}],
        "move_targets": [{"id": "7", "identifier": "user"}, {"id": "10", "identifier": "selected-pokemon"}],
        "move_meta_categories": [{"id": "2", "identifier": "net-good-stats"}, {"id": "7", "identifier": "damage-raise"}, {"id": "6", "identifier": "damage-lower"}],
        "move_meta": [{"move_id": str(i), "meta_category_id": cat, "stat_chance": chance} for i,cat,chance in [(1,"2","0"),(2,"7","10"),(3,"6","20")]],
        "moves": [{"id": str(i), "identifier": f"move-{i}", "pp": "20", "target_id": "7" if i==1 else "10", "effect_id": "42" if i<4 else "1"} for i in range(1,5)],
        "move_meta_stat_changes": [{"move_id": str(i), "stat_id": "4", "change": "1" if i<3 else "-1"} for i in range(1,4)],
        "languages": [{"id": "3", "identifier": "ko"}, {"id": "9", "identifier": "en"}],
        "version_groups": [{"id": "1", "identifier": "old", "order": "1"}, {"id": "2", "identifier": "new", "order": "2"}],
        "move_flavor_text": [{"move_id": "1", "language_id": "3", "version_group_id": str(i), "flavor_text": text} for i,text in [(1,"이전 설명"),(2,"최신\n설명")]],
        "move_effect_prose": [{"move_effect_id": "42", "local_language_id": "9", "short_effect": "Source description"}],
    }
    effects = build_move_effects(tables)
    assert effects["move-1"]["pp"] == 20
    assert effects["move-1"]["stat_target"] == "user"
    assert effects["move-1"]["effect_texts"]["ko"] == {"text": "최신 설명", "version_group": "new"}
    assert effects["move-2"]["stat_target"] == "user"
    assert effects["move-2"]["stat_chance"] == 10
    assert effects["move-3"]["stat_target"] == "target"
    assert effects["move-3"]["stat_changes"][0]["change"] == -1
    assert effects["move-4"]["effect_texts"] == {}


def test_collected_move_effects_keep_real_pp_stages_probability_and_source_text():
    import json

    from backend.app.catalog import Catalog
    from backend.app.core.config import ROOT
    records = json.loads((ROOT / "data/catalog_details.json").read_text())
    moves = {move["name"]: move for move in records["move_details"]}
    calm = moves["calm-mind"]
    assert calm["pp"] == 20
    assert calm["stat_changes"] == [{"stat": "special-attack", "change": 1}, {"stat": "special-defense", "change": 1}]
    assert calm["stat_target"] == "user"
    assert calm["effect_texts"]["ko"]["version_group"]
    assert moves["ancient-power"]["stat_target"] == "user"
    assert moves["ancient-power"]["stat_chance"] == 10
    assert moves["psychic"]["stat_target"] == "target"
    assert moves["tackle"]["effect_texts"] == {}
    assert moves["thunderbolt"]["effect_meta"]["ailment"] == "paralysis"
    assert moves["thunderbolt"]["effect_meta"]["ailment_chance"] == 10
    assert moves["air-slash"]["effect_meta"]["flinch_chance"] == 30
    assert moves["recover"]["effect_meta"]["healing"] == 50
    assert moves["fake-out"]["effect_meta"]["tags"] == ["first-turn-only"]
    assert moves["fissure"]["effect_meta"]["category"] == "ohko"
    profile = Catalog(ROOT / "data/pokemon.json").profile("pokemon:65")
    move = next(move for move in profile["learnset"]["moves"] if move["name_en"] == "calm-mind")
    assert move["pp"] == 20 and move["stat_changes"] == calm["stat_changes"]
