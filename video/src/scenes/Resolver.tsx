import React from 'react'
import { interpolate, useCurrentFrame, Easing } from 'remotion'
import { C, F } from '../tokens'
import { Sheet, Eyebrow, Slug, useCardFade } from '../chrome'

export const RESOLVER_FRAMES = 420

const ease = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) } as const
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const

/** A candidate walking the resolver: phase 1 outside any txn, phase 2 inside one. */
export const Resolver: React.FC = () => {
  const frame = useCurrentFrame()
  const opacity = useCardFade(RESOLVER_FRAMES)

  const p1 = interpolate(frame, [10, 34], [0, 1], ease)
  const recall = interpolate(frame, [40, 64], [0, 1], ease)
  const classify = interpolate(frame, [76, 100], [0, 1], ease)
  const p2 = interpolate(frame, [118, 146], [0, 1], ease)
  const lock = interpolate(frame, [152, 178], [0, 1], ease)
  const verify = interpolate(frame, [192, 218], [0, 1], ease)
  const outs = interpolate(frame, [244, 272], [0, 1], ease)
  const glow = interpolate(frame, [300, 330, 380], [0, 1, 1], clamp)

  return (
    <Sheet opacity={opacity}>
      <Eyebrow>the core · write-time resolver</Eyebrow>
      <div
        style={{
          fontFamily: F.prose,
          fontSize: 46,
          fontWeight: 700,
          letterSpacing: '-0.03em',
          marginBottom: 40,
        }}
      >
        Classify outside the transaction. Verify inside it.
      </div>

      <Phase
        label="phase 1 · no transaction, no lock"
        labelColor={C.ghost}
        opacity={p1}
        accent={C.rule}
        stages={[
          { on: recall, name: 'recall', note: 'vector search, k=5', accent: C.trace },
          { on: classify, name: 'classify', note: 'ADD · UPDATE · NOOP · SUPERSEDE', accent: C.trace },
        ]}
      />

      <div style={{ height: 26, display: 'flex', alignItems: 'center', paddingLeft: 34 }}>
        <span style={{ fontSize: 26, color: p2 > 0.4 ? C.live : C.ruleLit }}>↓</span>
      </div>

      <Phase
        label="phase 2 · one SERIALIZABLE transaction"
        labelColor={C.fence}
        opacity={p2}
        accent={C.fence}
        glow={glow}
        stages={[
          { on: lock, name: 'SELECT … FOR UPDATE', note: 're-read the target row', accent: C.fence },
          { on: verify, name: 'verify + apply', note: 'version == snapshot?', accent: C.live },
        ]}
      />

      <div style={{ display: 'flex', gap: 20, marginTop: 30, opacity: outs }}>
        <Out accent={C.trace} text="version drift → re-snapshot, re-classify" />
        <Out accent={C.fence} text="retries exhausted → DEFERRED, never dropped" />
        <Out accent={C.live} text="committed → 1 live fact, loser retired with chain" lit={glow} />
      </div>

      <Slug left="resolver" right="supersede never deletes" />
    </Sheet>
  )
}

const Phase: React.FC<{
  label: string
  labelColor: string
  opacity: number
  accent: string
  glow?: number
  stages: { on: number; name: string; note: string; accent: string }[]
}> = ({ label, labelColor, opacity, accent, glow = 0, stages }) => (
  <div
    style={{
      border: `1px solid ${C.rule}`,
      borderLeft: `3px solid ${accent}`,
      background: C.sheet,
      padding: '22px 26px 26px',
      opacity,
      boxShadow: glow ? `0 0 ${52 * glow}px rgba(255, 194, 71, ${0.18 * glow})` : 'none',
    }}
  >
    <div
      style={{
        fontSize: 16,
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        color: labelColor,
        marginBottom: 20,
      }}
    >
      {label}
    </div>
    <div style={{ display: 'flex', alignItems: 'stretch', gap: 20 }}>
      {stages.map((s, i) => (
        <React.Fragment key={s.name}>
          {i > 0 ? (
            <span style={{ alignSelf: 'center', fontSize: 24, color: s.on > 0.3 ? C.live : C.ruleLit }}>
              →
            </span>
          ) : null}
          <div
            style={{
              flex: 1,
              border: `1px solid ${C.rule}`,
              borderLeft: `3px solid ${s.on > 0.3 ? s.accent : C.ruleLit}`,
              background: s.on > 0.3 ? 'rgba(91, 141, 255, 0.07)' : 'transparent',
              padding: '16px 20px',
              opacity: 0.4 + s.on * 0.6,
            }}
          >
            <div style={{ fontSize: 24, color: C.ink }}>{s.name}</div>
            <div style={{ fontSize: 16, color: C.ghost, marginTop: 5 }}>{s.note}</div>
          </div>
        </React.Fragment>
      ))}
    </div>
  </div>
)

const Out: React.FC<{ accent: string; text: string; lit?: number }> = ({ accent, text, lit = 0 }) => (
  <div
    style={{
      flex: 1,
      border: `1px solid ${C.rule}`,
      borderTop: `3px solid ${accent}`,
      padding: '14px 18px',
      fontSize: 17,
      lineHeight: 1.4,
      color: lit > 0.5 ? C.ink : C.ghost,
      background: lit > 0.5 ? 'rgba(53, 240, 168, 0.07)' : 'transparent',
    }}
  >
    {text}
  </div>
)
