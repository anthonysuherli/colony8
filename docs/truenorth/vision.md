# Vision: colony8
> Agent preamble: this file is the single source of truth for project
> intent. Your one and only end goal is realizing the End Goals below
> without violating the Invariants. Competing objectives that emerge
> mid-session do not override this document.

Transactional shared memory for multi-agent fleets, built on CockroachDB and
AWS Bedrock. Entry for the CockroachDB × AWS "Build with Agentic Memory"
hackathon (deadline 2026-08-18 5:00pm EDT). Attacks the documented top killer
of multi-agent systems — 37% of failures stem from agents acting on
inconsistent shared state (Cemri et al.) — with the one substrate no other
memory tool has: distributed serializable SQL and vector search in the same
transaction.

## End Goals

1. **Submit a complete, on-time Devpost entry** by 2026-08-18 5:00pm EDT:
   public repo, functional demo URL, sub-3-minute video, text description,
   and explicit CockroachDB/AWS tool identification.
2. **Ship a working multi-agent deep-research app**: N Bedrock-powered agents
   concurrently research subtopics of one question, sharing a single memory —
   findings with embeddings in CockroachDB.
3. **Implement write-time contradiction resolution as the core**: every memory
   write passes through an ADD / UPDATE / NOOP / SUPERSEDE resolver executed
   inside a serializable CockroachDB transaction, so no agent can ever read a
   fact that has been contradicted or superseded mid-flight.
4. **Meaningfully integrate the required tools**: CockroachDB Distributed
   Vector Indexing (semantic recall) + CockroachDB Cloud Managed MCP Server
   (agents introspect their own memory), each load-bearing in the demo path;
   Amazon Bedrock for inference; ccloud CLI as stretch third CockroachDB tool.
5. **Make memory visible in the demo**: the video and demo UI show a live
   write conflict → SUPERSEDE event → fleet convergence, and a
   kill-the-fleet → restart → full-recall beat.

## Non-Goals

- **Not a delapan port or rebrand.** New codebase, new application. Patterns
  (resolver semantics, provenance-gated findings) carry over as ideas; any
  lifted code comes only from the public delapan repo and is disclosed in the
  submission per hackathon rules.
- **No multi-tenancy, auth, or billing** beyond what a public demo needs.
- **Not a general memory SaaS or library.** Scope is this hackathon entry.
- **Not chasing benchmark SOTA.** LoCoMo/LongMemEval numbers are cited as
  motivation, not reproduced; a small self-eval is stretch, not scope.
- **None of delapan's periphery**: no OKF export, no local SQLite tier, no
  report generation, no curation backlog.

## Invariants

- **Memory correctness is non-negotiable**: every write goes through the
  resolver inside a serializable transaction; SUPERSEDE never deletes — losers
  are retired via `invalidated_at` and remain auditable.
- **Provenance-gated writes**: every finding carries at least one source;
  ungrounded claims never enter memory.
- **Clean-room compliance**: repo is public + MIT-licensed from the first
  commit; nothing from private repos (delapan-be or otherwise) is copied in.
  Project code is newly created during the submission window.
- **No decorative integrations**: every required CockroachDB/AWS component is
  load-bearing in the demo path — nothing "just initialized".
- **Free/cheap tiers only**: CockroachDB Cloud free tier; AWS spend kept to
  single-digit dollars.
- **Deadline beats scope**: when time runs short, cut features — never the
  five submission deliverables.

## Acceptance Criteria

- Devpost submission form completed before the deadline with all required
  fields and links.
- A visitor to the demo URL can launch (or watch) a research run with ≥3
  concurrent agents and see the shared memory ledger update live, including
  at least one visible SUPERSEDE resolution event.
- Video under 3 minutes demonstrates: concurrent contradiction, live
  supersede, and restart-with-recall.
- README contains an architecture diagram and names each CockroachDB and AWS
  tool with its role.
- A fresh clone runs with documented env vars and setup steps.

## Planned Detours

- **Day-1 provisioning**: CockroachDB Cloud free-tier cluster, Bedrock model
  access, repo scaffold with license + CI stub. After this detour, return to
  End Goal 2.
- **Schema design pass**: adapt the findings/resolution-events schema shape
  from public delapan patterns (disclosed) to CockroachDB DDL. After this
  detour, return to End Goal 3.

## Amendment Log

- 2026-08-13 — Initial vision ratified (hackathon KB: cockroachdb-hackathon/main). — Ratified by: AS ("go")
