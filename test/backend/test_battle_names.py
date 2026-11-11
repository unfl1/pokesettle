from backend.scripts.prepare_battle_names import build_names


def test_name_translation_joins_by_id_and_keeps_only_korean():
    tables = {
        "items": [{"id": "1", "identifier": "known-item"}, {"id": "2", "identifier": "unknown"}],
        "item_names": [{"item_id": "1", "local_language_id": "3", "name": "합성 도구"},
                       {"item_id": "2", "local_language_id": "9", "name": "English only"}],
        "natures": [{"id": "1", "identifier": "test-nature"}],
        "nature_names": [{"nature_id": "1", "local_language_id": "3", "name": "합성 성격"}],
    }
    sources = [{"url": "https://example.org/synthetic", "collected_at": "test-only"}]
    result = build_names(tables, sources)
    assert result["held_item"] == {"known-item": "합성 도구"}
    assert result["stat_alignment"] == {"test-nature": "합성 성격"}
    assert result["sources"] == sources
