"""HTTP surface. The UI only ever polls the ledger; the memory does the talking."""
from __future__ import annotations

import threading
import uuid

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum
from pydantic import BaseModel

from colony8.agents.orchestrator import run_fleet
from colony8.config import get_settings
from colony8.memory.db import init_schema, make_pool
from colony8.memory.store import ledger

app = FastAPI(title="colony8")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

_pool = None


def pool():
    global _pool
    if _pool is None:
        _pool = make_pool(get_settings().database_url)
        init_schema(_pool)
    return _pool


class RunRequest(BaseModel):
    question: str


@app.post("/runs")
def create_run(req: RunRequest) -> dict:
    rid = str(uuid.uuid4())
    with pool().connection() as conn:
        conn.execute("INSERT INTO runs (id, question) VALUES (%s, %s)", (rid, req.question))
    t = threading.Thread(target=run_fleet, args=(pool(), rid, req.question), daemon=True)
    t.start()
    return {"run_id": rid}


@app.get("/runs/{run_id}")
def get_run(run_id: str) -> dict:
    with pool().connection() as conn:
        row = conn.execute(
            "SELECT id, question, status, health, created_at FROM runs WHERE id = %s", (run_id,)
        ).fetchone()
    if not row:
        raise HTTPException(404)
    return {"id": str(row[0]), "question": row[1], "status": row[2], "health": row[3],
            "created_at": row[4].isoformat()}


@app.get("/runs/{run_id}/ledger")
def get_ledger(run_id: str) -> dict:
    return ledger(pool(), run_id)


handler = Mangum(app)
