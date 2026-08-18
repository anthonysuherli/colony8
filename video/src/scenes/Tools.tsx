import React from 'react'
import { useCurrentFrame } from 'remotion'
import { C, F } from '../tokens'
import { Sheet, Eyebrow, Slug, useCardFade, stagger } from '../chrome'

export const TOOLS_FRAMES = 360

const TOOLS = [
  ['CockroachDB Distributed Vector Indexing', 'semantic recall before every write, feeding the resolver', C.live],
  ['CockroachDB Cloud Managed MCP Server', "the audit agent's only access path — read-only SQL", C.live],
  ['ccloud CLI', 'scripted cluster + scoped SQL user provisioning', C.live],
  ['Amazon Bedrock', 'planner / researcher / classifier LLM, Titan v2 embeddings', C.fence],
  ['AWS Lambda', 'stateless container runtime for the API and replay', C.fence],
  ['Amazon S3 + CloudFront', 'static hosting and CDN for the ledger UI', C.fence],
]

export const Tools: React.FC = () => {
  const frame = useCurrentFrame()
  const opacity = useCardFade(TOOLS_FRAMES)
  const note = stagger(frame, 0, 210, 0, 26)

  return (
    <Sheet opacity={opacity}>
      <Eyebrow>required tools · every one load-bearing</Eyebrow>
      <div
        style={{
          fontFamily: F.prose,
          fontSize: 46,
          fontWeight: 700,
          letterSpacing: '-0.03em',
          marginBottom: 36,
        }}
      >
        Nothing here is decorative
      </div>

      {TOOLS.map((t, i) => {
        const o = stagger(frame, i, 26, 20, 22)
        return (
          <div
            key={t[0] as string}
            style={{
              display: 'grid',
              gridTemplateColumns: '620px 1fr',
              gap: 36,
              padding: '18px 0',
              borderBottom: `1px solid ${C.rule}`,
              opacity: o,
              transform: `translateX(${(1 - o) * 12}px)`,
            }}
          >
            <div style={{ fontSize: 21, color: t[2] as string }}>{t[0]}</div>
            <div style={{ fontSize: 19, color: C.ghost }}>{t[1]}</div>
          </div>
        )
      })}

      <div
        style={{
          marginTop: 34,
          border: `1px solid ${C.rule}`,
          borderLeft: `3px solid ${C.trace}`,
          background: C.sheet,
          padding: '20px 24px',
          opacity: note,
        }}
      >
        <div
          style={{
            fontSize: 14,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: C.ghost,
            marginBottom: 10,
          }}
        >
          the sharpest edge we hit
        </div>
        <div style={{ fontSize: 20, lineHeight: 1.45, color: C.ink }}>
          A vector index built with the default opclass is{' '}
          <span style={{ color: C.retire }}>silently ignored</span> by a query ordering on{' '}
          <span style={{ fontFamily: F.mono }}>&lt;=&gt;</span> — no error, no warning, just a
          full scan. <span style={{ fontFamily: F.mono }}>EXPLAIN</span> is the only way to find
          out.
        </div>
      </div>

      <Slug left="tools" right="3 CockroachDB · 3 AWS" />
    </Sheet>
  )
}
