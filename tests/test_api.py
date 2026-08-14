from __future__ import annotations

from fastapi.testclient import TestClient


def test_run_lifecycle(pool, monkeypatch) -> None:
    from colony8.api import app as app_module

    monkeypatch.setattr(app_module, "_pool", pool)

    # stub the fleet so the API test needs no Bedrock
    def _stub_fleet(p, rid, q, **kw):
        with p.connection() as conn:
            conn.execute("UPDATE runs SET status='completed' WHERE id=%s", (rid,))

    monkeypatch.setattr(app_module, "run_fleet", _stub_fleet)
    client = TestClient(app_module.app)

    r = client.post("/runs", json={"question": "test?"})
    assert r.status_code == 200
    rid = r.json()["run_id"]

    r2 = client.get(f"/runs/{rid}")
    assert r2.status_code == 200 and r2.json()["question"] == "test?"

    r3 = client.get(f"/runs/{rid}/ledger")
    assert r3.status_code == 200 and "findings" in r3.json() and "events" in r3.json()
