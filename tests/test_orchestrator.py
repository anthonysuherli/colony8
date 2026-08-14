from __future__ import annotations

import json
from pathlib import Path

from colony8.agents.orchestrator import run_fleet
from colony8.memory.resolver import Decision
from colony8.memory.store import Candidate, recall
from tests.conftest import TEST_DB_URL, fake_embed

DEMO = json.loads((Path(__file__).parent.parent / "demo" / "sources.json").read_text())


def _stub_deps():
    """Deterministic stand-ins for the LLM deps; DB + resolver are fully real."""

    def plan_fn(question, n):
        return ["water: boiling", "water: freezing", "water: heat"]

    def search_fn(query, k=3):
        words = set(query.lower().replace(":", " ").split())
        return [s for s in DEMO if words & set(s["topics"])][:k]

    def extract_fn(subtopic, source, known_claims):
        # one candidate per source: its first sentence, topic-prefixed for fake_embed
        first = source["content"].split(". ")[0][:180]
        topic = subtopic.split(":")[0]
        return [Candidate(title=first[:60], claim=f"{topic}: {first}", quote=None,
                          provenance=[{"url": source["url"], "title": source["title"]}])]

    def classify_fn(cand, matches):
        return Decision(op="SUPERSEDE", target_id=matches[0].id, reason="stub: newer")

    return {"plan_fn": plan_fn, "search_fn": search_fn, "extract_fn": extract_fn,
            "classify_fn": classify_fn, "embed_fn": fake_embed}


def test_fleet_writes_shared_memory(pool, run_id) -> None:
    summary = run_fleet(pool, run_id, "thermal properties of water",
                        fleet_size=3, deps=_stub_deps())
    assert summary["status"] == "completed"
    assert summary["submitted"] >= 3
    live = recall(pool, run_id, fake_embed("water: boiling"), k=20)
    assert live  # memory has content


def test_restart_recall(pool, run_id) -> None:
    """Kill-the-fleet beat: a brand-new pool (fresh 'process') sees everything."""
    run_fleet(pool, run_id, "thermal properties of water", fleet_size=3, deps=_stub_deps())
    from colony8.memory.db import make_pool

    fresh = make_pool(TEST_DB_URL)
    try:
        live = recall(fresh, run_id, fake_embed("water: boiling"), k=20)
        assert live  # nothing lived in agent state; memory survived the restart
    finally:
        fresh.close()
