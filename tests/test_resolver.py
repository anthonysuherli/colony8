from __future__ import annotations

from colony8.memory.resolver import Decision, submit_finding
from colony8.memory.store import Candidate, recall
from tests.conftest import fake_embed

PROV = [{"url": "https://example.com/a", "title": "Source A"}]


def _cand(claim: str, conf: float = 0.7) -> Candidate:
    return Candidate(title=claim[:60], claim=claim, quote=None, provenance=PROV, confidence=conf)


def _never_called(cand, matches):  # classifier must not run on the fast path
    raise AssertionError("classifier called on empty memory")


def test_add_fast_path(pool, run_id) -> None:
    out = submit_finding(
        pool, run_id, _cand("orbit: mars year is 687 days"), fake_embed, _never_called
    )
    assert out["op"] == "ADD" and out["finding_id"]


def test_noop(pool, run_id) -> None:
    submit_finding(pool, run_id, _cand("noop: the sky is blue"), fake_embed, _never_called)
    out = submit_finding(
        pool, run_id, _cand("noop: the sky is blue indeed"),
        fake_embed, lambda c, m: Decision(op="NOOP", target_id=m[0].id, reason="duplicate"),
    )
    assert out["op"] == "NOOP" and out["finding_id"] is None
    assert len(recall(pool, run_id, fake_embed("noop: sky"), k=10)) == 1


def test_supersede_chain(pool, run_id) -> None:
    first = submit_finding(
        pool, run_id, _cand("boil: water boils at 90C"), fake_embed, _never_called
    )
    out = submit_finding(
        pool, run_id, _cand("boil: water boils at 100C at sea level"),
        fake_embed,
        lambda c, m: Decision(
            op="SUPERSEDE", target_id=m[0].id, reason="contradicts: better source"
        ),
    )
    assert out["op"] == "SUPERSEDE"
    live = recall(pool, run_id, fake_embed("boil: temp"), k=10)
    assert [m.id for m in live] == [out["finding_id"]]
    with pool.connection() as conn:
        row = conn.execute(
            "SELECT invalidated_at, superseded_by FROM findings WHERE id = %s",
            (first["finding_id"],),
        ).fetchone()
    assert row[0] is not None and str(row[1]) == out["finding_id"]


def test_update(pool, run_id) -> None:
    submit_finding(pool, run_id, _cand("dist: moon is ~384k km away"), fake_embed, _never_called)
    out = submit_finding(
        pool, run_id, _cand("dist: moon is 384,400 km away on average"),
        fake_embed, lambda c, m: Decision(op="UPDATE", target_id=m[0].id, reason="refines"),
    )
    assert out["op"] == "UPDATE"
    assert len(recall(pool, run_id, fake_embed("dist: moon"), k=10)) == 1


def test_stale_snapshot_reclassifies(pool, run_id) -> None:
    """If the target mutates between snapshot and apply, the resolver re-runs."""
    base = submit_finding(
        pool, run_id, _cand("age: universe is 13B years"), fake_embed, _never_called
    )
    calls = {"n": 0}

    def classify(cand, matches):
        calls["n"] += 1
        if calls["n"] == 1:  # sabotage: bump the target's version out from under the resolver
            with pool.connection() as conn:
                conn.execute(
                    "UPDATE findings SET version = version + 1 WHERE id = %s",
                    (base["finding_id"],),
                )
        return Decision(op="SUPERSEDE", target_id=matches[0].id, reason="newer estimate")

    out = submit_finding(pool, run_id, _cand("age: universe is 13.8B years"), fake_embed, classify)
    assert calls["n"] >= 2  # re-classified against fresh state
    assert out["op"] in ("SUPERSEDE", "ADD")


def test_deferred_after_exhaustion(pool, run_id) -> None:
    submit_finding(pool, run_id, _cand("mass: earth is 6e24 kg"), fake_embed, _never_called)

    def always_stale(cand, matches):
        with pool.connection() as conn:  # bump version every attempt
            conn.execute(
                "UPDATE findings SET version = version + 1 WHERE id = %s", (matches[0].id,)
            )
        return Decision(op="SUPERSEDE", target_id=matches[0].id, reason="x")

    out = submit_finding(
        pool, run_id, _cand("mass: earth weighs 5.97e24 kg"), fake_embed,
        always_stale, max_attempts=3,
    )
    assert out["op"] == "DEFERRED" and out["finding_id"] is None
    with pool.connection() as conn:
        n = conn.execute(
            "SELECT count(*) FROM resolution_events WHERE run_id = %s AND op = 'DEFERRED'",
            (run_id,),
        ).fetchone()[0]
    assert n == 1
