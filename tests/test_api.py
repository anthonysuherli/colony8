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


def test_launch_disabled_and_bad_run_id(pool, monkeypatch) -> None:
    from colony8.api import app as app_module
    from colony8.config import Settings

    monkeypatch.setattr(app_module, "_pool", pool)
    monkeypatch.setattr(app_module, "get_settings", lambda: Settings(allow_launch=False))
    client = TestClient(app_module.app)
    assert client.post("/runs", json={"question": "x"}).status_code == 403
    assert client.get("/runs/not-a-uuid").status_code == 404
    assert client.get("/runs/not-a-uuid/ledger").status_code == 404
