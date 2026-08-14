from __future__ import annotations

import uuid

import pytest

from colony8.memory.db import init_schema, make_pool

TEST_DB_URL = "postgresql://root@localhost:26257/defaultdb?sslmode=disable"


@pytest.fixture(scope="session")
def pool():
    p = make_pool(TEST_DB_URL)
    with p.connection() as conn:
        conn.execute("DROP TABLE IF EXISTS resolution_events, findings, runs CASCADE")
    init_schema(p)
    yield p
    p.close()


@pytest.fixture
def run_id(pool) -> str:
    rid = str(uuid.uuid4())
    with pool.connection() as conn:
        conn.execute(
            "INSERT INTO runs (id, question) VALUES (%s, %s)", (rid, "test question")
        )
    return rid


def fake_embed(text: str) -> list[float]:
    """Deterministic 1024-dim embedding: same topic prefix -> nearly identical vectors."""
    import hashlib

    def h(s: str) -> int:
        return int.from_bytes(hashlib.md5(s.encode()).digest()[:4], "big")

    v = [0.0] * 1024
    topic = h(text.split(":")[0]) % 1000  # everything before ':' is the topic bucket
    v[topic % 1024] = 1.0
    v[(topic + 7) % 1024] = 0.3
    salt = h(text) % 97
    v[1000 + salt % 24] = 0.05  # tiny per-text noise, cosine stays ~1 within a topic
    return v
