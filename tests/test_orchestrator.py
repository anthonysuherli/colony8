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


def test_cross_session_injection(pool, run_id) -> None:
    """Session 2's researchers get session 1's claims in-context; the ledger says so."""
    import uuid

    run_fleet(pool, run_id, "thermal properties of water", fleet_size=3, deps=_stub_deps())

    rid2 = str(uuid.uuid4())
    with pool.connection() as conn:
        conn.execute("INSERT INTO runs (id, question) VALUES (%s, %s)",
                     (rid2, "cooking at altitude"))

    seen: list[list[str]] = []
    deps = _stub_deps()
    inner = deps["extract_fn"]

    def spying_extract(subtopic, source, known_claims):
        seen.append(list(known_claims))
        return inner(subtopic, source, known_claims)

    deps["extract_fn"] = spying_extract
    run_fleet(pool, rid2, "cooking at altitude", fleet_size=3, deps=deps)

    with pool.connection() as conn:
        run1_claims = {r[0] for r in conn.execute(
            "SELECT content->>'claim' FROM findings WHERE run_id = %s", (run_id,)
        ).fetchall()}
        ops = [r[0] for r in conn.execute(
            "SELECT op FROM resolution_events WHERE run_id = %s", (rid2,)).fetchall()]
    injected = {c for knowns in seen for c in knowns}
    assert injected & run1_claims  # session 1's memory reached session 2's prompt
    assert "INJECT" in ops  # and the moment is on session 2's ledger


def test_fleet_failure_marks_run_failed(pool, run_id) -> None:
    """Any unhandled error sets runs.status to 'failed' and re-raises."""
    import pytest

    deps = _stub_deps()

    def boom(q, n):
        raise RuntimeError("planner down")

    deps["plan_fn"] = boom
    with pytest.raises(RuntimeError, match="planner down"):
        run_fleet(pool, run_id, "q", fleet_size=3, deps=deps)
    with pool.connection() as conn:
        status = conn.execute("SELECT status FROM runs WHERE id = %s",
                              (run_id,)).fetchone()[0]
    assert status == "failed"
