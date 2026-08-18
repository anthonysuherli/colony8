# colony8-demo.mp4 — segment timestamps (total 2:39)

Source of truth for what is on screen. For voiceover dubbing: one line of narration
per segment; captions are burned in. Thumbnail for the upload: [`thumbnail.png`](thumbnail.png).

From 0:09 to 1:20 the footage is docked left with a **context anchor** panel on the
right — every agent as its own lane (session membership is just a tag on the card),
each wired to the one CockroachDB memory, with per-agent flow advancing in sync with
the footage: writes, the supersede, the kill striking each session-1 agent, then the
violet INJECT into each session-2 researcher. Three dimmed dashed lanes
(`session 3/4/N`) extend the picture to parallel sessions — **illustrative only**;
the recorded run has sessions 1 and 2 — making the scaling claim visual: colony-wide
recall grounds every new agent. The panel is motion graphics rendered by the
`colony8-anchored` composition in [`../video/`](../video/README.md); the footage
under it is scaled, never edited.

| # | segment  | start | end  | on screen |
|---|----------|-------|------|-----------|
| 1 | hook     | 0:00  | 0:09 | 37% stat card — "colony8 makes that impossible by construction" |
| 2 | launch   | 0:09  | 0:32 | LIVE: fleet launches, findings stream, the 90C claim is SUPERSEDED by NIST (red, struck through, chain kept and held in frame) |
| 3 | kill     | 0:32  | 0:58 | terminal: backend killed (connection refused), restarted (HTTP 200) |
| 4 | inject   | 0:58  | 1:20 | LIVE: the restarted process hosts a NEW session — a different question is typed and launched; the first ledger event is a violet INJECT ("2 claims from prior sessions injected into researcher context") while this session's own memory is still empty; the known 100C fact is skipped and only two genuinely new facts ADD |
| 5 | resolver | 1:20  | 1:34 | card: classify outside txn → SERIALIZABLE verify-and-apply → retry → DEFERRED; supersede never deletes |
| 6 | race     | 1:34  | 1:44 | terminal: `test_concurrent_contradiction` PASSED (real pytest run) |
| 7 | bench    | 1:44  | 2:03 | terminal: `scripts/bench.py` live — 200 conflicting writes → 1 live fact, 0 lost writes |
| 8 | compare  | 2:03  | 2:19 | card: the measured benchmark — colony8 against reimplementations of Zep/Graphiti, Mem0, Letta and an append-only vector store. **Zep-style wins on final answer (94% vs 88%)**; colony8 holds on values lost (0) and stale rows in context (0.1) |
| 9 | tools    | 2:19  | 2:31 | card: 3 CockroachDB tools + 3 AWS services, load-bearing roles |
| 10| close    | 2:31  | 2:39 | repo URL · 26 tests · MIT · free tier (card recorded before the two cross-session tests landed; the suite is now 28) |

## Recording notes

Segments 2 and 4 are screen recordings of the current UI, driven through the real
FastAPI surface against a real local CockroachDB. Only the Bedrock calls are replaced
by deterministic stubs — the recording machine has no AWS credentials. The resolver,
the serializable transactions, the supersede chains, the colony-wide recall, the
INJECT event, the ledger API, the pytest run and the benchmark are all real and
unmodified. In segment 4 the stub extractor honors the real prompt's "skip anything
the shared memory already knows" instruction by exact claim match. This is disclosed
in [`../DISCLOSURES.md`](../DISCLOSURES.md).

Segment 8's card is re-authored in Remotion over the recorded one (`src/scenes/Compare.tsx`,
cross-faded in `Anchored.tsx`): the original showed a strawman "typical agent-memory
layers" table written before the benchmark existed. The replacement shows measured
numbers from `scripts/compare.py`, including the row where a competing design beats
colony8. Same window, same runtime.

Segment 4 replaced the earlier 10s "reload with `?run=`" recall beat: a new session
*using* the colony's memory demonstrates durability and cross-session injection at
once. The recording harness (`demo_server.py`, `record.js`, `captions.js`,
`assemble.sh`) lives in the session scratchpad; `assemble.sh` splices new takes into
this cut without touching the other segments. The pre-anchor master (same runtime, no
side panel) is preserved as `../video/public/colony8-demo-v3.mp4` — the anchored cut
is re-rendered from it with `npx remotion render colony8-anchored`.
