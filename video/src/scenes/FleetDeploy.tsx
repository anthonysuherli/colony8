import React from 'react'
import { AbsoluteFill, OffthreadVideo, interpolate, useCurrentFrame, Easing } from 'remotion'
import { C, F, sheetBackground } from '../tokens'
import { Eyebrow, Slug } from '../chrome'
import { SOURCE, SRC } from '../Footage'

export const FLEET_FRAMES = 360

/* ── geometry: one 640x620 canvas shared by wires and boxes ── */
const CW = 600
const CH = 720
const NODE_H = 84
const PLANE_H = 580

const planner = { right: 150, cy: 100 }
const researchers = [
  { cy: 210, name: 'researcher 1', topic: 'boiling point · sea level' },
  { cy: 350, name: 'researcher 2', topic: 'pressure dependence' },
  { cy: 490, name: 'researcher 3', topic: 'reference standards' },
]
const MEM_TOP = 615

type Pt = [number, number]
const fanWire = (cy: number): [Pt, Pt, Pt, Pt] => [
  [150, 100],
  [215, 100],
  [215, cy],
  [280, cy],
]
const writeWire = (cy: number): [Pt, Pt, Pt, Pt] => [
  [480, cy],
  [556, cy],
  [556, MEM_TOP],
  [300, MEM_TOP],
]

const d = ([p0, p1, p2, p3]: [Pt, Pt, Pt, Pt]) =>
  `M ${p0[0]} ${p0[1]} C ${p1[0]} ${p1[1]}, ${p2[0]} ${p2[1]}, ${p3[0]} ${p3[1]}`

/** Point on a cubic bezier — packets are positioned per frame, not by CSS. */
const at = ([p0, p1, p2, p3]: [Pt, Pt, Pt, Pt], t: number): Pt => {
  const u = 1 - t
  const a = u * u * u
  const b = 3 * u * u * t
  const c = 3 * u * t * t
  const e = t * t * t
  return [
    a * p0[0] + b * p1[0] + c * p2[0] + e * p3[0],
    a * p0[1] + b * p1[1] + c * p2[1] + e * p3[1],
  ]
}

const ease = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) } as const
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const

/** `videoSrc`/`videoFrom` let the deck-flow cut pull the same launch beat from the
    current 2:39 master instead of the older 2:27 one. Launch happens to sit at the
    same offset in both, so the defaults stay correct for the v2 timeline. */
export const FleetDeploy: React.FC<{ videoSrc?: string; videoFrom?: number }> = ({
  videoSrc,
  videoFrom,
}) => {
  const frame = useCurrentFrame()
  const vSrc = videoSrc ?? SOURCE()
  const vFrom = videoFrom ?? SRC.launch[0]

  const plane = interpolate(frame, [0, 20], [0, 1], clamp)
  const plannerIn = interpolate(frame, [20, 42], [0, 1], ease)
  const memoryLit = interpolate(frame, [170, 200], [0.3, 1], clamp)
  const videoIn = interpolate(frame, [24, 48], [0, 1], ease)

  return (
    <AbsoluteFill
      style={{
        background: sheetBackground,
        color: C.ink,
        fontFamily: F.mono,
        justifyContent: 'center',
        paddingBottom: 60,
      }}
    >
      <div style={{ padding: '0 96px' }}>
        <Eyebrow>the fleet deploys · one memory absorbs every write</Eyebrow>
      </div>

      <div style={{ display: 'flex', gap: 44, padding: '0 96px' }}>
        {/* ── left: the fleet on Bedrock ───────────────────── */}
        <div style={{ position: 'relative', width: CW, height: CH, flex: 'none' }}>
          {/* the Bedrock plane */}
          <div
            style={{
              position: 'absolute',
              inset: `0 0 ${CH - PLANE_H}px 0`,
              border: `1px dashed ${C.ruleLit}`,
              opacity: plane,
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: -12,
                left: 20,
                background: C.void,
                padding: '0 12px',
                fontSize: 15,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: C.fence,
              }}
            >
              Amazon Bedrock · stateless
            </span>
          </div>

          <svg viewBox={`0 0 ${CW} ${CH}`} width={CW} height={CH} style={{ position: 'absolute', inset: 0 }}>
            {researchers.map((r, i) => {
              const p = interpolate(frame, [48 + i * 12, 88 + i * 12], [0, 1], ease)
              return (
                <path
                  key={`f${i}`}
                  d={d(fanWire(r.cy))}
                  fill="none"
                  stroke={C.ruleLit}
                  strokeWidth={2}
                  strokeDasharray={400}
                  strokeDashoffset={400 * (1 - p)}
                />
              )
            })}
            {researchers.map((r, i) => {
              const p = interpolate(frame, [148 + i * 12, 190 + i * 12], [0, 1], ease)
              return (
                <path
                  key={`w${i}`}
                  d={d(writeWire(r.cy))}
                  fill="none"
                  stroke={C.live}
                  strokeWidth={2}
                  opacity={0.45}
                  strokeDasharray={520}
                  strokeDashoffset={520 * (1 - p)}
                />
              )
            })}
            {/* write packets travelling into memory */}
            {researchers.map((r, i) => {
              if (frame < 190 + i * 12) return null
              const period = 46
              const t = (((frame - 190 - i * 12) % period) + period) % period
              const prog = t / period
              const [x, y] = at(writeWire(r.cy), prog)
              const fade = Math.sin(prog * Math.PI)
              return <circle key={`p${i}`} cx={x} cy={y} r={6} fill={C.live} opacity={fade} />
            })}
          </svg>

          <Node
            style={{ left: 0, top: planner.cy - NODE_H / 2, width: planner.right, borderLeftColor: C.trace }}
            opacity={plannerIn}
            name="planner"
            note="decomposes the question"
          />

          {researchers.map((r, i) => {
            const o = interpolate(frame, [52 + i * 12, 84 + i * 12], [0, 1], ease)
            const wrote = frame > 150 + i * 12
            const busy = frame > 95 && frame <= 150 + i * 12
            return (
              <Node
                key={r.name}
                style={{
                  left: 280,
                  top: r.cy - NODE_H / 2,
                  width: 200,
                  borderLeftColor: wrote ? C.live : busy ? C.fence : C.ruleLit,
                }}
                opacity={o}
                name={r.name}
                note={r.topic}
              />
            )
          })}

          <div
            style={{
              position: 'absolute',
              top: MEM_TOP,
              left: 110,
              width: 380,
              height: 84,
              background: C.sheet,
              border: `1px solid ${C.rule}`,
              borderTop: `3px solid ${C.live}`,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              opacity: memoryLit,
            }}
          >
            <span style={{ fontSize: 21, color: C.ink }}>one memory · CockroachDB</span>
            <span style={{ fontSize: 15, color: C.ghost }}>SERIALIZABLE · version-fenced</span>
          </div>
        </div>

        {/* ── right: the real session, recorded ────────────── */}
        <div style={{ flex: 1, opacity: videoIn, transform: `translateY(${(1 - videoIn) * 16}px)` }}>
          <div style={{ border: `1px solid ${C.rule}`, background: C.sheet }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                padding: '13px 18px',
                borderBottom: `1px solid ${C.rule}`,
              }}
            >
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  style={{ width: 11, height: 11, borderRadius: '50%', background: C.ruleLit }}
                />
              ))}
              <span style={{ marginLeft: 14, fontSize: 16, color: C.ghost }}>
                colony8 ledger · live run
              </span>
              <span
                style={{
                  marginLeft: 'auto',
                  fontSize: 13,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: C.live,
                }}
              >
                ● real recording
              </span>
            </div>
            <OffthreadVideo
              src={vSrc}
              trimBefore={vFrom}
              trimAfter={vFrom + FLEET_FRAMES}
              muted
              style={{ display: 'block', width: '100%' }}
            />
          </div>
          <div style={{ fontSize: 18, color: C.ghost, marginTop: 18, fontFamily: F.prose }}>
            Findings stream into the ledger as each agent writes. Nothing is buffered in
            the agents.
          </div>
        </div>
      </div>

      <Slug left="fleet deploy" right="planner + 3 researchers · one table" />
    </AbsoluteFill>
  )
}

const Node: React.FC<{
  style: React.CSSProperties
  opacity: number
  name: string
  note: string
}> = ({ style, opacity, name, note }) => (
  <div
    style={{
      position: 'absolute',
      height: NODE_H,
      background: C.sheet,
      border: `1px solid ${C.rule}`,
      borderLeftWidth: 3,
      borderLeftStyle: 'solid',
      padding: '0 16px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      gap: 4,
      opacity,
      transform: `translateY(${(1 - opacity) * 8}px)`,
      ...style,
    }}
  >
    <span style={{ fontSize: 19, color: C.ink, lineHeight: 1.2 }}>{name}</span>
    <span style={{ fontSize: 14, color: C.ghost, lineHeight: 1.2 }}>{note}</span>
  </div>
)
