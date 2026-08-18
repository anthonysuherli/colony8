/* Same substrate as the ledger UI and the deck: ruled paper,
   mono for machine data, sans for claim prose. */

export const C = {
  void: '#070a0f',
  sheet: '#0a0e15',
  rule: '#16202e',
  ruleLit: '#23334a',
  ink: '#d7e3f4',
  ghost: '#64768f',

  live: '#35f0a8',
  retire: '#ff4d6d',
  fence: '#ffc247',
  trace: '#5b8dff',
} as const

export const F = {
  mono: 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace',
  prose: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
} as const

export const RHYTHM = 44 // ruled-line spacing at 1080p

/** The ledger sheet: hairline rules over a cold vignette. */
export const sheetBackground = `
  repeating-linear-gradient(
    to bottom,
    transparent 0,
    transparent ${RHYTHM - 1}px,
    rgba(91, 141, 255, 0.045) ${RHYTHM - 1}px,
    rgba(91, 141, 255, 0.045) ${RHYTHM}px
  ),
  radial-gradient(120% 80% at 50% -10%, #0f1826 0%, ${C.void} 60%)
`
