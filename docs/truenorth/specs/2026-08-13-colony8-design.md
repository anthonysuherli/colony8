# colony8 — Design

**Date:** 2026-08-13
**Vision goals served:** End Goals 1–5 of `docs/truenorth/vision.md` — this is
the whole-project design for the hackathon entry (submission, multi-agent
research app, transactional resolver core, required-tool integration, visible
memory demo).

## Thesis

Stateless agents, transactional shared memory. 37% of multi-agent failures
stem from agents acting on inconsistent shared state (Cemri et al.). colony8
makes inconsistent reads impossible by construction: every memory write passes
through an ADD/UPDATE/NOOP/SUPERSEDE resolver committed under CockroachDB
serializable isolation, and agents hold no state of their own.

## System overview

```
                        ┌─────────────────────────────┐
                        │  React ledger UI (S3+CF)    │
                        │  runs · ledger · supersede  │
                        │  chains · health report     │
                        └──────────────┬──────────────┘
                                       │ SSE / REST
┌──────────┐   spawn   ┌───────────────┴─────────────┐
│ planner  ├──────────►│  FastAPI orchestrator       │
│ (Bedrock)│           │  (Lambda; asyncio in dev)   │
└──────────┘           └──┬─────────┬─────────┬──────┘
                          │         │         │
                   researcher  researcher  researcher      ← stateless
                    (Bedrock     (Bedrock    (Bedrock        workers
                     + Tavily)    + Tavily)   + Tavily)
                          │         │         │
                          ▼         ▼         ▼
                 ┌────────────────────────────────────┐
                 │        memory core (resolver)      │
                 │  snapshot classify → serializable  │
                 │  verify-and-apply → retry on 40001 │
                 └──────────────────┬─────────────────┘
                                    ▼
                 ┌────────────────────────────────────┐
                 │   CockroachDB Cloud (free tier)    │
                 │   findings · resolution_events ·   │
                 │   runs · vector index              │
                 └──────────────────┬─────────────────┘
                                    │ read-only SQL via
                                    ▼ Managed MCP Server
                          ┌──────────────────┐
                          │ memory-audit     │
                          │ agent (Bedrock)  │
                          └──────────────────┘
```

Required-tool roles (all load-bearing):

| Tool | Role in demo path |
|---|---|
| CockroachDB Distributed Vector Indexing | semantic recall before every write; candidate matching inside the resolver |
| CockroachDB Cloud Managed MCP Server | memory-audit agent's only access path: read-only SQL, EXPLAIN, health metrics |
| Amazon Bedrock | planner/researcher/audit LLM (Claude) + Titan embeddings |
| AWS Lambda | stateless agent/orchestrator runtime in prod |
| Amazon S3 (+ CloudFront) | ledger UI hosting |
| ccloud CLI *(stretch)* | scripted cluster provisioning in setup docs/CI |

## Components

### 1. Memory core (`colony8/memory/`) — the judged centerpiece

**Schema (CockroachDB DDL):**

- `runs` — id, question, status, created_at.
- `findings` — id UUID, run_id, title, content JSONB, embedding VECTOR(1024)
  (Titan v2), provenance JSONB (non-empty list of {url, title}), confidence
  FLOAT, version INT, created_at, invalidated_at TIMESTAMPTZ NULL,
  superseded_by UUID NULL. Vector index on embedding; partial covering index
  on live rows (`invalidated_at IS NULL`).
- `resolution_events` — id, run_id, op (ADD|UPDATE|NOOP|SUPERSEDE|DEFERRED),
  candidate_title, target_finding_id, new_finding_id, reason, created_at.

**Resolver protocol** (per candidate finding):

1. **Snapshot phase (no txn):** embed candidate (Titan); vector-search top-k
   live findings; if best similarity < low threshold → fast-path ADD (no LLM).
   Otherwise classify candidate vs. matches with one Bedrock call →
   {ADD | UPDATE | NOOP | SUPERSEDE} + reason.
2. **Apply phase (one SERIALIZABLE txn):** `SELECT ... FOR UPDATE` the matched
   rows; verify each is still live and at the observed `version`. If drifted →
   abort txn, go to 1 (re-classify against fresh state). Else apply:
   - ADD: insert.
   - NOOP: insert nothing; log event.
   - UPDATE: insert refined finding, set old row `invalidated_at` +
     `superseded_by` → new id.
   - SUPERSEDE: same mechanics, reason records the contradiction.
   Always insert a `resolution_events` row in the same txn.
3. **Retry on 40001** (CockroachDB serialization conflict) with jittered
   backoff, max 5 attempts; re-run from step 1 so the loser re-resolves
   against the winner's committed write. This path is exercised deliberately
   in the demo and covered by tests.

Invariants enforced here: provenance non-empty or the write is rejected;
supersede never deletes; every mutation has an event row.

**Recall API:** `recall(run_id, query, k)` → embeds query, vector-searches
live findings only. Used by researchers before writing (dedup awareness) and
by the UI.

### 2. Agents (`colony8/agents/`)

- **Planner:** one Bedrock call → 3–5 subtopics for the research question.
- **Researcher (×N, default 3):** loop per subtopic: Tavily search → fetch/
  read → extract candidate findings (Bedrock, claim-shaped, with provenance)
  → `recall()` for context → submit through resolver. Stateless: crash/restart
  loses nothing but in-flight work.
- **Memory-audit agent:** runs after the fleet (and on demand). Connects to
  the CockroachDB Cloud **Managed MCP Server** as an MCP client; uses its
  read-only SQL tools to compute contradiction rate, supersede-chain depth,
  live/invalidated counts, and EXPLAIN of the vector query; Bedrock narrates
  a short health report persisted to the run and shown in the UI.

### 3. API (`colony8/api/`)

FastAPI: `POST /runs` (start), `GET /runs/{id}/events` (SSE: agent activity +
resolution events), `GET /runs/{id}/ledger` (findings + chains),
`GET /runs/{id}/health` (audit report). Local dev: uvicorn + asyncio workers.
Prod: Lambda (Mangum adapter); SSE degrades to polling if Lambda streaming
fights back — polling is acceptable, the ledger updates every few seconds
either way.

### 4. Frontend (`frontend/`)

Small Vite/React app, S3+CloudFront. Three panes: run launcher (or replay of
the seeded run), live ledger (findings appearing; SUPERSEDE events highlighted
with the chain rendered old→new), health report. No auth. Design: minimal,
legible in a 3-minute video (dark, high-contrast, event-log aesthetic).

### 5. Demo scenario (`demo/`)

Seeded research question with a **planted contradiction**: curated source set
where two credible pages disagree on a figure/claim, guaranteeing a SUPERSEDE
on camera. Script: start run → 3 agents fill ledger → contradiction lands →
supersede chain highlighted → `kill` the fleet mid-run → restart → agents
resume from memory (recall beat) → audit health report. Recorded with the
terminal-demo-video skill + screen capture of the UI.

## Error handling

- Bedrock throttling: exponential backoff, per-agent concurrency cap.
- Tavily failure/quota: researcher marks subtopic failed and moves on — a
  run with partial coverage still completes and says so (no silent empties).
- Resolver retry exhaustion (>5 × 40001): candidate parked in
  `resolution_events` as op=DEFERRED with reason; surfaced in UI, never lost.
- Lambda cold start / timeout: orchestrator idempotent per subtopic;
  restart-safety is a demo feature, not just an error path.

## Testing

pytest against a real CockroachDB (local `cockroach start-single-node` in CI/
dev; cloud cluster for e2e):

1. Resolver unit paths: ADD fast-path, UPDATE, NOOP, SUPERSEDE (mocked
   classifier, real DB).
2. **Concurrent-write race:** two connections submit contradictory findings
   simultaneously; assert exactly one SUPERSEDE chain, no lost writes, event
   log consistent — the headline test.
3. Version-drift re-classification: matched row mutates between snapshot and
   apply; assert re-classify happens.
4. Provenance gate: empty provenance rejected.
5. Restart recall: seed run, new process, `recall()` returns prior findings.

## 5-day plan

| Day | Deliverable | Verify |
|---|---|---|
| D1 (08-14) | ccloud cluster + Bedrock access; repo scaffold (MIT, README stub); schema + resolver + tests 1–4 green | pytest |
| D2 (08-15) | planner + researchers + Tavily; seeded demo run writes real findings; test 5 | e2e run locally |
| D3 (08-16) | FastAPI + SSE + React ledger; supersede chain visible live | browser demo |
| D4 (08-17) | Lambda + S3/CF deploy; MCP audit agent; polish; architecture diagram in README | demo URL works |
| D5 (08-18) | video (<3 min), Devpost form, disclosure note, submit ≥3h before 5pm EDT | submission confirmed |

Cut order if behind (per vision: deadline beats scope): ccloud-stretch → SSE
(→ polling) → run launcher (replay-only UI) → audit agent narration (raw
metrics still shown — MCP stays load-bearing).

## Disclosures & compliance

- New code, written during the window. Resolver *semantics* follow the
  publicly documented delapan pattern; if any code is lifted from the public
  `delapan` repo it is listed in the Devpost disclosure. Nothing from private
  repos.
- MIT license from first commit. AI coding assistants used (permitted).
