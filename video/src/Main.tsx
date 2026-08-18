import React from 'react'
import { AbsoluteFill, Sequence } from 'remotion'
import { C } from './tokens'
import { FootageTag } from './chrome'
import { Footage, SRC } from './Footage'
import { Hook, HOOK_FRAMES } from './scenes/Hook'
import { FleetDeploy, FLEET_FRAMES } from './scenes/FleetDeploy'
import { Resolver, RESOLVER_FRAMES } from './scenes/Resolver'
import { Compare, COMPARE_FRAMES } from './scenes/Compare'
import { Tools, TOOLS_FRAMES } from './scenes/Tools'
import { Close, CLOSE_FRAMES } from './scenes/Close'

/* Real recordings keep their original footage; only the cards are re-authored.
   Source offsets come from demo/VIDEO_TIMESTAMPS.md. */

const SUPERSEDE_FRAMES = 330 // source 0:21 → 0:32
const KILL_FRAMES = SRC.kill[1] - SRC.kill[0] // 780
const RECALL_FRAMES = SRC.recall[1] - SRC.recall[0] // 300
const RACE_FRAMES = SRC.race[1] - SRC.race[0] // 300
const BENCH_FRAMES = SRC.bench[1] - SRC.bench[0] // 570

const SUPERSEDE_FROM = SRC.launch[0] + FLEET_FRAMES // 630

const TIMELINE = [
  { key: 'hook', frames: HOOK_FRAMES, el: <Hook /> },
  { key: 'fleet', frames: FLEET_FRAMES, el: <FleetDeploy /> },
  {
    key: 'supersede',
    frames: SUPERSEDE_FRAMES,
    el: (
      <Footage from={SUPERSEDE_FROM} to={SUPERSEDE_FROM + SUPERSEDE_FRAMES}>
        <FootageTag kind="real run" />
      </Footage>
    ),
  },
  {
    key: 'kill',
    frames: KILL_FRAMES,
    el: (
      <Footage from={SRC.kill[0]} to={SRC.kill[1]}>
        <FootageTag kind="real terminal" />
      </Footage>
    ),
  },
  {
    key: 'recall',
    frames: RECALL_FRAMES,
    el: (
      <Footage from={SRC.recall[0]} to={SRC.recall[1]}>
        <FootageTag kind="real recall" />
      </Footage>
    ),
  },
  { key: 'resolver', frames: RESOLVER_FRAMES, el: <Resolver /> },
  {
    key: 'race',
    frames: RACE_FRAMES,
    el: (
      <Footage from={SRC.race[0]} to={SRC.race[1]}>
        <FootageTag kind="real pytest" />
      </Footage>
    ),
  },
  {
    key: 'bench',
    frames: BENCH_FRAMES,
    el: (
      <Footage from={SRC.bench[0]} to={SRC.bench[1]}>
        <FootageTag kind="real benchmark" />
      </Footage>
    ),
  },
  { key: 'compare', frames: COMPARE_FRAMES, el: <Compare /> },
  { key: 'tools', frames: TOOLS_FRAMES, el: <Tools /> },
  { key: 'close', frames: CLOSE_FRAMES, el: <Close /> },
]

export const TOTAL_FRAMES = TIMELINE.reduce((n, s) => n + s.frames, 0)

export const Main: React.FC = () => {
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
