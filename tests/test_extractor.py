from __future__ import annotations

from colony8.agents import extractor


def test_extract_fills_provenance(monkeypatch) -> None:
    monkeypatch.setattr(
        extractor, "llm_json",
        lambda prompt, schema, **kw: {
            "findings": [{"title": "boiling point", "claim": "water boils at 100C at sea level",
                          "quote": "pure water boils at 100.0C", "confidence": 0.9}]
        },
    )
    src = {"url": "https://x.test/a", "title": "Src", "content": "..."}
    out = extractor.extract_findings("boiling point of water", src, known_claims=[])
    assert len(out) == 1
    assert out[0].provenance == [{"url": "https://x.test/a", "title": "Src"}]
    assert out[0].confidence == 0.9


def test_demo_mode_search(monkeypatch) -> None:
    from colony8 import search

    monkeypatch.setattr(search, "_settings_demo", lambda: True)
    res = search.search_sources("boiling point of water")
    assert res and all("demo.colony8.dev" in r["url"] for r in res)
