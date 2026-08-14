# colony8-demo.mp4 — segment timestamps (total 2:27)

For voiceover dubbing: one line of narration per segment; captions are burned in.

| # | segment  | start | end  | on screen |
|---|----------|-------|------|-----------|
| 1 | hook     | 0:00  | 0:09 | 37% stat card — "colony8 makes that impossible by construction" |
| 2 | launch   | 0:09  | 0:32 | LIVE: fleet launches, findings stream, 90C claim SUPERSEDED by NIST (red, struck through, chain kept) |
| 3 | kill     | 0:32  | 0:58 | terminal: backend killed (connection refused), restarted (HTTP 200) |
| 4 | recall   | 0:58  | 1:08 | one reload with ?run= — full ledger recalled from CockroachDB |
| 5 | resolver | 1:08  | 1:22 | card: classify outside txn → SERIALIZABLE verify-and-apply → retry → DEFERRED; supersede never deletes |
| 6 | race     | 1:22  | 1:32 | terminal: test_concurrent_contradiction PASSED (real pytest run) |
| 7 | bench    | 1:32  | 1:51 | terminal: scripts/bench.py live — 200 conflicting writes → 1 live fact, 0 lost writes |
| 8 | compare  | 1:51  | 2:07 | card: colony8 vs typical agent-memory layers (write-time resolution, version fencing, chains, one store) |
| 9 | tools    | 2:07  | 2:19 | card: 3 CockroachDB tools + 3 AWS services, load-bearing roles |
| 10| close    | 2:19  | 2:27 | repo URL · 26 tests · MIT · free tier |

Recording notes: UI segments recorded against the committed demo corpus with the
Bedrock LLM steps stubbed deterministically (no AWS creds on the recording
machine); the resolver, CockroachDB writes, supersede chains, and test run are
fully real. Re-record segments 2/4 against live Bedrock once creds exist:
scratchpad video pipeline, `node record_ui.js launch|recall` + `assemble.sh`.
