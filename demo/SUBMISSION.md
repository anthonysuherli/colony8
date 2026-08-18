# Devpost submission — due 2026-08-18 5:00pm EDT (submit by 2:00pm)

## Checklist

- [x] Repo public at github.com/anthonysuherli/colony8, MIT license visible
- [x] Architecture diagram in the README (`docs/architecture.svg`)
- [x] Video under 3:00 showing the working app + the memory layer in action (2:39)
- [x] `DISCLOSURES.md` written and linked from the README
- [x] About the project drafted (below) — diagrams, tables, honest benchmark
- [x] Tool identification drafted (below)
- [ ] **Video uploaded to YouTube as public/unlisted** — paste URL below and in the README
- [x] **Demo URL live (CloudFront) and loading a populated ledger** — 2026-08-17, see below
- [ ] Devpost form submitted

## Links to fill in

| Field | Value |
|---|---|
| Repo | https://github.com/anthonysuherli/colony8 |
| Video | _paste YouTube URL_ |
| Demo | https://d70tlsfhdj221.cloudfront.net/?run=3afd8685-a815-4d81-b094-50455dda5ded |

Deployed 2026-08-17: UI on S3+CloudFront (`d70tlsfhdj221.cloudfront.net`), API on
Lambda behind API Gateway (`https://3op5p08fy1.execute-api.us-east-1.amazonaws.com`,
replay-only — `POST /runs` 403s), memory on CockroachDB Cloud (`dread-opossum-32297`).
Two populated runs, both `completed`:

- `3afd8685-a815-4d81-b094-50455dda5ded` — "What are the key thermal properties of
  water?" — the supersede story (SUPERSEDE×1, ADD×7, UPDATE×3, NOOP×7); matches the video.
- `ddb06ee2-470f-4f07-b7bb-6f0d16d81728` — "How does altitude change boiling and
  cooking times?" — the cross-session story (INJECT×3 pulling session-1 claims in).

Models: `us.amazon.nova-pro-v1:0` via the Bedrock Converse API + Titan v2 embeddings.
(The account's Anthropic use-case form is pending; any Claude id drops in via
`BEDROCK_MODEL_ID` once approved.) Lambda Function URLs returned 403 on this account,
so API Gateway HTTP API fronts the Lambda instead.

---

## About the project (paste into Devpost — replaces the old text description)

**colony8 — transactional shared memory for multi-agent fleets**

One sentence: colony8 gives a fleet of stateless AI agents a single CockroachDB memory
where every write is resolved inside a serializable transaction — so no agent can ever
act on a stale or contradictory copy of shared state.

### Inspiration

37% of multi-agent system failures trace to inconsistent shared state (Cemri et al.,
summarized by O'Reilly, 2025). One agent writes, another reads a snapshot that is
already wrong, and both keep going. Databases solved this class of bug decades ago;
agent frameworks mostly re-invented in-memory caches instead. We wanted to see what
happens when agent memory is treated as what it actually is: a concurrency problem.

### What it does

Stateless agents on Amazon Bedrock — a planner and N researchers — share exactly one
memory. Every candidate finding walks the same pipeline before it can land:

```
candidate ──► 1 SNAPSHOT ────────► 2 CLASSIFY ─────────► 3 APPLY
              vector recall,        Claude verdict:        one SERIALIZABLE txn
              no lock held          ADD · UPDATE ·         SELECT ... FOR UPDATE
                  ▲                 NOOP · SUPERSEDE       + version fence
                  │                                            │
                  └── re-snapshot, re-classify ◄── version drift / SQLSTATE 40001
                                                               │
                              retries exhausted ──► DEFERRED (parked, never dropped)
```

`SUPERSEDE` never deletes: the losing claim is retired with `invalidated_at` and
`superseded_by` set, so the full contradiction chain behind every live fact stays
queryable forever.

Memory also outlives the process. When a new session asks a related question, the
colony's live claims are injected into its researchers' context before they touch a
single source — recorded on the ledger as an auditable `INJECT` event:

```
 session 1 · "thermal properties?"          session 2 · "cooking at altitude?"
 planner + 3 researchers                    new process, new fleet
       │ writes · 90C SUPERSEDED by NIST          ▲
       ▼                                          │ INJECT · prior claims enter
 ┌────────────────── one memory ─────────────┐    │ researcher context; nothing
 │  CockroachDB · SERIALIZABLE · chains kept │────┘ is re-learned
 └───────────────────────────────────────────┘
```

The 2:39 video shows all of it live: the 90C claim struck through on screen as NIST
lands, the backend killed and restarted with nothing lost, and a brand-new session
inheriting the colony's knowledge at the exact moment it becomes relevant.

### How we built it

CockroachDB carries the whole memory: two C-SPANN vector indexes (one run-scoped for
the write path, one colony-wide for cross-session recall), serializable transactions
for the resolver, and the Cloud Managed MCP Server as the *only* access path for the
memory-audit agent. Bedrock runs the planner, researchers, the op classifier and audit
narration on Claude, with Titan v2 embeddings. The API ships as a Lambda container
image; the ledger UI is React on S3 + CloudFront; `ccloud` scripts the provisioning.

### The numbers

Substrate (laptop, single-node CockroachDB; LLM calls excluded):

| operation | throughput | p50 | p95 |
|---|---|---|---|
| write, fast-path ADD | ~135 op/s | 7.6 ms | 8.3 ms |
| semantic recall, k=5 | ~395 op/s | 2.3 ms | 3.7 ms |
| 200 conflicting writes, 8 threads | converge to **1 live fact · 0 lost writes** | | |

Then we benchmarked the *design decision* — 246 contradicting writes over 100 facts in
nine contradiction shapes, against reimplementations of the resolution algorithms
Zep/Graphiti, Mem0 and Letta document publicly (same store, embedder, classifier; no
vendor code run — these are not their products' scores):

| resolution algorithm | final answer | stale rows in context | values lost |
|---|---|---|---|
| Zep/Graphiti-style · bi-temporal | **94%** | 0.1 | 0 |
| **colony8 · write-time, fenced** | 88% | 0.1 | **0** |
| Mem0-style · in-place ops | 88% | 0.1 | 222 |
| vector store · append-only | 88% | 1.1 | 0 |
| Letta/MemGPT-style · block rewrite | 79% | 0.2 | 198 |

**colony8 does not win this table, and we shipped it anyway.** Zep's bi-temporal model
records when a fact was *true*, not just when it was written, and that single
capability is the entire 6-point gap. A memory layer that hides its failure modes is
the thing this project argues against.

### Challenges we ran into

- **CockroachDB's vector index can be silently decorative.** The wrong opclass, or any
  `WHERE` predicate on the ordering query, drops you to a full scan with no warning —
  `EXPLAIN` is the only witness. We rebuilt recall as index-first with an exact
  filtered fallback so correctness never depends on the index.
- **Our own benchmark lied to us three times** — a seeding race, a nearest-neighbour
  classifier artifact, accidentally monotonic confidences — before a control group of
  never-contradicted facts (where every algorithm must score identically) pinned it.
- **Shared memory makes test hygiene a correctness concern**: once recall spans every
  run, leftover benchmark facts get injected into real sessions. The harness had to
  become self-cleaning.

### Accomplishments we're proud of

The race is not hand-waved: `test_concurrent_contradiction` and the bench run live in
the video — 200 conflicting writes converge to one live fact with zero lost writes and
every loser auditable. And the comparison table above includes the row where a
competing design beats us, with the reason and the fix on the roadmap.

### What we learned

Write-time resolution does not buy accuracy — recency ranking matches our 88%. What it
buys is everything *around* the answer: 0.1 stale rows per retrieved context instead of
1.1, one live row per fact instead of four, zero lost values instead of ~200, and an
audit chain. The most useful benchmark was the one we lost.

### What's next

1. **Bi-temporal facts** — `valid_at`/`invalid_at` on `findings`, event time deciding
   what is current. Closes the measured 6-point gap; the supersede chain already has
   the right shape.
2. **Source authority for ties** — two disagreeing sources with no ordering defeat
   every algorithm we tested (0% across the board).
3. **Fence concurrent creation** of brand-new near-identical claims.
4. **A credentialed head-to-head** — run Mem0 and Zep as themselves with a pinned
   embedder, reporting Recall@10 alongside the resolution metrics.

## Tool identification (paste into Devpost)

- **CockroachDB Distributed Vector Indexing** — two C-SPANN indexes
  (`vector_cosine_ops`): a run-prefixed `findings_embedding_idx` serves the semantic
  recall that runs before *every* write and feeds candidate matches to the resolver,
  and an unprefixed `findings_embedding_colony_idx` serves the colony-wide recall
  that injects prior sessions' claims into new researchers. `EXPLAIN` on the shipped
  query shows `• vector search` against the index.
- **CockroachDB Cloud Managed MCP Server** — the memory-audit agent's only access
  path. It introspects the fleet's own memory over read-only SQL via MCP and produces
  the health panel (contradiction rate, supersede counts) shown in the UI.
- **ccloud CLI** — `scripts/provision_cloud.sh` creates the free-tier cluster and SQL
  user and prints the connection string, so provisioning is scripted and repeatable.
- **Amazon Bedrock** — Claude (via the Mantle endpoint) for the planner, the
  researchers, the ADD/UPDATE/NOOP/SUPERSEDE classifier and the audit narration;
  Titan Text Embeddings v2 for the vectors the index stores.
- **AWS Lambda** — container-image runtime for the FastAPI surface and ledger replay.
- **Amazon S3 + CloudFront** — static hosting and CDN for the React ledger UI.

## Feedback on tools (optional Devpost field)

Vector indexing was the sharpest edge. An index created with the default opclass is
silently ignored by a query ordering on `<=>` — no error, no warning, just a full
scan — and adding an ordinary `WHERE` predicate to the ordering query defeats it the
same silent way. `EXPLAIN` is the only way to find out, so it is worth checking for
`• vector search` in the plan rather than assuming the index is doing work. The
Managed MCP Server was the opposite experience: pointing an agent at it and getting
read-only SQL introspection took minutes, and constraining the agent to that one path
made "the fleet audits its own memory" a genuinely small amount of code.

## YouTube title + description (paste into YouTube)

### Title

```
colony8 — transactional shared memory for multi-agent fleets
```

59 characters, so it survives search truncation intact. Alternates, if you want the
mechanism or the result in front instead of the name:

- `Agent fleets that never read stale memory — colony8 on CockroachDB` (65)
- `One memory, many agents: contradictions resolved at write time` (61)
- `We benchmarked our agent memory against Zep, Mem0 and Letta` (58)

### Description

```
37% of multi-agent system failures come from agents acting on inconsistent shared
state. colony8 removes that failure mode by construction: the agents are stateless,
and there is exactly one memory — a CockroachDB table every one of them reads and
writes through, with every write resolved inside a serializable transaction.

Watch a fleet contradict itself and recover in real time: a 2019 handbook claims water
boils at 90C, the NIST reference lands seconds later, and the resolver supersedes the
earlier claim on screen — struck through, audit chain intact, nothing deleted. Then the
backend is killed and restarted, and a NEW session asks a different question: session
one's claims are injected into the new researchers' context before they touch a single
source, as an auditable INJECT event on the ledger. Nothing is re-learned, and nothing
ever lived in agent state.

At 2:03 we put the design against reimplementations of what Zep/Graphiti, Mem0 and
Letta document publicly — same store, same embedder, same classifier. colony8 does not
win that table. Zep's bi-temporal model scores 94% to our 88%, and the whole margin is
one shape: a claim about an earlier event arriving late. We shipped the losing number,
because a memory layer that hides its failure modes is the thing this project argues
against.

Chapters
0:00  The 37% failure mode
0:09  A fleet launches — findings stream into one memory
0:32  Kill the backend mid-run, restart it
0:58  A new session inherits the colony's memory (INJECT)
1:20  Inside the write-time resolver
1:34  The concurrency test, run live
1:44  200 conflicting writes → 1 live fact, 0 lost
2:03  Benchmarked against Zep, Mem0 and Letta
2:19  The tools, and what each one carries
2:31  Repo and license

Built with CockroachDB (distributed vector indexing, Cloud Managed MCP Server, ccloud
CLI) and AWS (Bedrock for Claude + Titan embeddings, Lambda, S3 + CloudFront).

Code, benchmarks and the full write-up: https://github.com/anthonysuherli/colony8
MIT licensed. Runs on free tiers.

Recording note: the UI segments are real runs against a real local CockroachDB through
the real API — only the Bedrock calls are stubbed, as the recording machine had no AWS
credentials. The resolver, the serializable transactions, the supersede chains, the
pytest run and the benchmark are unmodified. The comparison card reports measured output
from scripts/compare.py; no vendor code was run and those are not Zep's, Mem0's or
Letta's own scores. Full disclosure: https://github.com/anthonysuherli/colony8/blob/main/DISCLOSURES.md
```

Chapter markers satisfy YouTube's rules (first at 0:00, ten entries, each well over the
10-second minimum), so they render as a clickable chapter list.
