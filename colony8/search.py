"""Web sources: Tavily in prod, canned corpus in DEMO_MODE (reproducible on camera)."""
from __future__ import annotations

import json
from pathlib import Path

import httpx

from colony8.config import get_settings

# Repo checkout puts demo/ beside the package; the Lambda image installs the package
# into site-packages and copies demo/ to the task root, so check the working dir too.
_DEMO_CANDIDATES = (
    Path(__file__).resolve().parent.parent / "demo" / "sources.json",
    Path.cwd() / "demo" / "sources.json",
)


def _demo_corpus_path() -> Path:
    for p in _DEMO_CANDIDATES:
        if p.is_file():
            return p
    raise FileNotFoundError(
        f"DEMO_MODE is on but no demo corpus found at any of: "
        f"{', '.join(str(p) for p in _DEMO_CANDIDATES)}"
    )


def _settings_demo() -> bool:
    return get_settings().demo_mode


def search_sources(query: str, k: int = 3) -> list[dict]:
    if _settings_demo():
        corpus = json.loads(_demo_corpus_path().read_text())
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
