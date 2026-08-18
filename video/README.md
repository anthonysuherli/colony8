# colony8 — demo video (v2)

Remotion project that produces the submission cut. It **wraps the original recording
rather than replacing it**: every screen recording, terminal session, pytest run and
benchmark in `../demo/colony8-demo.mp4` is composited in unchanged via `OffthreadVideo`.
Only the static cards are re-authored, plus one new animated scene.

```bash
npm install
npm run studio                     # Remotion Studio, scrub the timeline
npm run render                     # out/colony8-demo-v2.mp4
npx remotion still scene-fleet out/fleet.png --frame=300   # one frame of one scene
```

`../demo/colony8-demo.mp4` must be copied to `public/` (it already is). Every scene is
also registered as its own composition (`scene-hook`, `scene-fleet`, …) so a single card
can be re-rendered without waiting on the full cut.

> **Note:** the v2 timeline near the bottom wraps the earlier 2:27 cut
> (`public/colony8-demo.mp4`) and predates the cross-session INJECT beat. Two newer
> compositions supersede it: **`colony8-deck-flow`** (re-ordered to the deck's argument)
> and **`colony8-anchored`** (a schematic panel docked over the 2:39 cut).

## colony8-deck-flow — the cut re-ordered to the deck's argument

`src/DeckFlow.tsx` follows [`presentation/slides.md`](../presentation/slides.md) instead
of the recording order: **explain the mechanism, then show it running, then prove it.**
The v2/v3 cuts open on the demo and explain afterwards; this one opens on the problem,
draws the fleet and the resolver, and only then cuts to footage. 4680 frames = **2:36**.

Its centrepiece is `src/scenes/CrossSession.tsx`, the beat the deck does not have.

```bash
npx remotion render colony8-deck-flow out/colony8-deck-flow.mp4
npx remotion still scene-cross-session out/xs.png --frame=590    # the NOOP/skip beat
```

### Why the cross-session scene is drawn the way it is

The mechanic is easy to depict wrongly. `recall_colony()` is **not** a context load at
session boot — it sits inside the researcher's `for source in sources:` loop
([`agents/researcher.py`](../colony8/agents/researcher.py)), so *every* extraction is
primed by what the whole colony already knows, and every accepted claim goes straight
back into the same table. One fleet's research feeds the next fleet's research,
continuously.

So the schematic runs a visible **cycle** — violet down (`context in`), green up
(`claim out`) — four times, with a `reading source N of 4` counter, rather than a single
pulse at the top. Two of the four cycles resolve `NOOP · already known`, which is the
whole payoff: the colony does not re-learn what it already has. The `INJECT` ledger
event fires once per subtopic (deduped by the `injected` flag), which is why the badge
shows INJECT on the first cycle and ADD/NOOP after.

The panel is keyed to the real footage beside it: at frame 590 the schematic reads
`NOOP · already known` while the recording's own caption reads *"nothing re-learned —
only genuinely new facts are written."*

## colony8-anchored — the context-anchor pass over the 2:39 cut

`src/Anchored.tsx` + `src/AnchorPanel.tsx` take the current 2:39 cut
(`public/colony8-demo-v3.mp4`, byte-identical to `../demo`'s pre-anchor master) and dock
it left from 0:09 to 1:20 while a schematic **context anchor** panel on the right
narrates the same events. The split is **by agent, not by session**: each agent is its
own lane (planner, researchers 1–3, then researchers A/B) with session membership as a
tag on the card, and each lane has its own wire to the one CockroachDB memory. Writes,
the 90C supersede, the kill (each session-1 lane struck through, memory intact) and the
violet per-agent INJECT flow all advance in sync with the footage — every state is
keyed to absolute source frames. Below the synced lanes, three dimmed dashed lanes
(`session 3/4/N`) are **illustrative**, extending the same injection to parallel
sessions the recording doesn't contain: the "grounded reasoning scales" beat. The
footage itself is untouched — scaled, never edited.

```bash
npx remotion render colony8-anchored out/colony8-demo-anchored.mp4
npx remotion still colony8-anchored out/check.png --frame=1930   # inject beat
```

## Timeline — 4320 frames @ 30fps = 2:24

| # | scene | frames | source |
|---|---|---|---|
| 1 | hook | 240 | new — 37% stat, counts up |
| 2 | **fleet deploy** | 360 | **new — split screen**: animated Bedrock fleet left, real footage right (src 0:09–0:21) |
| 3 | supersede | 330 | real footage, src 0:21–0:32 |
| 4 | kill | 780 | real footage, src 0:32–0:58 |
| 5 | recall | 300 | real footage, src 0:58–1:08 |
| 6 | resolver | 420 | new — candidate walking both phases |
| 7 | race | 300 | real footage, src 1:22–1:32 |
| 8 | bench | 570 | real footage, src 1:32–1:51 |
| 9 | compare | 420 | new — differentiation table |
| 10 | tools | 360 | new — load-bearing tools + the vector-index edge |
| 11 | close | 240 | new — repo, demo, CTA |

Source offsets are frames into `../demo/colony8-demo.mp4` and come from
[`../demo/VIDEO_TIMESTAMPS.md`](../demo/VIDEO_TIMESTAMPS.md). Change one and the other
must change with it — `src/Footage.tsx` is the single place they are declared.

Real-footage segments carry a burned-in `FootageTag` naming what is on screen and
marking it as a real run, so a judge is never guessing what is live and what is drawn.

## The one thing that will bite you

**Animation must be a function of `frame`, never of wall-clock time.** Remotion renders
frames out of order and in parallel, so CSS transitions, CSS keyframe animations and
`setInterval` all produce nondeterministic output. Everything here derives from
`useCurrentFrame()` — including the write packets, which are positioned by evaluating a
cubic bezier at `t` rather than by an `offset-path` animation.

Both `FleetDeploy` and the deck's `FleetTopology.vue` draw the same choreography, but
they are separate implementations for exactly this reason: the deck is time-driven
(it is a live web page), the video is frame-driven.

## Disclosure

Unchanged from [`../DISCLOSURES.md`](../DISCLOSURES.md): the recorded segments were
captured against a real local CockroachDB through the real FastAPI surface, with only
the Bedrock calls stubbed (the recording machine had no AWS credentials). The resolver,
the serializable transactions, the supersede chains, the pytest run and the benchmark
are real and unmodified. The scenes authored here are illustrations — the fleet
topology in scene 2 is a drawing of the architecture, not a capture of it, and is
labelled as such on screen.
