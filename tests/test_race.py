from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor

from colony8.memory.resolver import Decision, submit_finding
from colony8.memory.store import Candidate, recall
from tests.conftest import fake_embed

PROV = [{"url": "https://example.com/a", "title": "Source A"}]


def test_concurrent_contradiction(pool, run_id) -> None:
    """Two agents submit contradictory facts simultaneously. Exactly one survives;
    nothing is lost; the loser re-resolved against the winner's committed write."""
    base = Candidate(title="pop: city population 1.0M (2020 census)",
                     claim="pop: city population 1.0M", quote=None, provenance=PROV)
    submit_finding(pool, run_id, base, fake_embed, lambda c, m: Decision(op="ADD"))

    def supersede_best(cand, matches):
        return Decision(op="SUPERSEDE", target_id=matches[0].id, reason="fresher figure")

    def worker(claim: str):
        cand = Candidate(title=claim[:60], claim=claim, quote=None, provenance=PROV)
        return submit_finding(pool, run_id, cand, fake_embed, supersede_best)

    with ThreadPoolExecutor(max_workers=2) as ex:
        r1 = ex.submit(worker, "pop: city population 1.1M (2023 est)")
        r2 = ex.submit(worker, "pop: city population 1.2M (2024 est)")
        out1, out2 = r1.result(), r2.result()

    assert {out1["op"], out2["op"]} <= {"SUPERSEDE"}
    live = recall(pool, run_id, fake_embed("pop: population"), k=10)
    assert len(live) == 1  # exactly one live fact — the whole thesis
    with pool.connection() as conn:
        total = conn.execute(
            "SELECT count(*) FROM findings WHERE run_id = %s", (run_id,)
        ).fetchone()[0]
        dead = conn.execute(
            "SELECT count(*) FROM findings WHERE run_id = %s AND invalidated_at IS NOT NULL "
            "AND superseded_by IS NOT NULL",
            (run_id,),
        ).fetchone()[0]
        events = conn.execute(
            "SELECT count(*) FROM resolution_events WHERE run_id = %s AND op = 'SUPERSEDE'",
            (run_id,),
        ).fetchone()[0]
    assert total == 3 and dead == 2 and events == 2  # no lost writes, full audit chain
