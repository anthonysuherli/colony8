# video cut timestamps

Two cuts live here. **`colony8-deck-flow` is the current one** — it follows the deck's
argument order and carries the cross-session injection beat. The v2 table below it is
kept for reference; v2 predates both the 2:39 master and the INJECT concept.

---

## colony8-deck-flow.mp4 — total 2:36

Follows [`presentation/slides.md`](../presentation/slides.md): explain the mechanism,
then show it running, then prove it. Wraps the 2:39 master
(`public/colony8-demo-v3.mp4`); real segments are composited unchanged. Derived from
[`src/DeckFlow.tsx`](src/DeckFlow.tsx) — regenerate this table if a frame count changes.

| # | segment | start | end | kind | deck slide | on screen |
|---|---------|-------|-----|------|-----------|-----------|
| 1 | hook | 0:00 | 0:08 | drawn | 2 | 37% counts up, citation, "impossible by construction" |
| 2 | fleet deploy | 0:08 | 0:20 | **split** | 3 | left: planner fans out to 3 Bedrock researchers into one CockroachDB · right: the real ledger filling |
| 3 | resolver | 0:20 | 0:34 | drawn | 5 | classify outside the txn → SERIALIZABLE verify-and-apply → drift / retry / DEFERRED |
| 4 | supersede | 0:34 | 0:45 | real | 7 | the 90C claim superseded by NIST — struck through, chain kept |
| 5 | kill | 0:45 | 1:11 | real | 8 | backend killed (connection refused), restarted (HTTP 200) |
| 6 | **cross-session** | 1:11 | 1:33 | **split** | — | left: session 2's researchers pull colony memory **per source** and write back, four cycles · right: the real run whose first ledger event is a violet INJECT |
| 7 | race | 1:33 | 1:43 | real | 9 | `test_concurrent_contradiction` PASSED |
| 8 | bench | 1:43 | 2:02 | real | 9 | 200 conflicting writes → 1 live fact, 0 lost writes |
| 9 | compare | 2:02 | 2:16 | drawn | 10 | colony8 vs typical agent-memory layers |
| 10 | tools | 2:16 | 2:28 | drawn | 11 | 3 CockroachDB + 3 AWS tools, plus the silent-vector-index edge |
| 11 | close | 2:28 | 2:36 | drawn | 14 | one memory, nothing lost · repo · MIT |

Deck slides **4** (architecture), **6** (the code), **12** (`EXPLAIN`) and **13**
(failure modes) are intentionally not in the cut — the fleet animation already carries
the architecture, and the other three are dense reading that works on a slide a judge
can pause but not at 30fps.

Segment 6 has no deck slide because the deck has no injection slide yet. **That is the
gap worth closing** if the deck is presented live.

---

## colony8-demo-v2.mp4 — segment timestamps (total 2:24, superseded)

Source of truth for what is on screen in the v2 cut. One line of narration per segment
for voiceover dubbing. Derived from the timeline in [`src/Main.tsx`](src/Main.tsx) —
if you change a scene's frame count, regenerate this table.

| # | segment | start | end | kind | on screen |
|---|---------|-------|-----|------|-----------|
| 1 | hook | 0:00 | 0:08 | drawn | 37% counts up, citation, "impossible by construction" |
| 2 | fleet deploy | 0:08 | 0:20 | **split** | left: planner fans out to 3 Bedrock researchers, writes flow into one CockroachDB · right: the real ledger UI filling |
| 3 | supersede | 0:20 | 0:31 | real | the 90C claim superseded by NIST — struck through, chain kept |
| 4 | kill | 0:31 | 0:57 | real | backend killed (connection refused), restarted (HTTP 200) |
| 5 | recall | 0:57 | 1:07 | real | one reload with `?run=` — full ledger recalled from CockroachDB |
| 6 | resolver | 1:07 | 1:21 | drawn | classify outside the txn → SERIALIZABLE verify-and-apply → drift/retry/DEFERRED |
| 7 | race | 1:21 | 1:31 | real | `test_concurrent_contradiction` PASSED |
| 8 | bench | 1:31 | 1:50 | real | `scripts/bench.py` — 200 conflicting writes → 1 live fact, 0 lost writes |
| 9 | compare | 1:50 | 2:04 | drawn | colony8 vs typical agent-memory layers, row by row |
| 10 | tools | 2:04 | 2:16 | drawn | 3 CockroachDB + 3 AWS tools, plus the silent-vector-index edge |
| 11 | close | 2:16 | 2:24 | drawn | one memory, nothing lost · repo · MIT · 26 tests |

**kind** — `real` segments are the original screen recordings, composited unchanged and
labelled on screen. `drawn` segments are authored motion graphics. Segment 2 is both:
the animated fleet is a drawing of the architecture, the panel beside it is the real
recording.

Under the 3:00 submission limit with 36 seconds of headroom.
