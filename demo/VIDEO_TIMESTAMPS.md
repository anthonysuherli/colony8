# colony8-demo.mp4 — segment timestamps (total 1:52)

For voiceover dubbing: one line of narration per segment; captions are burned in.

| # | segment  | start | end  | on screen |
|---|----------|-------|------|-----------|
| 1 | hook     | 0:00  | 0:09 | 37% stat card — "colony8 makes that impossible by construction" |
| 2 | launch   | 0:09  | 0:32 | LIVE: fleet launches, findings stream, 90C claim SUPERSEDED by NIST (red, struck through, chain kept) |
| 3 | kill     | 0:32  | 0:58 | terminal: backend killed (connection refused), restarted (HTTP 200) |
| 4 | recall   | 0:58  | 1:08 | one reload with ?run= — full ledger recalled from CockroachDB |
| 5 | resolver | 1:08  | 1:22 | card: classify outside txn → SERIALIZABLE verify-and-apply → retry → DEFERRED; supersede never deletes |
| 6 | race     | 1:22  | 1:33 | terminal: test_concurrent_contradiction PASSED (real pytest run) |
| 7 | tools    | 1:33  | 1:45 | card: 3 CockroachDB tools + 3 AWS services, load-bearing roles |
| 8 | close    | 1:45  | 1:52 | repo URL · 26 tests · MIT · free tier |

Recording notes: UI segments recorded against the committed demo corpus with the
Bedrock LLM steps stubbed deterministically (no AWS creds on the recording
machine); the resolver, CockroachDB writes, supersede chains, and test run are
fully real. Re-record segments 2/4 against live Bedrock once creds exist:
scratchpad video pipeline, `node record_ui.js launch|recall` + `assemble.sh`.
