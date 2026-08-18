import React from 'react'
import { AbsoluteFill, OffthreadVideo, staticFile } from 'remotion'
import { C } from './tokens'

/** Source timestamps from demo/VIDEO_TIMESTAMPS.md, in frames at 30fps.
    SRC maps the older 2:27 master; SRC3 maps the current 2:39 cut, which
    replaced the 10s "reload with ?run=" beat with a 22s cross-session
    inject beat. Only launch and kill align between the two. */
export const SRC = {
  launch: [270, 960],
  kill: [960, 1740],
  recall: [1740, 2040],
  race: [2460, 2760],
  bench: [2760, 3330],
} as const

export const SRC3 = {
  hook: [0, 270],
  launch: [270, 960], // fleet launches, findings stream, 90C superseded by NIST
  kill: [960, 1740],
  inject: [1740, 2400], // NEW session on the restarted process; violet INJECT first
  resolver: [2400, 2820],
  race: [2820, 3120],
  bench: [3120, 3690],
  compare: [3690, 4170],
  tools: [4170, 4530],
  close: [4530, 4783],
} as const

export const SOURCE = () => staticFile('colony8-demo.mp4')
export const SOURCE3 = () => staticFile('colony8-demo-v3.mp4')

/** A trimmed slice of a recording, full frame. */
export const Footage: React.FC<{
  from: number
  to: number
  src?: string
  children?: React.ReactNode
}> = ({ from, to, src, children }) => (
  <AbsoluteFill style={{ backgroundColor: C.void }}>
    <OffthreadVideo src={src ?? SOURCE()} trimBefore={from} trimAfter={to} muted />
    {children}
  </AbsoluteFill>
)
