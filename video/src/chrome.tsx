import React from 'react'
import { AbsoluteFill, interpolate, useCurrentFrame, Easing } from 'remotion'
import { C, F, sheetBackground } from './tokens'

/** Fade a card in at its head and out at its tail. */
export const useCardFade = (durationInFrames: number, fade = 12) => {
  const frame = useCurrentFrame()
  return interpolate(
    frame,
    [0, fade, durationInFrames - fade, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  )
}

/** Staggered reveal — 0..1 for the nth item. Pure, so it is safe inside a map. */
export const stagger = (frame: number, index: number, startAt: number, every = 7, over = 16) =>
  interpolate(frame, [startAt + index * every, startAt + index * every + over], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  })

export const Sheet: React.FC<{
  children: React.ReactNode
  opacity?: number
}> = ({ children, opacity = 1 }) => (
  <AbsoluteFill
    style={{
      background: sheetBackground,
      color: C.ink,
      fontFamily: F.mono,
      // centred vertically so a 16:9 frame does not read as top-heavy;
      // the slug is absolutely positioned and sits below this box.
      justifyContent: 'center',
      padding: '80px 96px 128px',
      opacity,
    }}
  >
    {children}
  </AbsoluteFill>
)

export const Eyebrow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      fontSize: 17,
      letterSpacing: '0.22em',
      textTransform: 'uppercase',
      color: C.ghost,
      marginBottom: 30,
    }}
  >
    {children}
  </div>
)

export const Slug: React.FC<{ left: string; right: string }> = ({ left, right }) => (
  <div
    style={{
      position: 'absolute',
      bottom: 44,
      left: 96,
      right: 96,
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 15,
      letterSpacing: '0.18em',
      textTransform: 'uppercase',
      color: C.ghost,
      borderTop: `1px solid ${C.rule}`,
      paddingTop: 16,
    }}
  >
    <span>{left}</span>
    <span>{right}</span>
  </div>
)

export const Panel: React.FC<{
  title?: string
  accent?: string
  style?: React.CSSProperties
  children: React.ReactNode
}> = ({ title, accent, style, children }) => (
  <div
    style={{
      background: C.sheet,
      border: `1px solid ${C.rule}`,
      ...(accent ? { borderLeft: `3px solid ${accent}` } : {}),
      padding: '22px 26px',
      ...style,
    }}
  >
    {title ? (
      <div
        style={{
          fontSize: 14,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: C.ghost,
          marginBottom: 14,
        }}
      >
        {title}
      </div>
    ) : null}
    {children}
  </div>
)

/** Provenance badge over real footage. Deliberately top-right and terse: the
    source recording already carries burned-in captions along the bottom, so a
    second caption there would collide with them. */
export const FootageTag: React.FC<{ kind: string }> = ({ kind }) => {
  const frame = useCurrentFrame()
  const o = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: 'clamp' })
  const pulse = 0.55 + 0.45 * Math.sin((frame / 30) * Math.PI)
  return (
    <div
      style={{
        position: 'absolute',
        right: 44,
        top: 40,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: 'rgba(7, 10, 15, 0.78)',
        border: `1px solid ${C.rule}`,
        padding: '9px 16px',
        opacity: o,
        backdropFilter: 'blur(6px)',
      }}
    >
      <span
        style={{
          width: 9,
          height: 9,
          borderRadius: '50%',
          background: C.live,
          opacity: pulse,
        }}
      />
      <span
        style={{
          fontSize: 15,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: C.ink,
        }}
      >
        {kind}
      </span>
    </div>
  )
}
