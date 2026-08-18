import React from 'react'
import {
  AbsoluteFill,
  OffthreadVideo,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  Easing,
} from 'remotion'
import { C } from './tokens'
import { AnchorPanel, DOCK_IN, DOCK_OUT } from './AnchorPanel'
import { Compare } from './scenes/Compare'

/** The 2:39 cut with the context-anchor panel docked beside it from 0:09 to 1:20.
    The footage itself is untouched — it scales left while the panel narrates the
    same events in schematic form, then returns to full frame for the proof beats. */

export const ANCHORED_FRAMES = 4783 // 159.433s at 30fps
// The recorded cut's own comparison card (2:03-2:19) predates the benchmark and shows a
// strawman "typical agent-memory layers" table. Cover exactly that window with the card
// built from scripts/compare.py's measured numbers — same runtime, current claims.
const CMP_IN = 3690 // 2:03
const CMP_OUT = 4170 // 2:19
const T = 24 // dock/undock transition length
const DOCKED_W = 1400 / 1920

const ease = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) } as const

export const Anchored: React.FC = () => {
  const frame = useCurrentFrame()
  const p = Math.min(
    interpolate(frame, [DOCK_IN, DOCK_IN + T], [0, 1], ease),
    interpolate(frame, [DOCK_OUT, DOCK_OUT + T], [1, 0], ease),
  )
  // Cross-fade over the stale card rather than cutting, so the splice is invisible.
  const cmp = Math.min(
    interpolate(frame, [CMP_IN, CMP_IN + 10], [0, 1], ease),
    interpolate(frame, [CMP_OUT - 10, CMP_OUT], [1, 0], ease),
  )
  const s = 1 - p * (1 - DOCKED_W)
  const x = 8 * p
  const y = (1080 * (1 - s)) / 2

  return (
    <AbsoluteFill style={{ backgroundColor: C.void }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `translate(${x}px, ${y}px) scale(${s})`,
          transformOrigin: '0 0',
        }}
      >
        <OffthreadVideo
          src={staticFile('colony8-demo-v3.mp4')}
          muted
          style={{ width: 1920, height: 1080, display: 'block' }}
        />
      </div>
      {p > 0 && <AnchorPanel frame={frame} slide={p} />}
      {frame >= CMP_IN && frame < CMP_OUT && (
        <AbsoluteFill style={{ opacity: cmp }}>
          <Sequence from={CMP_IN}>
            <Compare />
          </Sequence>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  )
}
