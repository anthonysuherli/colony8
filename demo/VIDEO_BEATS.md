# colony8 demo — beats (v1 plan, SUPERSEDED)

> This was the pre-production plan. The shipped cut differs: it runs 2:27, drops the
> standalone audit beat, and adds the benchmark and comparison segments.
> **[`VIDEO_TIMESTAMPS.md`](VIDEO_TIMESTAMPS.md) is the source of truth for what is
> actually on screen.** Kept only as a record of the original storyboard.

0:00-0:20  Problem: 37% of multi-agent failures = inconsistent shared state.
           Slide with the claim + citation. "colony8 makes that impossible by construction."
0:20-0:45  Architecture card: stateless Bedrock agents, ONE memory — CockroachDB.
           Resolver = classify outside the txn, serializable verify-and-apply inside.
0:45-1:30  LIVE: launch fleet on the water question (local uvicorn + UI, DEMO_MODE).
           Findings stream in. The 90C claim lands... then the NIST source arrives:
           red SUPERSEDE event, old claim struck through, chain rendered. Zoom on it.
1:30-1:55  Kill the backend mid-run (Ctrl-C on camera). Restart, reload with
           ?run=<id>: ledger fully recalled — nothing lived in agent state.
           Memory survived.
2:00-2:20  Audit: memory health panel — contradiction rate, chains — produced by an
           agent reading its OWN memory through the CockroachDB Managed MCP Server.
2:20-2:40  Tool table + repo + CTA.
