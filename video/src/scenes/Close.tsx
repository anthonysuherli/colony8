import React from 'react'
import { useCurrentFrame, interpolate, Easing } from 'remotion'
import { C, F } from '../tokens'
import { Sheet, Eyebrow, Slug, useCardFade, stagger } from '../chrome'

export const CLOSE_FRAMES = 240

const CARDS = [
  ['repo', 'github.com/anthonysuherli/colony8', 'MIT · 26 tests · free tier'],
  ['live demo', 'CloudFront replay', 'a completed run, fully recalled'],
  ['run it yourself', './scripts/dev_db.sh', 'a full local run takes about a minute'],
]

export const Close: React.FC = () => {
  const frame = useCurrentFrame()
  const opacity = useCardFade(CLOSE_FRAMES)
  const title = interpolate(frame, [8, 34], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  })

  return (
    <Sheet opacity={opacity}>
      <Eyebrow>colony8</Eyebrow>

      <div
        style={{
          fontFamily: F.prose,
          fontSize: 112,
          fontWeight: 700,
          letterSpacing: '-0.045em',
          lineHeight: 1,
          opacity: title,
          transform: `translateY(${(1 - title) * 16}px)`,
          marginTop: 40,
        }}
      >
        One memory.
        <br />
        <span style={{ color: C.live }}>Nothing lost.</span>
      </div>

      <div
        style={{
          fontFamily: F.prose,
          fontSize: 30,
          lineHeight: 1.4,
          color: C.ghost,
          maxWidth: 1100,
          marginTop: 34,
          opacity: stagger(frame, 0, 46, 0, 24),
        }}
      >
        Stateless agents on Bedrock, one CockroachDB table, every write resolved inside a
        serializable transaction — with a full audit chain behind every live fact.
      </div>

      <div style={{ display: 'flex', gap: 24, marginTop: 60 }}>
        {CARDS.map((c, i) => {
          const o = stagger(frame, i, 78, 16, 22)
          return (
            <div
              key={c[0]}
              style={{
                flex: 1,
                background: C.sheet,
                border: `1px solid ${C.rule}`,
                borderTop: `3px solid ${i === 0 ? C.live : C.rule}`,
                padding: '22px 26px',
                opacity: o,
                transform: `translateY(${(1 - o) * 12}px)`,
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  color: C.ghost,
                  marginBottom: 12,
                }}
              >
                {c[0]}
              </div>
              <div style={{ fontSize: 22, color: C.ink }}>{c[1]}</div>
              <div style={{ fontSize: 16, color: C.ghost, marginTop: 6 }}>{c[2]}</div>
            </div>
          )
        })}
      </div>

      <Slug left="thank you" right="colony8" />
    </Sheet>
  )
}
