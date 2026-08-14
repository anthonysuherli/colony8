from __future__ import annotations

import pytest

from colony8.memory.store import Candidate, ProvenanceError, insert_finding, recall
from tests.conftest import fake_embed

PROV = [{"url": "https://example.com/a", "title": "Source A"}]


def _cand(claim: str) -> Candidate:
    return Candidate(title=claim[:60], claim=claim, quote=None, provenance=PROV)


def test_insert_and_recall(pool, run_id) -> None:
    emb = fake_embed("boiling: water boils at 100C at sea level")
    with pool.connection() as conn:
        fid = insert_finding(conn, run_id, _cand("boiling: water boils at 100C"), emb)
    assert fid
    matches = recall(pool, run_id, fake_embed("boiling: what temp does water boil"), k=5)
    assert matches and matches[0].id == fid
    assert matches[0].similarity > 0.8


def test_provenance_gate(pool, run_id) -> None:
    bad = Candidate(title="t", claim="c", quote=None, provenance=[])
    with pool.connection() as conn, pytest.raises(ProvenanceError):
        insert_finding(conn, run_id, bad, fake_embed("x: y"))


def test_recall_excludes_invalidated(pool, run_id) -> None:
    from colony8.memory.store import invalidate

    emb = fake_embed("freezing: water freezes at 0C")
    with pool.connection() as conn:
        old = insert_finding(conn, run_id, _cand("freezing: water freezes at 0C"), emb)
        new = insert_finding(conn, run_id, _cand("freezing: pure water freezes at 0C"), emb)
        invalidate(conn, old, superseded_by=new, expected_version=1)
    ids = [m.id for m in recall(pool, run_id, emb, k=10)]
    assert old not in ids and new in ids
