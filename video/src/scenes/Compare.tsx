import React from 'react'
import { useCurrentFrame } from 'remotion'
import { C, F } from '../tokens'
import { Sheet, Eyebrow, Slug, useCardFade, stagger } from '../chrome'

export const COMPARE_FRAMES = 420

const INJ = '#b06bff'

/** Measured by scripts/compare.py: one store, one embedder, one classifier, 246
    contradicting writes over 100 facts; only the resolution algorithm differs. */
type Row = { name: string; answer: string; stale: string; lost: string; accent?: string }
const ROWS: Row[] = [
  { name: 'Zep / Graphiti-style', answer: '94%', stale: '0.1', lost: '0', accent: INJ },
  { name: 'colony8', answer: '88%', stale: '0.1', lost: '0', accent: C.live },
  { name: 'Mem0-style', answer: '88%', stale: '0.1', lost: '222' },
  { name: 'vector store, append-only', answer: '88%', stale: '1.1', lost: '0' },
  { name: 'Letta / MemGPT-style', answer: '79%', stale: '0.2', lost: '198' },
]

const GRID = {
  display: 'grid',
  gridTemplateColumns: '380px 190px 240px 200px',
  gap: '0 28px',
  alignItems: 'baseline',
} as const

export const Compare: React.FC = () => {
  const frame = useCurrentFrame()
  const opacity = useCardFade(COMPARE_FRAMES)
  const head = stagger(frame, 0, 20)

  return (
    <Sheet opacity={opacity}>
      <Eyebrow>measured, not asserted · scripts/compare.py</Eyebrow>
      <div
        style={{
          fontFamily: F.prose,
          fontSize: 44,
          fontWeight: 700,
          letterSpacing: '-0.03em',
          marginBottom: 10,
        }}
      >
        We benchmarked ourselves against the field
      </div>
      <div style={{ fontSize: 20, color: C.ghost, marginBottom: 34, fontFamily: F.prose }}>
        Same store, same embedder, same classifier — only the resolution algorithm differs.
      </div>

      <div style={{ ...GRID, opacity: head }}>
        <Th>{'resolution algorithm'}</Th>
        <Th>{'final answer'}</Th>
        <Th>{'stale rows in context'}</Th>
        <Th>{'values lost'}</Th>
      </div>

      {ROWS.map((r, i) => {
        const o = stagger(frame, i, 44, 22, 24)
        const lit = r.accent ?? C.ghost
        return (
          <div
            key={r.name}
            style={{
              ...GRID,
              padding: '18px 0',
              borderBottom: `1px solid ${C.rule}`,
              opacity: o,
              transform: `translateY(${(1 - o) * 10}px)`,
            }}
          >
            <div style={{ fontSize: 21, color: r.accent ? C.ink : C.ghost }}>
              <span style={{ color: lit, marginRight: 12 }}>▍</span>
              {r.name}
            </div>
            <div style={{ fontSize: 26, color: lit }}>{r.answer}</div>
            <div style={{ fontSize: 26, color: r.stale === '1.1' ? C.fence : C.ink }}>
              {r.stale}
            </div>
            <div style={{ fontSize: 26, color: r.lost === '0' ? C.ink : C.retire }}>
              {r.lost}
            </div>
          </div>
        )
      })}

      <div
        style={{
          fontSize: 21,
          color: C.ink,
          marginTop: 26,
          fontFamily: F.prose,
          lineHeight: 1.5,
          opacity: stagger(frame, 6, 44, 22, 24),
        }}
      >
        <span style={{ color: INJ }}>Zep's bi-temporal model beats us</span> — it records
        when a fact was <i>true</i>, not just when it was written. That one shape is the
        whole 6-point gap, and it is on our roadmap.
        <br />
        <span style={{ color: C.live }}>Where we hold up:</span> nothing is ever lost, and
        a reader gets one live fact instead of four to disambiguate.
      </div>

      <Slug left="differentiation" right="reimplemented algorithms · no vendor code run" />
    </Sheet>
  )
}

const Th: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color }) => (
  <div
    style={{
      fontSize: 14,
      letterSpacing: '0.18em',
      textTransform: 'uppercase',
      color: color ?? C.ghost,
      paddingBottom: 14,
      borderBottom: `1px solid ${C.ruleLit}`,
    }}
  >
    {children}
  </div>
)
