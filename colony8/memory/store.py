"""Low-level SQL for the shared memory. All mutations run inside a caller-owned txn."""
from __future__ import annotations

import json
from dataclasses import dataclass


class ProvenanceError(ValueError):
    """Finding rejected: ungrounded claims never enter memory."""


class StaleSnapshot(Exception):
    """A matched row changed between snapshot and apply; re-classify."""


@dataclass
class Candidate:
    title: str
    claim: str
    quote: str | None
    provenance: list[dict]
    confidence: float = 0.7


@dataclass
class Match:
    id: str
    title: str
    claim: str
    version: int
    similarity: float
    run_id: str | None = None


def vec(embedding: list[float]) -> str:
    return "[" + ",".join(f"{x:.6g}" for x in embedding) + "]"


def insert_finding(conn, run_id: str, cand: Candidate, embedding: list[float]) -> str:
    if not cand.provenance:
        raise ProvenanceError(f"finding {cand.title!r} has no provenance")
    row = conn.execute(
        """
        INSERT INTO findings (run_id, title, content, embedding, provenance, confidence)
        VALUES (%s, %s, %s, %s::VECTOR, %s, %s) RETURNING id
        """,
        (
            run_id,
            cand.title,
            json.dumps({"claim": cand.claim, "quote": cand.quote}),
            vec(embedding),
            json.dumps(cand.provenance),
            cand.confidence,
        ),
    ).fetchone()
    return str(row[0])


_INDEXED = """
    SELECT id, title, content->>'claim', version, 1 - (embedding <=> %s::VECTOR),
           invalidated_at
    FROM findings
    WHERE run_id = %s
    ORDER BY embedding <=> %s::VECTOR
    LIMIT %s
"""

_EXACT = """
    SELECT id, title, content->>'claim', version, 1 - (embedding <=> %s::VECTOR),
           invalidated_at
    FROM findings
    WHERE run_id = %s AND invalidated_at IS NULL
    ORDER BY embedding <=> %s::VECTOR
    LIMIT %s
"""


_COLONY_INDEXED = """
    SELECT id, title, content->>'claim', version, 1 - (embedding <=> %s::VECTOR),
           invalidated_at, run_id
    FROM findings
    ORDER BY embedding <=> %s::VECTOR
    LIMIT %s
"""

_COLONY_EXACT = """
    SELECT id, title, content->>'claim', version, 1 - (embedding <=> %s::VECTOR),
           invalidated_at, run_id
    FROM findings
    WHERE invalidated_at IS NULL
    ORDER BY embedding <=> %s::VECTOR
    LIMIT %s
"""


def recall_colony(pool, embedding: list[float], k: int = 5) -> list[Match]:
    """Nearest live findings across every run — the colony's whole memory.

    Same index-first shape as recall(): the liveness predicate would defeat the
    colony vector index too, so over-fetch, filter in Python, and fall back to the
    exact filtered query when the window saturates.
    """
    window = k * 4 + 20
    args = (vec(embedding), vec(embedding))
    with pool.connection() as conn:
        rows = conn.execute(_COLONY_INDEXED, (*args, window)).fetchall()
        live = [r for r in rows if r[5] is None]
        if len(live) < k and len(rows) >= window:
            live = conn.execute(_COLONY_EXACT, (*args, k)).fetchall()
    return [Match(str(r[0]), r[1], r[2] or "", r[3], float(r[4]), str(r[6])) for r in live[:k]]


def recall(pool, run_id: str, embedding: list[float], k: int = 5) -> list[Match]:
    """Nearest live findings for a run.

    A `WHERE invalidated_at IS NULL` predicate defeats the C-SPANN vector index — the
    planner drops to a full scan — so the fast path orders without it and filters
    retired rows afterwards, over-fetching to absorb the ones that crowd the window.

    Under heavy contention a fact can accumulate more retired ancestors than the
    window holds, which would hide the live row and let a duplicate be ADDed. So when
    the window comes back saturated and still short of k live rows, fall back to the
    exact filtered query: the index is a speed-up, never the thing correctness rests on.
    """
    window = k * 4 + 20
    args = (vec(embedding), run_id, vec(embedding))
    with pool.connection() as conn:
        rows = conn.execute(_INDEXED, (*args, window)).fetchall()
        live = [r for r in rows if r[5] is None]
        if len(live) < k and len(rows) >= window:
            live = conn.execute(_EXACT, (*args, k)).fetchall()
    return [Match(str(r[0]), r[1], r[2] or "", r[3], float(r[4]), run_id) for r in live[:k]]


def invalidate(conn, finding_id: str, superseded_by: str, expected_version: int) -> None:
    res = conn.execute(
        """
        UPDATE findings SET invalidated_at = now(), superseded_by = %s, version = version + 1
        WHERE id = %s AND invalidated_at IS NULL AND version = %s
        """,
        (superseded_by, finding_id, expected_version),
    )
    if res.rowcount != 1:
        raise StaleSnapshot(f"finding {finding_id} changed since snapshot")


def log_event(
    conn,
    run_id: str,
    op: str,
    candidate_title: str,
    target_id: str | None = None,
    new_id: str | None = None,
    reason: str | None = None,
) -> None:
    conn.execute(
        """
        INSERT INTO resolution_events (run_id, op, candidate_title, target_finding_id,
                                       new_finding_id, reason)
        VALUES (%s, %s, %s, %s, %s, %s)
        """,
        (run_id, op, candidate_title, target_id, new_id, reason),
    )


def ledger(pool, run_id: str) -> dict:
    with pool.connection() as conn:
        findings = conn.execute(
            """
            SELECT id, title, content, provenance, confidence, created_at,
                   invalidated_at, superseded_by
            FROM findings WHERE run_id = %s ORDER BY created_at
            """,
            (run_id,),
        ).fetchall()
        events = conn.execute(
            """
            SELECT id, op, candidate_title, target_finding_id, new_finding_id, reason, created_at
            FROM resolution_events WHERE run_id = %s ORDER BY created_at
            """,
            (run_id,),
        ).fetchall()
    return {
        "findings": [
            {
                "id": str(f[0]), "title": f[1], "content": f[2], "provenance": f[3],
                "confidence": f[4], "created_at": f[5].isoformat(),
                "invalidated_at": f[6].isoformat() if f[6] else None,
                "superseded_by": str(f[7]) if f[7] else None,
            }
            for f in findings
        ],
        "events": [
            {
                "id": str(e[0]), "op": e[1], "candidate_title": e[2],
                "target_finding_id": str(e[3]) if e[3] else None,
                "new_finding_id": str(e[4]) if e[4] else None,
                "reason": e[5], "created_at": e[6].isoformat(),
            }
            for e in events
        ],
    }
