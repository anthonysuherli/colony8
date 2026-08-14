"""Micro-benchmark of the colony8 memory substrate.

Measures the transactional core only: LLM and embedding calls are excluded
(deterministic stub embeddings, rule-based classifier), so numbers reflect the
resolver + CockroachDB write/read paths. Run from the repo root against the
local dev node:  uv run python scripts/bench.py
"""
from __future__ import annotations

import hashlib
import statistics
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor

from colony8.config import get_settings
from colony8.memory.db import init_schema, make_pool
from colony8.memory.resolver import Decision, submit_finding
from colony8.memory.store import Candidate, recall

PROV = [{"url": "https://bench.local/source", "title": "bench source"}]
N_ADD = 200
N_RECALL = 200
THREADS = 8
PER_THREAD = 25


def embed(text: str) -> list[float]:
    def h(s: str) -> int:
        return int.from_bytes(hashlib.md5(s.encode()).digest()[:4], "big")

    v = [0.0] * 1024
    topic = h(text.split(":")[0]) % 1000
    v[topic % 1024] = 1.0
    v[(topic + 7) % 1024] = 0.3
    v[1000 + h(text) % 24] = 0.05
    return v


def cand(claim: str) -> Candidate:
    return Candidate(title=claim[:60], claim=claim, quote=None, provenance=PROV)


def pctl(xs: list[float], p: float) -> float:
    return statistics.quantiles(xs, n=100)[int(p) - 1]


def main() -> None:
    pool = make_pool(get_settings().database_url)
    init_schema(pool)
    rid = str(uuid.uuid4())
    with pool.connection() as conn:
        conn.execute("INSERT INTO runs (id, question) VALUES (%s, %s)", (rid, "bench"))

    never = lambda c, m: Decision(op="ADD")  # noqa: E731 — fast path never classifies

    # 1. sequential fast-path ADDs (unique topics -> no similar live finding)
    lat: list[float] = []
    t0 = time.perf_counter()
    for i in range(N_ADD):
        s = time.perf_counter()
        submit_finding(pool, rid, cand(f"t{i}: fact number {i}"), embed, never)
        lat.append((time.perf_counter() - s) * 1000)
    add_wall = time.perf_counter() - t0

    # 2. recalls against the now ~200-finding memory
    rlat: list[float] = []
    for i in range(N_RECALL):
        s = time.perf_counter()
        recall(pool, rid, embed(f"t{i % N_ADD}: query"), k=5)
        rlat.append((time.perf_counter() - s) * 1000)

    # 3. contended supersedes: 8 threads target the SAME topic simultaneously
    submit_finding(pool, rid, cand("pop: city population 1.0M"), embed, never)
    classify_calls = [0]
    lock = threading.Lock()

    def supersede(c: Candidate, matches):
        with lock:
            classify_calls[0] += 1
        return Decision(op="SUPERSEDE", target_id=matches[0].id, reason="bench: fresher")

    results: list[dict] = []
    t0 = time.perf_counter()
    with ThreadPoolExecutor(max_workers=THREADS) as ex:
        futs = [
            ex.submit(
                submit_finding, pool, rid,
                cand(f"pop: city population {1.0 + 0.01 * i:.2f}M"), embed, supersede,
            )
            for i in range(THREADS * PER_THREAD)
        ]
        results = [f.result() for f in futs]
    cont_wall = time.perf_counter() - t0

    n = THREADS * PER_THREAD
    deferred = sum(1 for r in results if r["op"] == "DEFERRED")
    with pool.connection() as conn:
        live = conn.execute(
            "SELECT count(*) FROM findings WHERE run_id=%s AND invalidated_at IS NULL "
            "AND title LIKE 'pop%%'", (rid,),
        ).fetchone()[0]
        total_pop = conn.execute(
            "SELECT count(*) FROM findings WHERE run_id=%s AND title LIKE 'pop%%'", (rid,),
        ).fetchone()[0]

    print("colony8 memory substrate — measured on a laptop, single-node in-memory CockroachDB")
    print("(LLM + embedding calls excluded: stub embeddings, rule classifier)\n")
    print(f"{'operation':<38}{'throughput':>14}{'p50':>9}{'p95':>9}")
    print("-" * 70)
    print(f"{'write, fast-path ADD (no conflict)':<38}"
          f"{N_ADD / add_wall:>10.0f} op/s{pctl(lat, 50):>7.1f}ms{pctl(lat, 95):>7.1f}ms")
    print(f"{'semantic recall, k=5 (~200 rows)':<38}"
          f"{N_RECALL / sum(rlat) * 1000:>10.0f} op/s{pctl(rlat, 50):>7.1f}ms{pctl(rlat, 95):>7.1f}ms")
    print(f"{'contended SUPERSEDE, 8 threads':<38}{n / cont_wall:>10.0f} op/s")
    print()
    lost = n - deferred - (total_pop - 1)  # every non-deferred candidate must have landed
    print(f"contention run: {n} conflicting writes -> {live} live fact, "
          f"{total_pop - live} retired with audit chains")
    print(f"serialization retries absorbed: {classify_calls[0] - n}   "
          f"lost writes: {lost if lost else 0}   deferred (parked, not dropped): {deferred}")
    pool.close()


if __name__ == "__main__":
    main()
