from __future__ import annotations

from colony8.agents import audit


def test_audit_writes_health(pool, run_id, monkeypatch) -> None:
    monkeypatch.setattr(audit, "_mcp_sql", lambda queries: {
        "live_findings": 5, "superseded": 2, "supersede_events": 2, "deferred": 0,
    })
    monkeypatch.setattr(audit, "llm_json", lambda p, s, **kw: {
        "narrative": "Memory is consistent: 5 live findings, 2 superseded, no deferred work."
    })
    monkeypatch.setattr(audit, "_token_present", lambda: True)
    out = audit.audit_memory(pool, run_id)
    assert out and "narrative" in out
    with pool.connection() as conn:
        row = conn.execute("SELECT health FROM runs WHERE id = %s", (run_id,)).fetchone()
    assert row[0]["live_findings"] == 5


def test_audit_skips_without_token(pool, run_id, monkeypatch) -> None:
    monkeypatch.setattr(audit, "_token_present", lambda: False)
    assert audit.audit_memory(pool, run_id) is None


def test_audit_never_raises_on_llm_failure(pool, run_id, monkeypatch) -> None:
    monkeypatch.setattr(audit, "_token_present", lambda: True)
    monkeypatch.setattr(audit, "_mcp_sql", lambda q: {"live_findings": 1, "superseded": 0})
    def boom(*a, **kw):
        raise RuntimeError("bedrock down")
    monkeypatch.setattr(audit, "llm_json", boom)
    assert audit.audit_memory(pool, run_id) is None
