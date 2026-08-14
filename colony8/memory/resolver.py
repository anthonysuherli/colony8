"""Write-time memory resolution.

    candidate ──► snapshot: vector recall (no lock)
                    │  best sim < ADD_THRESHOLD ──► ADD fast path
                    ▼
                classify (LLM, outside any txn) ──► ADD | UPDATE | NOOP | SUPERSEDE
                    ▼
                one SERIALIZABLE txn: SELECT ... FOR UPDATE, verify versions, apply
                    │  version drift ──► re-snapshot + re-classify
                    │  SQLSTATE 40001 ──► jittered retry
                    ▼  attempts exhausted ──► DEFERRED event (never dropped)
"""
from __future__ import annotations

import random
import time
from dataclasses import dataclass
from typing import Callable

from psycopg.errors import SerializationFailure

from colony8.memory.store import (
    Candidate,
    Match,
    StaleSnapshot,
    insert_finding,
    invalidate,
    log_event,
    recall,
)

ADD_THRESHOLD = 0.60


@dataclass
class Decision:
    op: str  # ADD | UPDATE | NOOP | SUPERSEDE
    target_id: str | None = None
    reason: str = ""


def submit_finding(
    pool,
    run_id: str,
    cand: Candidate,
    embed_fn: Callable[[str], list[float]],
    classify_fn: Callable[[Candidate, list[Match]], Decision],
    max_attempts: int = 5,
) -> dict:
    embedding = embed_fn(cand.claim)
    for attempt in range(max_attempts):
        matches = recall(pool, run_id, embedding, k=5)
        if not matches or matches[0].similarity < ADD_THRESHOLD:
            decision = Decision(op="ADD", reason="no similar live finding")
        else:
            decision = classify_fn(cand, matches)
        try:
            return _apply(pool, run_id, cand, embedding, decision, matches)
        except (StaleSnapshot, SerializationFailure):
            time.sleep(random.uniform(0.01, 0.05) * (attempt + 1))
            continue
    with pool.connection() as conn:
        log_event(conn, run_id, "DEFERRED", cand.title,
                  reason=f"unresolved after {max_attempts} attempts")
    return {"op": "DEFERRED", "finding_id": None, "target_id": None}


def _apply(pool, run_id: str, cand: Candidate, embedding: list[float],
           decision: Decision, matches: list[Match]) -> dict:
    with pool.connection() as conn:
        with conn.transaction():
            if decision.op == "ADD":
                fid = insert_finding(conn, run_id, cand, embedding)
                log_event(conn, run_id, "ADD", cand.title, new_id=fid, reason=decision.reason)
                return {"op": "ADD", "finding_id": fid, "target_id": None}

            # NOOP, UPDATE, SUPERSEDE all touch exactly one row: lock/verify only that one.
            target = next((m for m in matches if m.id == decision.target_id), None)
            if target is None:
                raise StaleSnapshot(f"target {decision.target_id} not in snapshot")
            row = conn.execute(
                "SELECT version FROM findings WHERE id = %s AND invalidated_at IS NULL FOR UPDATE",
                (target.id,),
            ).fetchone()
            if row is None or row[0] != target.version:
                raise StaleSnapshot(f"{target.id} moved")

            if decision.op == "NOOP":
                log_event(conn, run_id, "NOOP", cand.title,
                          target_id=decision.target_id, reason=decision.reason)
                return {"op": "NOOP", "finding_id": None, "target_id": decision.target_id}

            # UPDATE and SUPERSEDE share mechanics: insert winner, retire loser.
            fid = insert_finding(conn, run_id, cand, embedding)
            invalidate(conn, target.id, superseded_by=fid, expected_version=target.version)
            log_event(conn, run_id, decision.op, cand.title,
                      target_id=target.id, new_id=fid, reason=decision.reason)
            return {"op": decision.op, "finding_id": fid, "target_id": target.id}
