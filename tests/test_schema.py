from __future__ import annotations


def test_tables_exist(pool) -> None:
    with pool.connection() as conn:
        rows = conn.execute(
            "SELECT table_name FROM information_schema.tables WHERE table_name IN "
            "('runs','findings','resolution_events')"
        ).fetchall()
    assert len(rows) == 3


def test_init_schema_idempotent(pool) -> None:
    from colony8.memory.db import init_schema

    init_schema(pool)  # second run must not raise
