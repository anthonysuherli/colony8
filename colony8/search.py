"""Web sources: Tavily in prod, canned corpus in DEMO_MODE (reproducible on camera)."""
from __future__ import annotations

import json
from pathlib import Path

import httpx

from colony8.config import get_settings

_DEMO_PATH = Path(__file__).resolve().parent.parent / "demo" / "sources.json"


def _settings_demo() -> bool:
    return get_settings().demo_mode


def search_sources(query: str, k: int = 3) -> list[dict]:
    if _settings_demo():
        corpus = json.loads(_DEMO_PATH.read_text())
        words = set(query.lower().split())
        hits = [s for s in corpus if words & set(s["topics"])]
        return (hits or corpus)[:k]
    s = get_settings()
    r = httpx.post(
        "https://api.tavily.com/search",
        json={"api_key": s.tavily_api_key, "query": query, "max_results": k,
              "include_raw_content": True},
        timeout=30,
    )
    r.raise_for_status()
    return [
        {"url": item["url"], "title": item.get("title", item["url"]),
         "content": (item.get("raw_content") or item.get("content") or "")[:6000]}
        for item in r.json().get("results", [])
    ]
