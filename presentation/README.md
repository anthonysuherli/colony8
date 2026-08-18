# colony8 — presentation deck

Slidev deck for the hackathon pitch. Same substrate as the ledger UI: ruled paper,
mono for machine data, sans for claim prose. 14 slides.

```bash
npm install
npm run dev          # live deck at localhost:3030, presenter view at /presenter
npm run export       # dist/colony8-deck.pdf
npm run export:png   # dist/png/1..14.png — for the Devpost gallery and README embeds
npm run build        # dist/site — static deck, deployable anywhere
```

## What's in it

| # | slide | note |
|---|---|---|
| 1 | title | the three headline numbers |
| 2 | the problem | 37%, and how the race actually plays out |
| 3 | the shape of it | **animated** — fleet deploys, ledger fills beside it |
| 4 | architecture | `docs/architecture.svg` |
| 5 | the resolver | **animated** — candidate walking both phases |
| 6 | the code | real excerpts from `colony8/memory/resolver.py` |
| 7 | supersede | the chain, and the `version = %s` fence |
| 8 | the demo | what the video shows, in three beats |
| 9 | proof | contention run + substrate throughput |
| 10 | how it differs | against typical agent-memory layers |
| 11 | required tools | every one load-bearing, plus the sharpest edge |
| 12 | vector index | the `EXPLAIN` proof |
| 13 | failure modes | including the one honest gap |
| 14 | close | repo, demo, CTA |

## Two things worth knowing before you edit

**The animated components hold their finished frame for 4 seconds before looping.**
`FleetTopology.vue` and `ResolverPipeline.vue` both start at their last step and only
begin replaying after `HOLD_MS`. That is deliberate: a PDF/PNG export screenshots each
slide shortly after mount, so without the hold the static export captures frame one and
the diagram comes out blank. If you shorten `HOLD_MS`, re-check the exports.

**`FleetTopology.vue` uses one fixed 420×360 pixel canvas** shared by the wire SVG and
the HTML boxes. The wires are cubic beziers in that coordinate space and the nodes are
positioned in the same pixels, so they actually meet. Don't make the SVG `width: 100%` —
that rescales the curves away from the boxes.

Numbers on the benchmark slide come from `README.md`'s Benchmarks table. They vary run
to run; the invariants (one live fact, zero lost writes, zero silent drops) do not.
