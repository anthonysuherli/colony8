# colony8

Multi-agent research fleets fail in a specific, avoidable way: agents act on
stale or divergent copies of shared state. Cemri et al.'s failure-mode study
(summarized by O'Reilly, 2025) attributes 37% of multi-agent system failures
to inconsistent shared state — one agent writes, another reads a snapshot
that's already wrong, and both proceed as if nothing happened. colony8 makes
that class of bug impossible by construction: every agent in the fleet is
stateless, and there is exactly one transactional memory — a CockroachDB
table guarded by a serializable write-time resolver — that all of them read
and write through. A finding is never silently overwritten; it is superseded,
with the full chain kept for audit.

## Architecture

```
                        ┌─────────────────────────────┐
                        │  React ledger UI (S3+CF)    │
                        │  runs · ledger · supersede  │
                        │  chains · health report     │
                        └──────────────┬──────────────┘
                                       │ REST (2s poll)
┌──────────┐   spawn   ┌───────────────┴─────────────┐
│ planner  ├──────────►│  FastAPI orchestrator       │
│ (Bedrock)│           │  (Lambda; threads in dev)   │
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

## Required tools

Every tool below is load-bearing on the demo path — none is decorative.

| Tool | Role in colony8 |
|---|---|
| CockroachDB Distributed Vector Indexing | semantic recall before every write; feeds candidate matches into the resolver |
| CockroachDB Cloud Managed MCP Server | the memory-audit agent's *only* access path — read-only SQL, EXPLAIN, health metrics |
| ccloud CLI | scripted, repeatable cluster + SQL user provisioning (`scripts/provision_cloud.sh`) |
| Amazon Bedrock | planner / researcher / audit agent LLM (Claude) and Titan text embeddings |
| AWS Lambda | stateless runtime for the orchestrator and agent fleet in production |
| Amazon S3 + CloudFront | static hosting and CDN for the ledger UI |

## How the resolver works

Every candidate finding goes through the same two-phase pipeline:

1. **Snapshot + classify (outside any transaction).** Vector recall against
   live findings for the run returns the nearest matches. If the best match
   is below the ADD threshold, the candidate is an unconditional `ADD`.
   Otherwise an LLM classifier compares the candidate against the matches and
   returns one of `ADD`, `UPDATE`, `NOOP`, or `SUPERSEDE`.
2. **Verify-and-apply (inside one SERIALIZABLE transaction).** The target
   row (if any) is re-read with `SELECT ... FOR UPDATE` and its version is
   checked against the snapshot. If nothing has changed, the decision is
   applied. If the version has drifted since the snapshot was taken, the
   whole cycle — snapshot, classify, apply — retries from the top. A
   `SQLSTATE 40001` serialization failure triggers a jittered retry as well.

If every retry attempt is exhausted without a clean apply, the candidate is
recorded as a `DEFERRED` resolution event rather than dropped or force-
applied — the write is never lost, just left for a human or a later pass.

`SUPERSEDE` never deletes a row: the losing finding gets `invalidated_at`
and `superseded_by` set, and stays queryable forever. The ledger UI renders
both the live findings and the full supersede chain behind each one.

One honest gap: two agents concurrently `ADD`ing brand-new, near-identical
claims can both land — there is no existing row yet to fence the write on.
The duplicate isn't lost; it's retired the moment a later candidate matches
and supersedes it.

## Quickstart

### Local dev

```bash
./scripts/dev_db.sh &                 # throwaway single-node CockroachDB, localhost:26257
uv run pytest -q                      # 25 tests

uv run uvicorn colony8.api.app:app --reload   # backend, http://localhost:8000

cd frontend && npm install && npm run dev     # UI, http://localhost:5173
```

Set `DEMO_MODE=true` to serve web search from the canned `demo/sources.json`
corpus instead of live Tavily calls — this is what the recorded demo and
video run against. The source corpus is fixed, but LLM extraction may vary
slightly between runs, so replays are not guaranteed byte-identical.

### Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | CockroachDB connection string (local or cloud) |
| `AWS_REGION` | region for Bedrock, Lambda, S3, CloudFront (default `us-east-1`) |
| `BEDROCK_MODEL_ID` | Claude model id for planner/researcher/audit agents |
| `BEDROCK_EMBED_MODEL_ID` | Titan embedding model id used by the resolver |
| `EMBED_DIM` | embedding vector width (must match the schema's `VECTOR(n)`) |
| `TAVILY_API_KEY` | web search, unused when `DEMO_MODE=true` |
| `DEMO_MODE` | `true` serves the canned demo corpus instead of live search |
| `CRDB_MCP_URL` | CockroachDB Cloud Managed MCP Server endpoint |
| `CRDB_MCP_TOKEN` | auth token for the MCP endpoint |
| `FLEET_SIZE` | number of parallel researcher agents per run |

AWS credentials are read from the standard AWS env/profile chain, not from
`.env`.

### Deploy

```bash
./scripts/provision_cloud.sh          # one-time: CockroachDB Cloud cluster + SQL user
set -a; source .env; set +a
./scripts/deploy_backend.sh           # builds the Lambda image, prints the function URL
./scripts/deploy_frontend.sh https://<function-url>   # builds the UI, ships to S3+CloudFront
```

The deployed demo serves **replay** of a completed run (the launcher itself
is a local/demo-recording affordance — Lambda cannot host the background
worker thread that drives a live fleet run). Any completed run can be
reopened by appending `?run=<run-id>` to the UI URL.

To populate the replay run: run the backend locally with `DATABASE_URL`
pointed at the cloud cluster and `DEMO_MODE=true`, complete a run against
it, then share `<cloudfront-url>/?run=<run_id>`.

## Demo

**Demo:** _coming soon_
**Video:** _coming soon_

## License

MIT
