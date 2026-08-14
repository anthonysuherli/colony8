"""Connection pool + schema bootstrap. CockroachDB speaks the Postgres wire protocol."""
from __future__ import annotations

import logging
from importlib import resources

from psycopg_pool import ConnectionPool

log = logging.getLogger(__name__)

# CockroachDB Distributed Vector Indexing (C-SPANN). Best-effort: correctness never
# depends on the index — recall falls back to a scan — but cloud clusters get it.
VECTOR_INDEX_SQL = "CREATE VECTOR INDEX IF NOT EXISTS findings_embedding_idx ON findings (embedding)"


def make_pool(conninfo: str) -> ConnectionPool:
    return ConnectionPool(conninfo, min_size=1, max_size=10, open=True)


def init_schema(pool: ConnectionPool) -> None:
    ddl = (resources.files("colony8.memory") / "schema.sql").read_text()
    with pool.connection() as conn:
        conn.execute(ddl)
    try:
        with pool.connection() as conn:
            conn.execute("SET CLUSTER SETTING feature.vector_index.enabled = true")
    except Exception:  # noqa: BLE001 — setting absent on newer versions where it's default-on
        pass
    try:
        with pool.connection() as conn:
            conn.execute(VECTOR_INDEX_SQL)
    except Exception as exc:  # noqa: BLE001 — local node may lack vector-index support
        log.warning("vector index not created (%s); recall will scan", exc)
