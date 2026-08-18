import React from 'react'
import { AbsoluteFill, Sequence } from 'remotion'
import { C } from './tokens'
import { FootageTag } from './chrome'
import { Footage, SOURCE3, SRC3 } from './Footage'
import { Hook, HOOK_FRAMES } from './scenes/Hook'
import { FleetDeploy, FLEET_FRAMES } from './scenes/FleetDeploy'
import { Resolver, RESOLVER_FRAMES } from './scenes/Resolver'
import { CrossSession, CROSS_FRAMES } from './scenes/CrossSession'
import { Compare, COMPARE_FRAMES } from './scenes/Compare'
import { Tools, TOOLS_FRAMES } from './scenes/Tools'
import { Close, CLOSE_FRAMES } from './scenes/Close'

/* The cut re-ordered to follow presentation/slides.md: explain the mechanism,
   then show it running, then prove it — rather than the v2/v3 order, which
   opened on the demo and explained afterwards.

   Deck slides 4 (architecture), 6 (the code), 12 (EXPLAIN) and 13 (failure
   modes) are deliberately dropped: the fleet animation already carries the
   architecture, and the other three are dense reading that works on a slide a
   judge can pause on but not at 30fps. They stay in the deck.

   Slide order → scene:
     2  the problem              → Hook
     3  the shape of it          → FleetDeploy (split)
     5  the resolver             → Resolver
     7  supersede never deletes  → real footage
     8  the demo · kill          → real footage
     —  cross-session injection  → CrossSession (split)   [new; no deck slide]
     9  proof                    → real footage ×2
     10 how it differs           → Compare
     11 required tools           → Tools
     14 close                    → Close                                     */

const SUPERSEDE_FRAMES = 330 // v3 0:21 → 0:32, the NIST contradiction landing
// Full segment, not trimmed: a shorter cut lands mid-restart-command and the
// HTTP 200 that makes the beat mean anything never arrives.
const KILL_FRAMES = SRC3.kill[1] - SRC3.kill[0] // 780
const RACE_FRAMES = SRC3.race[1] - SRC3.race[0] // 300
const BENCH_FRAMES = SRC3.bench[1] - SRC3.bench[0] // 570

const SUPERSEDE_FROM = SRC3.launch[0] + FLEET_FRAMES // 630

const real = (from: number, frames: number, kind: string) => (
  <Footage src={SOURCE3()} from={from} to={from + frames}>
    <FootageTag kind={kind} />
  </Footage>
)

const TIMELINE = [
  { key: 'hook', frames: HOOK_FRAMES, el: <Hook /> },
  {
    key: 'fleet',
    frames: FLEET_FRAMES,
    el: <FleetDeploy videoSrc={SOURCE3()} videoFrom={SRC3.launch[0]} />,
  },
  { key: 'resolver', frames: RESOLVER_FRAMES, el: <Resolver /> },
  { key: 'supersede', frames: SUPERSEDE_FRAMES, el: real(SUPERSEDE_FROM, SUPERSEDE_FRAMES, 'real run') },
  { key: 'kill', frames: KILL_FRAMES, el: real(SRC3.kill[0], KILL_FRAMES, 'real terminal') },
  { key: 'cross-session', frames: CROSS_FRAMES, el: <CrossSession /> },
  { key: 'race', frames: RACE_FRAMES, el: real(SRC3.race[0], RACE_FRAMES, 'real pytest') },
  { key: 'bench', frames: BENCH_FRAMES, el: real(SRC3.bench[0], BENCH_FRAMES, 'real benchmark') },
  { key: 'compare', frames: COMPARE_FRAMES, el: <Compare /> },
  { key: 'tools', frames: TOOLS_FRAMES, el: <Tools /> },
  { key: 'close', frames: CLOSE_FRAMES, el: <Close /> },
]

export const DECKFLOW_FRAMES = TIMELINE.reduce((n, s) => n + s.frames, 0)

export const DeckFlow: React.FC = () => {
  let at = 0
  return (
    <AbsoluteFill style={{ backgroundColor: C.void }}>
      {TIMELINE.map((s) => {
        const from = at
        at += s.frames
        return (
          <Sequence key={s.key} from={from} durationInFrames={s.frames} name={s.key}>
            {s.el}
          </Sequence>
        )
      })}
    </AbsoluteFill>
  )
}
