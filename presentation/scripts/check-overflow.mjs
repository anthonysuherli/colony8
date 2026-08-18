/* Catch slides whose content runs past the 980x552 canvas.
   Eyeballing 14 exported PNGs missed three overflows; this does not.

   Usage:  npx slidev --port 3033 &   then   node scripts/check-overflow.mjs   */
import { chromium } from 'playwright-chromium'

const BASE = process.env.DECK_URL ?? 'http://localhost:3033'
const SLIDES = Number(process.env.SLIDES ?? 14)
const TOLERANCE = 2 // px of rounding slack

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })

let bad = 0

for (let n = 1; n <= SLIDES; n++) {
  await page.goto(`${BASE}/${n}`, { waitUntil: 'networkidle' })
  // the animated components hold their settled frame for 4s; sample inside that
  await page.waitForTimeout(700)

  const result = await page.evaluate(() => {
    const layout = document.querySelector('.slidev-layout')
    if (!layout) return { error: 'no .slidev-layout' }
    const box = layout.getBoundingClientRect()
    const scale = box.height / layout.offsetHeight // slidev scales the canvas
    let worst = 0
    let culprit = ''
    for (const el of layout.querySelectorAll('*')) {
      const r = el.getBoundingClientRect()
      if (r.height === 0 || r.width === 0) continue
      const over = (r.bottom - box.bottom) / scale
      if (over > worst) {
        worst = over
        culprit = `${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).split(' ')[0] : ''}`
      }
    }
    return { overflow: Math.round(worst), culprit }
  })

  if (result.error) {
    console.log(`slide ${String(n).padStart(2)}  ERROR  ${result.error}`)
    bad++
  } else if (result.overflow > TOLERANCE) {
    console.log(`slide ${String(n).padStart(2)}  OVERFLOW  +${result.overflow}px  ${result.culprit}`)
    bad++
  } else {
    console.log(`slide ${String(n).padStart(2)}  ok`)
  }
}

await browser.close()
console.log(bad ? `\n${bad} slide(s) need attention` : '\nall slides fit')
process.exit(bad ? 1 : 0)
