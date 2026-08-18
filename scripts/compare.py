"""Conflict convergence: colony8 against the resolution algorithms other memory
systems document.

Five arms write the SAME knowledge-updating sequence through the SAME CockroachDB
table, with the SAME stub embedder and the SAME op classifier. Only the resolution
algorithm differs:

    colony8      recall → classify → one SERIALIZABLE txn, FOR UPDATE + version fence,
                 SUPERSEDE retires the loser and keeps the chain
    Zep-style    bi-temporal: every claim carries an event time; a contradiction closes
                 the previous claim's validity window instead of deleting it, and
                 "current" means the live claim with the latest event time
    Mem0-style   an LLM verdict of ADD / UPDATE / DELETE / NOOP applied in place, with
                 no version fence and no history behind the row
    Letta-style  the memory block for a fact is rewritten by whoever writes last
    vector store append-only; nothing is resolved on write, the reader takes top-k and
                 prefers the most recent

── WHAT THIS IS NOT ──────────────────────────────────────────────────────────────────
No vendor code runs here. Mem0, Zep/Graphiti and Letta were NOT executed, and these are
not their scores. Each arm is *this repository's reimplementation of the resolution
algorithm those systems describe publicly*, run against our own store so that the
algorithm is the only variable.

Running the real products head-to-head would put their LLM in the loop, and the choice
of model moves the result more than the memory design does — the number would measure
the model. It would also fold in their retrieval and extraction quality, which is not
what this measures. Treat every row as "the published algorithm, reimplemented", and
read the shape breakdown rather than the aggregate.

    uv run python scripts/compare.py
"""
from __future__ import annotations

import hashlib
import json
import pathlib
import random
import statistics
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field

from psycopg.errors import SerializationFailure

from colony8.config import get_settings
from colony8.memory.db import init_schema, make_pool
from colony8.memory.resolver import Decision, submit_finding
from colony8.memory.store import Candidate, insert_finding, recall, vec

PROV = [{"url": "https://compare.local/source", "title": "compare source"}]
THREADS = 8
TOPK = 5
SEED = 8
# The dataset is replayed in ROUNDS independent key namespaces purely to widen the
# sample. Replays add rows, not new behaviour — the variety comes from the shapes.
ROUNDS = 2

# The 100-fact dataset lives in compare_facts.json. Its nine contradiction shapes are
# drawn from what these systems actually resolve:
#
#   corrected     a value is replaced once or twice — the ordinary case
#   deep          four to six successive revisions — convergence under a long chain
#   reasserted    a second source repeats the held value — must NOOP, not pile up
#   stable        never contradicted — the control
#   refinement    detail added without contradicting — an UPDATE, not a SUPERSEDE
#   retraction    a prior claim is explicitly withdrawn (Mem0's DELETE)
#   preference    a stated preference changes; the earlier one stays queryable
#   out_of_order  a claim about an EARLIER event arrives last. Only an arm that records
#                 event time separately from write time can get this right.
#   tie           two sources disagree with no ordering between them; by convention the
#                 more confident source is correct
DATASET = json.loads((pathlib.Path(__file__).parent / "compare_facts.json").read_text())

BASE_FACTS: dict[str, list[tuple[str, float]]] = {
    f["key"]: [(c, conf) for c, conf in f["revisions"]] for f in DATASET["facts"]
}
BASE_ANSWER: dict[str, str] = {f["key"]: f["answer"] for f in DATASET["facts"]}
BASE_SHAPE: dict[str, str] = {f["key"]: f["shape"] for f in DATASET["facts"]}
BASE_VALID: dict[str, list[int]] = {f["key"]: f["valid_at"] for f in DATASET["facts"]}
SHAPES: list[str] = list(dict.fromkeys(f["shape"] for f in DATASET["facts"]))

FACTS: dict[str, list[tuple[str, float]]] = {
    f"{key}{r}": revs for r in range(ROUNDS) for key, revs in BASE_FACTS.items()
}
CATEGORY_OF: dict[str, str] = {
    f"{key}{r}": shape for r in range(ROUNDS) for key, shape in BASE_SHAPE.items()
}
VALID_AT: dict[str, list[int]] = {
    f"{key}{r}": v for r in range(ROUNDS) for key, v in BASE_VALID.items()
}
# Ground truth is stated in the dataset, not inferred from write order: for the
# out_of_order and tie shapes the correct answer is deliberately not the last write.
GROUND_TRUTH: dict[str, str] = {
    f"{key}{r}": ans for r in range(ROUNDS) for key, ans in BASE_ANSWER.items()
}


def embed(text: str) -> list[float]:
    """Same stub as bench.py: the prefix before ':' is the topic bucket."""

    def h(s: str) -> int:
        return int.from_bytes(hashlib.md5(s.encode()).digest()[:4], "big")

    v = [0.0] * 1024
    topic = h(text.split(":")[0]) % 1000
    v[topic % 1024] = 1.0
    v[(topic + 7) % 1024] = 0.3
    v[1000 + h(text) % 24] = 0.05
    return v


@dataclass
class Write:
    key: str
    claim: str
    confidence: float
    revision: int

    @property
    def text(self) -> str:
        return f"{self.key}: {self.claim}"

    @property
    def valid_at(self) -> int:
        """Event time — when the claim was true, not when it was written."""
        return VALID_AT[self.key][self.revision]

    def candidate(self) -> Candidate:
        return Candidate(title=self.text[:60], claim=self.text, quote=None,
                         provenance=PROV, confidence=self.confidence)


def build_sequence() -> tuple[list[Write], list[Write]]:
    """(seed, revisions).

    The seed — revision 0 of each fact — is applied sequentially and is not measured.
    Racing the *creation* of a fact would score a different thing entirely: append-only
    designs never dedup, so they cannot lose that race, and colony8's one documented
    gap (two agents ADDing the same brand-new claim with no row yet to fence on) would
    swamp the contradiction handling this is meant to compare. Contradictions arrive
    concurrently; the facts they contradict already exist.
    """
    seed = [Write(k, revs[0][0], revs[0][1], 0) for k, revs in FACTS.items()]
    revisions = [
        Write(key, claim, conf, i)
        for key, revs in FACTS.items()
        for i, (claim, conf) in enumerate(revs)
        if i > 0
    ]
    random.Random(SEED).shuffle(revisions)
    # Ordered revisions must not overtake each other, or "latest" stops being defined
    # and the run would score write order instead of resolution strategy.
    revisions.sort(key=lambda w: w.revision)
    return seed, revisions


def classify(cand: Candidate, matches) -> Decision:
    """The op verdict, shared by every arm that has one.

    Mem0, Zep and colony8 all delegate this judgement to an LLM; giving each arm its own
    would compare prompts rather than architectures, so they share this rule version.
    It scans every match rather than trusting `matches[0]` — the resolver hands over the
    whole candidate set precisely so the classifier can pick its target, and reading only
    the nearest neighbour would make the verdict depend on stub-embedder hash ties.
    """
    key = cand.claim.split(":")[0]
    same_key = [m for m in matches if m.claim.split(":")[0] == key]
    if not same_key:
        return Decision(op="ADD", reason="new ground")
    target = same_key[0]
    if cand.claim.strip() == target.claim.strip():
        return Decision(op="NOOP", target_id=target.id, reason="already in memory")
    held = target.claim.split(": ", 1)[-1]
    if cand.claim.split(": ", 1)[-1].startswith(held):
        return Decision(op="UPDATE", target_id=target.id, reason="adds detail, no conflict")
    return Decision(op="SUPERSEDE", target_id=target.id, reason="revises the earlier value")


@dataclass
class Result:
    name: str
    note: str
    latencies: list[float] = field(default_factory=list)
    accepted: int = 0
    answers: dict[str, str] = field(default_factory=dict)
    live_rows: dict[str, int] = field(default_factory=dict)
    topk_stale: list[int] = field(default_factory=list)
    stale_by_key: dict[str, int] = field(default_factory=dict)
    values_present: dict[str, set[str]] = field(default_factory=dict)

    @property
    def accuracy(self) -> float:
        hits = sum(1 for k, want in GROUND_TRUTH.items() if self.answers.get(k) == want)
        return hits / len(GROUND_TRUTH)

    def accuracy_in(self, category: str) -> float:
        keys = [k for k in GROUND_TRUTH if CATEGORY_OF[k] == category]
        hits = sum(1 for k in keys if self.answers.get(k) == GROUND_TRUTH[k])
        return hits / len(keys)

    def stale_in(self, category: str) -> float:
        vals = [n for k, n in self.stale_by_key.items() if CATEGORY_OF[k] == category]
        return sum(vals) / len(vals) if vals else 0.0

    def rows_in(self, category: str) -> float:
        vals = [n for k, n in self.live_rows.items() if CATEGORY_OF[k] == category]
        return sum(vals) / len(vals) if vals else 0.0

    @property
    def lost(self) -> int:
        """Accepted writes whose value survives nowhere — not live, not retired."""
        return sum(
            len({c for c, _ in FACTS[k]} - self.values_present.get(k, set()))
            for k in FACTS
        )

    @property
    def contradictions(self) -> int:
        return sum(max(0, n - 1) for n in self.live_rows.values())


RUN_IDS: list[str] = []


def _new_run(pool, label: str) -> str:
    rid = str(uuid.uuid4())
    with pool.connection() as conn:
        conn.execute("INSERT INTO runs (id, question) VALUES (%s, %s)", (rid, label))
    RUN_IDS.append(rid)
    return rid


def _cleanup(pool) -> None:
    """Drop every row this harness wrote.

    Recall is colony-wide, so benchmark facts left behind would be injected into the
    context of real runs afterwards — thousands of "water boils at 90C" variants are
    not something a later fleet should inherit.
    """
    with pool.connection() as conn:
        for rid in RUN_IDS:
            conn.execute("DELETE FROM resolution_events WHERE run_id = %s", (rid,))
            conn.execute("DELETE FROM findings WHERE run_id = %s", (rid,))
            conn.execute("DELETE FROM runs WHERE id = %s", (rid,))


def _blind_retry(fn, attempts: int = 40) -> None:
    """Retry on SQLSTATE 40001 without re-reading anything.

    None of the other four designs is transactional; on the KV, vector and graph stores
    they sit on, these writes simply land. CockroachDB is SERIALIZABLE, so they need
    *some* retry to commit at all — this gives them the naive one (repeat the write,
    keep the stale snapshot), which is what a driver-level retry wrapper does. Re-reading
    here would be a version check, i.e. the very thing under comparison.
    """
    for i in range(attempts):
        try:
            fn()
            return
        except SerializationFailure:
            time.sleep(random.uniform(0.005, 0.02) * (i + 1))
    raise RuntimeError("baseline could not commit within retry budget")


def _drive(seq: list[Write], fn) -> list[float]:
    """Run the sequence through `fn` on THREADS workers, returning per-write latencies."""
    def timed(w: Write) -> float:
        s = time.perf_counter()
        fn(w)
        return (time.perf_counter() - s) * 1000

    with ThreadPoolExecutor(max_workers=THREADS) as ex:
        return list(ex.map(timed, seq))


def _stale_in_context(pool, rid: str, key: str) -> int:
    """Rows of THIS key in the top-k that are not its current value.

    Neighbours belonging to other facts are not pollution — they are simply other
    facts — so they are excluded. What counts is being handed two answers to one
    question and having to work out which one is live.
    """
    hits = recall(pool, rid, embed(f"{key}: query"), k=TOPK)
    return sum(
        1 for m in hits
        if m.claim.split(":")[0] == key and m.claim.split(": ", 1)[1] != GROUND_TRUTH[key]
    )


def _score(pool, rid: str, r: Result, answer_of, live_only: bool) -> None:
    """Fill in answers, live-row counts, surviving values and context purity."""
    where = "AND invalidated_at IS NULL" if live_only else ""
    with pool.connection() as conn:
        for key in FACTS:
            rows = conn.execute(
                f"SELECT content, confidence, created_at, invalidated_at FROM findings "
                f"WHERE run_id=%s AND title LIKE %s {where}",
                (rid, f"{key}:%"),
            ).fetchall()
            allrows = conn.execute(
                "SELECT content->>'claim' FROM findings WHERE run_id=%s AND title LIKE %s",
                (rid, f"{key}:%"),
            ).fetchall()
            r.live_rows[key] = len(rows)
            r.values_present[key] = {c.split(": ", 1)[1] for (c,) in allrows}
            r.answers[key] = answer_of(rows)
            stale = _stale_in_context(pool, rid, key)
            r.topk_stale.append(stale)
            r.stale_by_key[key] = stale


def _claim(content: dict) -> str:
    return content["claim"].split(": ", 1)[1]


# ── the arms ─────────────────────────────────────────────────────────────────────────

def run_colony8(pool, seed: list[Write], seq: list[Write]) -> Result:
    """colony8: recall → classify → one SERIALIZABLE txn, FOR UPDATE + version fence."""
    rid = _new_run(pool, "compare: colony8")
    r = Result("colony8 · write-time, fenced", "SERIALIZABLE + supersede chain")

    def apply(w: Write) -> None:
        submit_finding(pool, rid, w.candidate(), embed, classify)

    for w in seed:
        apply(w)
    r.latencies = _drive(seq, apply)
    r.accepted = len(seed) + len(seq)

    def answer(rows) -> str:
        return _claim(rows[0][0]) if len(rows) == 1 else "<ambiguous>"

    _score(pool, rid, r, answer, live_only=True)
    return r


def run_zep(pool, seed: list[Write], seq: list[Write]) -> Result:
    """Zep/Graphiti-style bi-temporal invalidation.

    Graphiti gives every fact a validity window and, on detecting a contradiction,
    closes the previous fact's window (`invalid_at`) and opens a new one rather than
    deleting anything — so history stays queryable and "what was true on date X" is
    answerable. The event time therefore, not the write order, decides what is current.

    Our schema has no validity column, so the event time rides in the content JSON;
    that is precisely the structural difference this arm exists to show. There is no
    version fence: Graphiti applies its edge resolution deterministically, prioritising
    new information on the ingestion timeline.
    """
    rid = _new_run(pool, "compare: zep-style bi-temporal")
    r = Result("Zep/Graphiti-style · bi-temporal", "validity windows, event time")

    def write(w: Write) -> None:
        matches = recall(pool, rid, embed(w.text), k=TOPK)
        same_key = [m for m in matches if m.claim.split(":")[0] == w.key]
        decision = classify(w.candidate(), matches)
        held_valid = None
        if same_key:
            with pool.connection() as conn:
                got = conn.execute(
                    "SELECT content->>'valid_at' FROM findings WHERE id = %s",
                    (same_key[0].id,),
                ).fetchone()
            held_valid = int(got[0]) if got and got[0] is not None else 0

        def once() -> None:
            with pool.connection() as conn, conn.transaction():
                if decision.op == "NOOP":
                    return
                # Graphiti dates the invalidation from the NEW fact's event time. A claim
                # about an earlier event therefore does not unseat a later one — it is
                # filed with its window already closed, and the newer fact stays current.
                superseded = same_key and w.valid_at > held_valid
                historical = same_key and w.valid_at <= held_valid
                row = conn.execute(
                    "INSERT INTO findings (run_id, title, content, embedding, provenance,"
                    " confidence) VALUES (%s,%s,%s,%s::VECTOR,%s,%s) RETURNING id",
                    (rid, w.text[:60],
                     json.dumps({"claim": w.text, "quote": None, "valid_at": w.valid_at}),
                     vec(embed(w.text)), json.dumps(PROV), w.confidence),
                ).fetchone()
                if historical:
                    conn.execute(
                        "UPDATE findings SET invalidated_at = now(), superseded_by = %s "
                        "WHERE id = %s", (same_key[0].id, row[0]),
                    )
                elif superseded:
                    # Close the previous window; nothing is deleted.
                    conn.execute(
                        "UPDATE findings SET invalidated_at = now(), superseded_by = %s "
                        "WHERE id = %s AND invalidated_at IS NULL",
                        (row[0], same_key[0].id),
                    )

        _blind_retry(once)

    for w in seed:
        write(w)
    r.latencies = _drive(seq, write)
    r.accepted = len(seed) + len(seq)

    def answer(rows) -> str:
        # "Current" = the live claim with the latest EVENT time, not the latest write.
        if not rows:
            return ""
        best = max(rows, key=lambda t: (t[0].get("valid_at", 0), t[2]))
        return _claim(best[0])

    _score(pool, rid, r, answer, live_only=True)
    return r


def run_mem0(pool, seed: list[Write], seq: list[Write]) -> Result:
    """Mem0-style ADD / UPDATE / DELETE / NOOP applied in place.

    Mem0 retrieves similar memories, asks an LLM which of the four operations applies,
    and mutates the stored memory accordingly. UPDATE rewrites the memory's text in
    place and DELETE marks it removed, so the prior wording is not retained as its own
    retrievable row. There is no version fence across concurrent writers.
    """
    rid = _new_run(pool, "compare: mem0-style in-place ops")
    r = Result("Mem0-style · LLM op, in place", "ADD/UPDATE/DELETE/NOOP, unfenced")

    def write(w: Write) -> None:
        matches = recall(pool, rid, embed(w.text), k=TOPK)
        decision = classify(w.candidate(), matches)
        same_key = [m for m in matches if m.claim.split(":")[0] == w.key]

        def once() -> None:
            with pool.connection() as conn, conn.transaction():
                if decision.op == "NOOP":
                    return
                if not same_key:
                    insert_finding(conn, rid, w.candidate(), embed(w.text))
                    return
                conn.execute(
                    "UPDATE findings SET content=%s, confidence=%s, embedding=%s::VECTOR "
                    "WHERE id=%s",
                    (json.dumps({"claim": w.text, "quote": None}), w.confidence,
                     vec(embed(w.text)), same_key[0].id),
                )

        _blind_retry(once)

    for w in seed:
        write(w)
    r.latencies = _drive(seq, write)
    r.accepted = len(seed) + len(seq)

    def answer(rows) -> str:
        return _claim(rows[0][0]) if len(rows) == 1 else "<ambiguous>"

    _score(pool, rid, r, answer, live_only=True)
    return r


def run_letta(pool, seed: list[Write], seq: list[Write]) -> Result:
    """Letta/MemGPT-style memory-block rewrite.

    A Letta agent edits its own memory block through tool calls: it reads the block and
    writes back a new version. Blocks can be shared between agents, and nothing arbitrates
    two agents rewriting the same block — the last writer's version is what remains, with
    no record of what it replaced. No op classifier: the agent simply rewrites.
    """
    rid = _new_run(pool, "compare: letta-style block rewrite")
    r = Result("Letta-style · block rewrite", "last writer wins, no history")

    def write(w: Write) -> None:
        # The block is read once; a retry re-applies that same stale read, which is how
        # two agents editing one block lose each other's edits.
        matches = recall(pool, rid, embed(w.text), k=1)
        same_key = [m for m in matches if m.claim.split(":")[0] == w.key]

        def once() -> None:
            with pool.connection() as conn, conn.transaction():
                if not same_key:
                    insert_finding(conn, rid, w.candidate(), embed(w.text))
                    return
                conn.execute(
                    "UPDATE findings SET content=%s, confidence=%s, embedding=%s::VECTOR "
                    "WHERE id=%s",
                    (json.dumps({"claim": w.text, "quote": None}), w.confidence,
                     vec(embed(w.text)), same_key[0].id),
                )

        _blind_retry(once)

    for w in seed:
        write(w)
    r.latencies = _drive(seq, write)
    r.accepted = len(seed) + len(seq)

    def answer(rows) -> str:
        return _claim(rows[0][0]) if len(rows) == 1 else "<ambiguous>"

    _score(pool, rid, r, answer, live_only=True)
    return r


def run_vector(pool, seed: list[Write], seq: list[Write]) -> Result:
    """Plain vector store: nothing is resolved on write.

    The default shape of retrieval-augmented memory — every extracted claim is embedded
    and appended, and the reader gets top-k by similarity and works out which is current.
    Ranking here prefers the most recently written, the friendliest policy for it.
    """
    rid = _new_run(pool, "compare: append-only vector store")
    r = Result("Vector store · append-only", "resolved by the reader, top-k")

    def write(w: Write) -> None:
        def once() -> None:
            with pool.connection() as conn, conn.transaction():
                insert_finding(conn, rid, w.candidate(), embed(w.text))

        _blind_retry(once)

    for w in seed:
        write(w)
    r.latencies = _drive(seq, write)
    r.accepted = len(seed) + len(seq)

    def answer(rows) -> str:
        if not rows:
            return ""
        return _claim(max(rows, key=lambda t: t[2])[0])

    _score(pool, rid, r, answer, live_only=False)
    return r


def pctl(xs: list[float], p: float) -> float:
    return statistics.quantiles(xs, n=100)[int(p) - 1]


def main() -> None:
    pool = make_pool(get_settings().database_url)
    init_schema(pool)
    seed, seq = build_sequence()

    results = [
        run_colony8(pool, seed, seq),
        run_zep(pool, seed, seq),
        run_mem0(pool, seed, seq),
        run_letta(pool, seed, seq),
        run_vector(pool, seed, seq),
    ]

    n_keys, n_writes = len(FACTS), len(seq)
    print(f"conflict convergence — {n_writes} writes revising {n_keys} facts, "
          f"{THREADS} concurrent writers")
    print("NOT a product benchmark: no vendor code was run. Each row is this repo's "
          "reimplementation of")
    print("the resolution algorithm that system documents, against one shared store, so "
          "the algorithm is the\nonly variable.\n")

    head = f"{'resolution algorithm':<34}{'final answer':>14}{'stale in top-5':>16}{'lost':>7}{'p50 write':>11}"
    print(head)
    print("-" * len(head))
    for r in results:
        stale = sum(r.topk_stale) / max(1, len(r.topk_stale))
        print(f"{r.name:<34}{r.accuracy * 100:>13.0f}%{stale:>15.1f}{r.lost:>7}"
              f"{pctl(r.latencies, 50):>9.1f}ms")

    print("\nby contradiction shape — accuracy / stale rows in context / live rows per fact")
    cats = SHAPES
    print(f"{'resolution algorithm':<34}" + "".join(f"{c:>21}" for c in cats))
    print("-" * (34 + 21 * len(cats)))
    for r in results:
        cells = "".join(
            f"{r.accuracy_in(c) * 100:>10.0f}% {r.stale_in(c):>4.1f} {r.rows_in(c):>4.1f}"
            for c in cats
        )
        print(f"{r.name:<34}{cells}")
    counts = {c: sum(1 for k in FACTS if CATEGORY_OF[k] == c) for c in cats}
    print("  facts per shape: " + ", ".join(f"{c} {n}" for c, n in counts.items()))

    print("\nwhat each column means")
    print(f"  final answer    share of the {n_keys} facts whose current value the memory "
          f"returns")
    print("  stale in top-5  same-fact rows retrieved that are NOT the current value —")
    print("                  contradictions the reader has to resolve, every query")
    print("  lost            values that survive nowhere, live or retired")
    print("  p50 write       write-path cost; resolving at write time is not free\n")

    c8, zep, mem0, letta, vec_ = results
    print("reading this honestly")
    print(f"  · Zep-style bi-temporal beats colony8 on out-of-order arrivals "
          f"({zep.accuracy_in('out_of_order') * 100:.0f}% against "
          f"{c8.accuracy_in('out_of_order') * 100:.0f}%), because it records when a")
    print("    claim was true separately from when it was written. Our schema has no such "
          "column. That is a real gap.")
    print(f"  · colony8 loses nothing ({c8.lost}); Mem0-style loses {mem0.lost} and "
          f"Letta-style {letta.lost} values, because updating a")
    print("    memory in place leaves no trace of what it replaced — dropped writes and "
          "writes that never happened look alike.")
    print(f"  · The append-only vector store answers {vec_.accuracy * 100:.0f}% but hands "
          f"the reader {sum(vec_.topk_stale) / len(vec_.topk_stale):.1f} stale rows per "
          f"query")
    print(f"    ({vec_.rows_in('deep'):.1f} live rows per fact on deep chains, against "
          f"{c8.rows_in('deep'):.1f}); the disambiguation is deferred, not avoided.")
    print(f"  · Ties defeat every arm here ({', '.join(f'{r.accuracy_in('tie') * 100:.0f}%' for r in results)}): "
          f"two sources disagreeing with no ordering")
    print("    need source authority, which none of these schemas records.")
    print(f"  · The bill: {pctl(c8.latencies, 50) / pctl(vec_.latencies, 50):.1f}× the "
          f"write latency of appending blindly.")
    _cleanup(pool)
    pool.close()


if __name__ == "__main__":
    main()
