import React from 'react'
import { interpolate, Easing } from 'remotion'
import { C, F } from './tokens'

/** The context anchor: every agent as its own lane, each wired to the one
    CockroachDB memory — session membership is just a tag on the agent card.
    Docked beside the footage from launch (0:09) until the inject beat resolves
    (1:20). Every state below is keyed to ABSOLUTE frames of the 2:39 cut at
    30fps, so the panel narrates exactly what is on screen. */

export const DOCK_IN = 270 // 0:09 — fleet launches
export const DOCK_OUT = 2400 // 1:20 — resolver card takes over

const INJ = '#b06bff' // matches the ledger UI's --inject

type Pt = [number, number]
type Wire = [Pt, Pt, Pt, Pt]

const at = ([p0, p1, p2, p3]: Wire, t: number): Pt => {
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
const d = ([p0, p1, p2, p3]: Wire) =>
  `M ${p0[0]} ${p0[1]} C ${p1[0]} ${p1[1]}, ${p2[0]} ${p2[1]}, ${p3[0]} ${p3[1]}`

type Agent = {
  name: string
  tag: string
  y: number
  session: 1 | 2
  appears?: number
}
const AGENTS: Agent[] = [
  { name: 'planner', tag: 'session 1 · water', y: 40, session: 1 },
  { name: 'researcher 1', tag: 'session 1 · water', y: 100, session: 1 },
  { name: 'researcher 2', tag: 'session 1 · water', y: 160, session: 1 },
  { name: 'researcher 3', tag: 'session 1 · water', y: 220, session: 1 },
  { name: 'researcher A', tag: 'session 2 · altitude', y: 420, session: 2, appears: 1785 },
  { name: 'researcher B', tag: 'session 2 · altitude', y: 480, session: 2, appears: 1800 },
]
const cy = (a: Agent) => a.y + 22

const wireOut = (a: Agent, entry: number): Wire => [
  [196, cy(a)],
  [224, cy(a)],
  [228, entry],
  [256, entry],
]
const wireIn = (a: Agent, exit: number): Wire => [
  [256, exit],
  [228, exit],
  [224, cy(a)],
  [196, cy(a)],
]

/** Parallel sessions beyond the recorded one — schematic, drawn at reduced
    opacity: the same injection reaches every session the colony spawns. */
type Ghost = { label: string; y: number; appears: number; pkt: number; exit: number }
const GHOSTS: Ghost[] = [
  { label: 'researcher · session 3', y: 536, appears: 1950, pkt: 1980, exit: 480 },
  { label: 'researcher · session 4', y: 570, appears: 1965, pkt: 2012, exit: 505 },
  { label: 'researcher · session N', y: 604, appears: 1980, pkt: 2044, exit: 530 },
]
const gcy = (g: Ghost) => g.y + 13
const ghostWire = (g: Ghost): Wire => [
  [256, g.exit],
  [228, g.exit],
  [224, gcy(g)],
  [196, gcy(g)],
]

const PKT = 22 // frames a packet spends on the wire

type Fact = { label: string; arrive: number; retiredAt?: number }
const FACTS: Fact[] = [
  { label: 'boils at 90C', arrive: 412, retiredAt: 667 },
  { label: 'freezes at 0C', arrive: 502 },
  { label: 'heat 4.186 J/gC', arrive: 582 },
  { label: 'boils at 100.0C', arrive: 667 },
  { label: '+1C per 285m', arrive: 772 },
  { label: 'cook +25%/1000m', arrive: 2050 },
  { label: 'water +1.5L/day', arrive: 2170 },
]

type Packet = { wire: Wire; start: number; color: string }
const PACKETS: Packet[] = [
  { wire: wireOut(AGENTS[1], 180), start: 390, color: C.live },
  { wire: wireOut(AGENTS[2], 190), start: 480, color: C.live },
  { wire: wireOut(AGENTS[3], 200), start: 560, color: C.live },
  { wire: wireOut(AGENTS[1], 180), start: 645, color: C.retire },
  { wire: wireOut(AGENTS[2], 190), start: 750, color: C.live },
  { wire: wireIn(AGENTS[4], 430), start: 1866, color: INJ },
  { wire: wireIn(AGENTS[5], 460), start: 1920, color: INJ },
  { wire: wireOut(AGENTS[4], 430), start: 2028, color: C.live },
  { wire: wireOut(AGENTS[5], 460), start: 2148, color: C.live },
]

type Op = { label: string; color: string; from: number; to: number }
const OPS: Op[] = [
  { label: 'ADD', color: C.live, from: 412, to: 470 },
  { label: 'ADD', color: C.live, from: 502, to: 555 },
  { label: 'ADD', color: C.live, from: 582, to: 640 },
  { label: 'SUPERSEDE', color: C.retire, from: 667, to: 745 },
  { label: 'ADD', color: C.live, from: 772, to: 850 },
  { label: 'INJECT', color: INJ, from: 1888, to: 2020 },
  { label: 'ADD', color: C.live, from: 2050, to: 2140 },
  { label: 'ADD', color: C.live, from: 2170, to: 2280 },
]

const ease = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) } as const
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const

export const AnchorPanel: React.FC<{ frame: number; slide: number }> = ({ frame, slide }) => {
  const s1Dim = interpolate(frame, [1020, 1055], [1, 0.35], clamp)
  const dbGlow =
    frame >= 1030 && frame <= 1260 ? 0.55 + 0.45 * Math.sin((frame - 1030) / 7) : 1

  const active = OPS.filter((o) => frame >= o.from && frame < o.to)
  const op = active.length ? active[active.length - 1] : undefined
  const facts = FACTS.filter((f) => frame >= f.arrive)
  const s2Any = interpolate(frame, [1785, 1815], [0, 1], ease)

  return (
    <div
      style={{
        position: 'absolute',
        top: 200,
        right: 16,
        width: 484,
        background: C.sheet,
        border: `1px solid ${C.rule}`,
        padding: '18px 16px 14px',
        opacity: slide,
        transform: `translateX(${(1 - slide) * 520}px)`,
        fontFamily: F.mono,
      }}
    >
      <div
        style={{
          fontSize: 13,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: C.ghost,
          marginBottom: 10,
        }}
      >
        context anchor · agents share one memory
      </div>
      <svg viewBox="0 0 452 648" width={452} height={648} style={{ display: 'block' }}>
        {[wireOut(AGENTS[1], 180), wireOut(AGENTS[2], 190), wireOut(AGENTS[3], 200)].map(
          (w, i) => (
            <path
              key={`ww${i}`}
              d={d(w)}
              fill="none"
              stroke={C.ruleLit}
              strokeWidth={1}
              strokeDasharray="3 5"
              opacity={s1Dim}
            />
          ),
        )}
        {[wireIn(AGENTS[4], 430), wireIn(AGENTS[5], 460)].map((w, i) => (
          <path
            key={`iw${i}`}
            d={d(w)}
            fill="none"
            stroke={C.ruleLit}
            strokeWidth={1}
            strokeDasharray="3 5"
            opacity={s2Any}
          />
        ))}

        {AGENTS.map((a, i) => {
          const born = a.appears
            ? interpolate(frame, [a.appears, a.appears + 25], [0, 1], ease)
            : 1
          const dim = a.session === 1 ? s1Dim : 1
          const injected =
            (a.name === 'researcher A' && frame >= 1888) ||
            (a.name === 'researcher B' && frame >= 1942)
          const accent = a.session === 1 ? C.trace : injected ? INJ : C.ruleLit
          const killed = a.session === 1
            ? interpolate(frame, [1020 + i * 6, 1044 + i * 6], [0, 1], ease)
            : 0
          return (
            <g key={a.name} opacity={born * (a.session === 1 ? Math.max(dim, 0.35) : 1)}>
              <rect x={16} y={a.y} width={180} height={44} fill={C.sheet} stroke={C.rule} strokeWidth={1} />
              <rect x={16} y={a.y} width={3} height={44} fill={accent} />
              <text x={30} y={a.y + 19} fill={C.ink} fontSize={15} fontFamily={F.mono}>
                {a.name}
              </text>
              <text x={30} y={a.y + 36} fill={a.session === 2 && injected ? INJ : C.ghost} fontSize={12} fontFamily={F.mono}>
                {a.tag}
              </text>
              {killed > 0 && (
                <line
                  x1={22}
                  y1={cy(a)}
                  x2={22 + 168 * killed}
                  y2={cy(a)}
                  stroke={C.retire}
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              )}
            </g>
          )
        })}

        <rect x={256} y={20} width={180} height={540} fill={C.sheet} stroke={C.rule} strokeWidth={1} />
        <rect x={256} y={20} width={180} height={3} fill={C.live} opacity={dbGlow} />
        <text x={346} y={48} fill={C.ink} fontSize={16} fontFamily={F.mono} textAnchor="middle">
          one memory
        </text>
        <text x={346} y={66} fill={C.ghost} fontSize={12} fontFamily={F.mono} textAnchor="middle">
          CockroachDB · SERIALIZABLE
        </text>
        {op && (
          <g>
            <rect
              x={296}
              y={78}
              width={100}
              height={24}
              rx={12}
              fill={op.color}
              fillOpacity={0.14}
              stroke={op.color}
              strokeWidth={1}
            />
            <text x={346} y={95} fill={op.color} fontSize={13} fontFamily={F.mono} textAnchor="middle" letterSpacing="0.1em">
              {op.label}
            </text>
          </g>
        )}
        {facts.map((f) => {
          const i = FACTS.indexOf(f)
          const y = 112 + i * 30
          const retired = f.retiredAt !== undefined && frame >= f.retiredAt
          const o = interpolate(frame, [f.arrive, f.arrive + 8], [0, 1], clamp)
          return (
            <g key={f.label} opacity={o}>
              <rect x={268} y={y} width={156} height={24} fill={C.void} stroke={C.rule} strokeWidth={1} />
              <rect x={268} y={y} width={3} height={24} fill={retired ? C.retire : C.live} />
              <text
                x={280}
                y={y + 16}
                fill={retired ? C.ghost : C.ink}
                fontSize={13}
                fontFamily={F.mono}
                opacity={retired ? 0.75 : 1}
              >
                {f.label}
              </text>
              {retired && <line x1={276} y1={y + 12} x2={388} y2={y + 12} stroke={C.retire} strokeWidth={1.5} />}
            </g>
          )
        })}
        <text
          x={346}
          y={415}
          fill={C.ghost}
          fontSize={12}
          fontFamily={F.mono}
          textAnchor="middle"
          opacity={s2Any}
        >
          colony-wide recall
        </text>
        {GHOSTS.map((g) => {
          const born = interpolate(frame, [g.appears, g.appears + 25], [0, 0.55], ease)
          const injected = frame >= g.pkt + PKT
          return (
            <g key={g.label} opacity={born}>
              <path d={d(ghostWire(g))} fill="none" stroke={C.ruleLit} strokeWidth={1} strokeDasharray="3 5" />
              <rect
                x={16}
                y={g.y}
                width={180}
                height={26}
                fill="none"
                stroke={C.ruleLit}
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <rect x={16} y={g.y} width={3} height={26} fill={injected ? INJ : C.ruleLit} />
              <text x={30} y={g.y + 17} fill={C.ghost} fontSize={12} fontFamily={F.mono}>
                {g.label}
              </text>
            </g>
          )
        })}
        <text
          x={346}
          y={596}
          fill={INJ}
          fontSize={13}
          fontFamily={F.mono}
          textAnchor="middle"
          opacity={frame >= 1888 ? 1 : 0}
        >
          grounded reasoning scales —
        </text>
        <text
          x={346}
          y={614}
          fill={C.ghost}
          fontSize={12}
          fontFamily={F.mono}
          textAnchor="middle"
          opacity={frame >= 1888 ? 1 : 0}
        >
          new agents start grounded
        </text>

        {PACKETS.map((p, i) => {
          if (frame < p.start || frame > p.start + PKT) return null
          const prog = (frame - p.start) / PKT
          const [x, y] = at(p.wire, prog)
          return <circle key={`pk${i}`} cx={x} cy={y} r={6} fill={p.color} opacity={Math.sin(prog * Math.PI)} />
        })}
      </svg>
    </div>
  )
}
