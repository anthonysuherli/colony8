import React from 'react'
import { interpolate, useCurrentFrame, Easing, spring, useVideoConfig } from 'remotion'
import { C, F } from '../tokens'
import { Sheet, Eyebrow, Slug, useCardFade } from '../chrome'

export const HOOK_FRAMES = 240

export const Hook: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const opacity = useCardFade(HOOK_FRAMES)

  // the number counts up, then the sentence lands under it
  const pct = Math.round(
    interpolate(frame, [12, 54], [0, 37], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    }),
  )
  const statScale = spring({ frame: frame - 10, fps, config: { damping: 200 }, durationInFrames: 30 })
  const line = interpolate(frame, [58, 78], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const verdict = interpolate(frame, [104, 126], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  return (
    <Sheet opacity={opacity}>
      <Eyebrow>the failure mode</Eyebrow>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 40, marginTop: 40 }}>
        <div
          style={{
            fontFamily: F.prose,
            fontSize: 300,
            fontWeight: 700,
            letterSpacing: '-0.05em',
            lineHeight: 0.85,
            color: C.retire,
            transform: `scale(${0.94 + statScale * 0.06})`,
            transformOrigin: 'left bottom',
          }}
        >
          {pct}%
        </div>
        <div
          style={{
            fontFamily: F.prose,
            fontSize: 44,
            lineHeight: 1.25,
            maxWidth: 720,
            paddingBottom: 24,
            opacity: line,
            transform: `translateY(${(1 - line) * 12}px)`,
          }}
        >
          of multi-agent failures come from agents acting on{' '}
          <span style={{ color: C.retire }}>inconsistent shared state</span>.
        </div>
      </div>

      <div style={{ fontSize: 20, color: C.ghost, marginTop: 28, opacity: line }}>
        Cemri et al., failure-mode study — summarized by O'Reilly, 2025
      </div>

      <div
        style={{
          marginTop: 72,
          paddingLeft: 24,
          borderLeft: `3px solid ${C.trace}`,
          fontFamily: F.prose,
          fontSize: 46,
          lineHeight: 1.2,
          opacity: verdict,
          transform: `translateY(${(1 - verdict) * 14}px)`,
        }}
      >
        colony8 makes that <span style={{ color: C.live }}>impossible by construction</span>.
      </div>

      <Slug left="colony8" right="transactional shared memory" />
    </Sheet>
  )
}
