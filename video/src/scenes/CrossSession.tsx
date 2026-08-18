import React from 'react'
import { AbsoluteFill, OffthreadVideo, interpolate, useCurrentFrame, Easing } from 'remotion'
import { C, F, sheetBackground } from '../tokens'
import { Eyebrow, Slug } from '../chrome'
import { SOURCE3, SRC3 } from '../Footage'

/** Cross-session injection — the beat the deck never had.

    The point this scene has to land: context is NOT loaded once when a session
    boots. `recall_colony()` sits inside the researcher's `for source in sources:`
    loop, so every single extraction is primed by what the whole colony already
    knows, and every new claim goes straight back into the same memory. One
    fleet's research feeds the next fleet's research, continuously.

    So the schematic runs a visible cycle — violet down (context in), green up
    (claim out) — four times, with a per-source counter, rather than one pulse
    at the top. */

export const CROSS_FRAMES = 660

const INJ = '#b06bff' // matches the ledger UI's --inject

const W = 700
const H = 800
const MEM_TOP = 240
const MEM_BOT = 490
const S2_TOP = 590

const ease = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) } as const
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const

/* ── the loop: one cycle per source the researcher reads ── */
const CYCLE = 110
const LOOP_START = 180
type Cycle = { source: string; result: 'ADD' | 'NOOP'; fact?: string }
const CYCLES: Cycle[] = [
  { source: 'high-altitude cooking times', result: 'ADD', fact: 'cook +25% per 1000m' },
  { source: 'boiling point reference', result: 'NOOP' },
  { source: 'hydration at elevation', result: 'ADD', fact: 'water +1.5L daily' },
  { source: 'pressure cooker guidance', result: 'NOOP' },
]

const S1_FACTS = ['boils at 100.0C', 'freezes at 0C', 'heat 4.186 J/gC', '+1C per 285m']

const cycleAt = (frame: number) => {
  const i = Math.floor((frame - LOOP_START) / CYCLE)
  if (i < 0 || i >= CYCLES.length) return null
  return { i, t: frame - LOOP_START - i * CYCLE, c: CYCLES[i] }
}

export const CrossSession: React.FC = () => {
  const frame = useCurrentFrame()

  const s1In = interpolate(frame, [0, 26], [0, 1], ease)
  const memIn = interpolate(frame, [40, 70], [0, 1], ease)
  const s1Dim = interpolate(frame, [96, 128], [1, 0.32], clamp)
  const s2In = interpolate(frame, [130, 168], [0, 1], ease)
  const videoIn = interpolate(frame, [30, 60], [0, 1], ease)
  const calloutIn = interpolate(frame, [286, 320], [0, 1], ease)

  const cyc = cycleAt(frame)
  // context travels down 0..28, the claim comes back up 55..83
  const ctxT = cyc && cyc.t >= 0 && cyc.t <= 28 ? cyc.t / 28 : null
  const outT = cyc && cyc.t >= 55 && cyc.t <= 83 ? (cyc.t - 55) / 28 : null

  const op =
    cyc && cyc.t >= 4 && cyc.t < 50
      ? { label: 'INJECT', color: INJ }
      : cyc && cyc.t >= 58 && cyc.t < 100
        ? cyc.c.result === 'ADD'
          ? { label: 'ADD', color: C.live }
          : { label: 'NOOP · already known', color: C.ghost }
        : null

  // facts land in memory as their cycle commits
  const added = CYCLES.map((c, i) => ({ c, at: LOOP_START + i * CYCLE + 83 })).filter(
    (x) => x.c.fact && frame >= x.at,
  )

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
        <Eyebrow>cross-session injection · research feeding research</Eyebrow>
      </div>

      <div style={{ display: 'flex', gap: 44, padding: '0 96px' }}>
        {/* ── left: the schematic ─────────────────────────── */}
        <div style={{ width: W, height: H, flex: 'none', position: 'relative' }}>
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
            {/* session 1 — finished, its agents gone, its claims not */}
            <g opacity={s1In * s1Dim}>
              <rect x={0} y={0} width={W} height={150} fill="none" stroke={C.ruleLit} strokeDasharray="5 5" />
              <text x={14} y={22} fill={C.ghost} fontSize={13} fontFamily={F.mono} letterSpacing="0.18em">
                SESSION 1 · WATER — ended
              </text>
              {['researcher 1', 'researcher 2', 'researcher 3'].map((n, i) => (
                <g key={n}>
                  <rect x={20} y={34 + i * 36} width={660} height={30} fill={C.sheet} stroke={C.rule} />
                  <rect x={20} y={34 + i * 36} width={3} height={30} fill={C.ruleLit} />
                  <text x={36} y={54 + i * 36} fill={C.ghost} fontSize={15} fontFamily={F.mono}>
                    {n}
                  </text>
                </g>
              ))}
            </g>

            {/* session 1's writes into memory */}
            <g opacity={memIn * 0.5}>
              {[120, 350, 580].map((x) => (
                <path
                  key={x}
                  d={`M ${x} 150 C ${x} 195, 350 200, 350 ${MEM_TOP}`}
                  fill="none"
                  stroke={C.live}
                  strokeWidth={1.5}
                  strokeDasharray="3 5"
                />
              ))}
            </g>

            {/* the one memory */}
            <g opacity={memIn}>
              <rect x={40} y={MEM_TOP} width={620} height={MEM_BOT - MEM_TOP} fill={C.sheet} stroke={C.rule} />
              <rect x={40} y={MEM_TOP} width={620} height={3} fill={C.live} />
              <text x={350} y={MEM_TOP + 28} fill={C.ink} fontSize={18} textAnchor="middle" fontFamily={F.mono}>
                one memory · CockroachDB
              </text>
              <text x={350} y={MEM_TOP + 48} fill={C.ghost} fontSize={12} textAnchor="middle" fontFamily={F.mono}>
                findings_embedding_colony_idx · every run, not just this one
              </text>

              <text x={70} y={MEM_TOP + 74} fill={C.ghost} fontSize={10} fontFamily={F.mono} letterSpacing="0.16em">
                WRITTEN BY SESSION 1
              </text>
              <text x={358} y={MEM_TOP + 74} fill={INJ} fontSize={10} fontFamily={F.mono} letterSpacing="0.16em" opacity={added.length ? 1 : 0}>
                ADDED BY SESSION 2
              </text>
              {S1_FACTS.map((f, i) => (
                <g key={f}>
                  <rect x={70} y={MEM_TOP + 84 + i * 26} width={270} height={22} fill={C.void} stroke={C.rule} />
                  <rect x={70} y={MEM_TOP + 84 + i * 26} width={2} height={22} fill={C.live} />
                  <text x={82} y={MEM_TOP + 99 + i * 26} fill={C.ghost} fontSize={12} fontFamily={F.mono}>
                    {f}
                  </text>
                </g>
              ))}
              {added.map((x, i) => (
                <g key={x.c.fact}>
                  <rect x={358} y={MEM_TOP + 84 + i * 26} width={270} height={22} fill={C.void} stroke={C.rule} />
                  <rect x={358} y={MEM_TOP + 84 + i * 26} width={2} height={22} fill={INJ} />
                  <text x={370} y={MEM_TOP + 99 + i * 26} fill={C.ink} fontSize={12} fontFamily={F.mono}>
                    {x.c.fact}
                  </text>
                </g>
              ))}

              {op && (
                <g>
                  <rect
                    x={350 - 110}
                    y={MEM_BOT - 40}
                    width={220}
                    height={26}
                    rx={13}
                    fill={op.color}
                    fillOpacity={0.14}
                    stroke={op.color}
                  />
                  <text
                    x={350}
                    y={MEM_BOT - 22}
                    fill={op.color}
                    fontSize={13}
                    textAnchor="middle"
                    fontFamily={F.mono}
                    letterSpacing="0.1em"
                  >
                    {op.label}
                  </text>
                </g>
              )}
            </g>

            {/* the cycle: violet down (context in), green up (claim out) */}
            <g opacity={s2In}>
              <path d={`M 200 ${MEM_BOT} L 200 ${S2_TOP + 28}`} stroke={INJ} strokeWidth={1.5} strokeDasharray="4 5" fill="none" />
              <path d={`M 500 ${S2_TOP + 28} L 500 ${MEM_BOT}`} stroke={C.live} strokeWidth={1.5} strokeDasharray="4 5" fill="none" />
              <text x={210} y={MEM_BOT + 44} fill={INJ} fontSize={12} fontFamily={F.mono}>
                context in
              </text>
              <text x={490} y={MEM_BOT + 44} fill={C.live} fontSize={12} fontFamily={F.mono} textAnchor="end">
                claim out
              </text>
              {ctxT !== null && (
                <circle cx={200} cy={MEM_BOT + (S2_TOP + 28 - MEM_BOT) * ctxT} r={7} fill={INJ} opacity={Math.sin(ctxT * Math.PI)} />
              )}
              {outT !== null && (
                <circle cx={500} cy={S2_TOP + 28 - (S2_TOP + 28 - MEM_BOT) * outT} r={7} fill={C.live} opacity={Math.sin(outT * Math.PI)} />
              )}
            </g>

            {/* session 2 — running now */}
            <g opacity={s2In}>
              <rect x={0} y={S2_TOP} width={W} height={H - S2_TOP - 6} fill="none" stroke={INJ} strokeDasharray="5 5" opacity={0.7} />
              <text x={14} y={S2_TOP + 22} fill={INJ} fontSize={13} fontFamily={F.mono} letterSpacing="0.18em">
                SESSION 2 · ALTITUDE — different question, same memory
              </text>
              {['researcher A', 'researcher B'].map((n, i) => {
                const lit = cyc !== null && cyc.i % 2 === i
                return (
                  <g key={n}>
                    <rect x={20} y={S2_TOP + 34 + i * 36} width={660} height={30} fill={C.sheet} stroke={C.rule} />
                    <rect x={20} y={S2_TOP + 34 + i * 36} width={3} height={30} fill={lit ? INJ : C.ruleLit} />
                    <text x={36} y={S2_TOP + 54 + i * 36} fill={lit ? C.ink : C.ghost} fontSize={15} fontFamily={F.mono}>
                      {n}
                    </text>
                  </g>
                )
              })}
              {cyc && (
                <text x={20} y={S2_TOP + 132} fill={C.ghost} fontSize={13} fontFamily={F.mono}>
                  reading source {cyc.i + 1} of {CYCLES.length} · {cyc.c.source}
                </text>
              )}
              <text x={20} y={S2_TOP + 158} fill={INJ} fontSize={13} fontFamily={F.mono} opacity={calloutIn}>
                recall_colony() runs per source — not once at session start
              </text>
            </g>
          </svg>
        </div>

        {/* ── right: the real recording of exactly this ───── */}
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
                <span key={i} style={{ width: 11, height: 11, borderRadius: '50%', background: C.ruleLit }} />
              ))}
              <span style={{ marginLeft: 14, fontSize: 16, color: C.ghost }}>
                colony8 ledger · session 2
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
              src={SOURCE3()}
              trimBefore={SRC3.inject[0]}
              trimAfter={SRC3.inject[0] + CROSS_FRAMES}
              muted
              style={{ display: 'block', width: '100%' }}
            />
          </div>
          <div style={{ fontSize: 18, color: C.ghost, marginTop: 18, fontFamily: F.prose, lineHeight: 1.45 }}>
            A new fleet, a different question, the same table. Its first ledger event is a
            violet <span style={{ color: INJ }}>INJECT</span> — and the fact it already knew
            is never written twice.
          </div>
        </div>
      </div>

      <Slug left="cross-session injection" right="one fleet's output is the next fleet's context" />
    </AbsoluteFill>
  )
}
