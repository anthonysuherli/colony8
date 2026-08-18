"""Connection pool + schema bootstrap. CockroachDB speaks the Postgres wire protocol."""
from __future__ import annotations

import logging
from importlib import resources

from psycopg_pool import ConnectionPool

from colony8.config import get_settings

log = logging.getLogger(__name__)

# CockroachDB Distributed Vector Indexing (C-SPANN). The opclass must match the
# operator recall() orders by (`<=>`, cosine) or the planner silently falls back
# to a full scan.
VECTOR_INDEX_SQL = (
    "CREATE VECTOR INDEX IF NOT EXISTS findings_embedding_idx "
    "ON findings (run_id, embedding vector_cosine_ops)"
)

# The run_id prefix above fences that index to one run; colony-wide recall needs an
# unprefixed twin or the planner falls back to a full scan.
COLONY_VECTOR_INDEX_SQL = (
    "CREATE VECTOR INDEX IF NOT EXISTS findings_embedding_colony_idx "
    "ON findings (embedding vector_cosine_ops)"
)


def make_pool(conninfo: str, max_size: int | None = None) -> ConnectionPool:
    # Every researcher thread holds a connection for its snapshot and again for its
    # apply, so the pool has to outgrow the fleet or the fan-out deadlocks on getconn.
    size = max_size or max(10, get_settings().fleet_size * 2 + 4)
    return ConnectionPool(conninfo, min_size=1, max_size=size, open=True)


def _assert_embedding_width(pool: ConnectionPool, dim: int) -> None:
    """A width mismatch fails every INSERT one row at a time; fail loudly up front."""
    with pool.connection() as conn:
        row = conn.execute(
            "SELECT crdb_sql_type FROM information_schema.columns "
            "WHERE table_name = 'findings' AND column_name = 'embedding'"
        ).fetchone()
    if row and (actual := row[0]) != f"VECTOR({dim})":
        raise RuntimeError(
            f"findings.embedding is {actual} but EMBED_DIM={dim}. The table already "
            f"exists at the old width — drop it or set EMBED_DIM to match."
        )


def init_schema(pool: ConnectionPool) -> None:
    dim = get_settings().embed_dim
    ddl = (resources.files("colony8.memory") / "schema.sql").read_text()
    with pool.connection() as conn:
        conn.execute(ddl.replace("__EMBED_DIM__", str(dim)))
    _assert_embedding_width(pool, dim)
    try:
        with pool.connection() as conn:
            conn.execute("SET CLUSTER SETTING feature.vector_index.enabled = true")
    except Exception as exc:  # noqa: BLE001 — setting absent on newer versions, default-on there
        log.debug("cluster setting skipped: %s", exc)
    for index_sql in (VECTOR_INDEX_SQL, COLONY_VECTOR_INDEX_SQL):
        try:
            with pool.connection() as conn:
                conn.execute(index_sql)
        except Exception as exc:  # noqa: BLE001 — local node may lack vector-index support
            log.warning("vector index not created (%s); recall will scan", exc)
