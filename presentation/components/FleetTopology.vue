<script setup lang="ts">
/* Bedrock fleet deployment, with the ledger session panel beside it.
   Left: agents spawn on Bedrock and write down into one memory.
   Right: the rows those writes produce, streaming into the ledger UI.
   Same choreography is re-cut as a Remotion scene for the video.

   Geometry note: the wire SVG and the HTML nodes share one fixed 420x360
   pixel canvas, so curves actually meet the boxes they connect. */
import { ref, onMounted, onUnmounted } from 'vue'

const props = withDefaults(defineProps<{ period?: number }>(), { period: 900 })

// Starts at 9 (settled) so a static PDF/PNG export captures the finished
// picture; the loop then replays the build from 1.
// 1 planner · 2 fan-out · 3 researching · 4 writing · 5 first rows
// 6 more rows · 7 corroboration · 8 supersede · 9 settled
const step = ref(9)
let timer: ReturnType<typeof setInterval> | undefined
let kickoff: ReturnType<typeof setTimeout> | undefined

// Hold the settled frame for a beat before replaying. This is what lets a
// static export screenshot the finished diagram instead of frame one.
const HOLD_MS = 4000

onMounted(() => {
  kickoff = setTimeout(() => {
    timer = setInterval(() => {
      step.value = step.value >= 9 ? 1 : step.value + 1
    }, props.period)
  }, HOLD_MS)
})
onUnmounted(() => {
  clearTimeout(kickoff)
  clearInterval(timer)
})

const W = 420
const H = 360
const NODE_H = 48 // keeps box centres on the wire ends

const planner = { cx: 96, cy: 56 }
const researchers = [
  { id: 'r1', cy: 110, topic: 'boiling point · sea level' },
  { id: 'r2', cy: 178, topic: 'pressure dependence' },
  { id: 'r3', cy: 246, topic: 'reference standards' },
]
const MEM_TOP = 300

const fanWire = (cy: number) => `M 96 56 C 143 56, 143 ${cy}, 190 ${cy}`
const writeWire = (cy: number) => `M 310 ${cy} C 362 ${cy}, 362 ${MEM_TOP}, 250 ${MEM_TOP}`

const rows = [
  { at: 5, op: 'ADD', title: 'Water boils at 100C at 1 atm', src: 'NIST' },
  { at: 5, op: 'ADD', title: 'Boiling point falls with altitude', src: 'USGS' },
  { at: 6, op: 'ADD', title: 'Water boils at 90C', src: 'Handbook 2019', doomed: true },
  { at: 7, op: 'NOOP', title: 'Boiling point falls with altitude', src: 'NOAA' },
  { at: 8, op: 'SUPERSEDE', title: 'Water boils at 90C', src: 'NIST ref' },
]
</script>

<template>
  <div class="fleet">
    <!-- ── left: the fleet on Bedrock ───────────────────────── -->
    <div class="topo-wrap">
      <div class="topo" :style="{ width: W + 'px', height: H + 'px' }">
        <div class="plane" :class="{ on: step >= 1 }">
          <span class="plane-label">Amazon Bedrock · stateless</span>
        </div>

        <svg :viewBox="`0 0 ${W} ${H}`" :width="W" :height="H" class="wires">
          <path
            v-for="(r, i) in researchers"
            :key="'e' + r.id"
            :d="fanWire(r.cy)"
            class="wire"
            :class="{ drawn: step >= 2 }"
            :style="{ transitionDelay: `${i * 110}ms` }"
          />
          <path
            v-for="(r, i) in researchers"
            :key="'w' + r.id"
            :d="writeWire(r.cy)"
            class="wire write"
            :class="{ drawn: step >= 4 }"
            :style="{ transitionDelay: `${i * 110}ms` }"
          />
          <circle
            v-for="(r, i) in researchers"
            :key="'p' + r.id"
            r="3.5"
            class="packet"
            :class="{ flying: step >= 4 && step <= 8 }"
            :style="{
              animationDelay: `${i * 220}ms`,
              offsetPath: `path('${writeWire(r.cy)}')`,
            }"
          />
        </svg>

        <div
          class="node planner"
          :class="{ on: step >= 1 }"
          :style="{ top: planner.cy - NODE_H / 2 + 'px' }"
        >
          <span class="np">planner</span>
          <span class="ns">decomposes the question</span>
        </div>

        <div
          v-for="(r, i) in researchers"
          :key="r.id"
          class="node researcher"
          :class="{ on: step >= 2, busy: step === 3, wrote: step >= 4 }"
          :style="{ top: r.cy - NODE_H / 2 + 'px', transitionDelay: `${i * 110}ms` }"
        >
          <span class="np">researcher {{ i + 1 }}</span>
          <span class="ns">{{ r.topic }}</span>
        </div>

        <div class="memory" :class="{ on: step >= 4, hit: step === 8 }">
          <span class="mem-label">one memory · CockroachDB</span>
          <span class="mem-sub">SERIALIZABLE · version-fenced</span>
        </div>
      </div>

      <p class="caption">
        Agents hold <span class="retire">zero state</span>. Every write lands in one
        transactional table.
      </p>
    </div>

    <!-- ── right: the session / ledger UI ───────────────────── -->
    <div class="session" :style="{ height: H + 'px' }">
      <div class="chrome">
        <span class="dot" /><span class="dot" /><span class="dot" />
        <span class="url">/?run=8f2c…a41</span>
      </div>
      <p class="rows-title">live ledger</p>
      <div class="rows">
        <div
          v-for="(row, i) in rows"
          :key="i"
          class="row"
          :class="{ in: step >= row.at, struck: row.doomed && step >= 8 }"
        >
          <span class="op" :class="row.op.toLowerCase()">{{ row.op }}</span>
          <span class="title">{{ row.title }}</span>
          <span class="src">{{ row.src }}</span>
        </div>
      </div>
      <div class="foot" :class="{ on: step >= 8 }">
        <span class="live">1 live</span>
        <span class="dim">·</span>
        <span class="retire">1 retired</span>
        <span class="dim">·</span>
        <span class="dim">0 lost writes</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fleet {
  display: grid;
  grid-template-columns: 420px 1fr;
  gap: 24px;
  align-items: start;
}

/* ── topology ─────────────────────────────────────────────── */
.topo { position: relative; }

.plane {
  position: absolute;
  inset: 0 0 76px 0; /* clears the memory box below it */
  border: 1px dashed var(--rule);
  opacity: 0;
  transition: opacity 400ms ease;
}
.plane.on { opacity: 1; border-color: var(--rule-lit); }
.plane-label {
  position: absolute;
  top: -8px;
  left: 12px;
  background: var(--void);
  padding: 0 8px;
  font-size: 9px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--fence);
}

.wires { position: absolute; top: 0; left: 0; overflow: visible; }
.wire {
  fill: none;
  stroke: var(--rule-lit);
  stroke-width: 1.25;
  stroke-dasharray: 420;
  stroke-dashoffset: 420;
  transition: stroke-dashoffset 520ms ease;
}
.wire.drawn { stroke-dashoffset: 0; }
.wire.write { stroke: var(--live); opacity: 0.45; }

.packet { fill: var(--live); opacity: 0; }
.packet.flying { animation: fly 900ms ease-in-out infinite; }
@keyframes fly {
  0% { offset-distance: 0%; opacity: 0; }
  15% { opacity: 1; }
  85% { opacity: 1; }
  100% { offset-distance: 100%; opacity: 0; }
}

.node {
  position: absolute;
  height: 48px;
  background: var(--sheet);
  border: 1px solid var(--rule);
  padding: 7px 11px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  opacity: 0;
  transform: translateY(6px);
  transition: opacity 380ms ease, transform 380ms ease, border-color 300ms ease;
}
.node.on { opacity: 1; transform: none; }
.np { font-size: 11.5px; color: var(--ink); line-height: 1.25; }
.ns { font-size: 9.5px; color: var(--ghost); line-height: 1.25; }

.planner { left: 0; width: 96px; border-left: 2px solid var(--trace); }
.researcher { left: 190px; width: 120px; border-left: 2px solid var(--rule-lit); }
.researcher.busy { border-left-color: var(--fence); }
.researcher.wrote { border-left-color: var(--live); }

.memory {
  position: absolute;
  top: 300px;
  left: 90px;
  width: 240px;
  height: 44px;
  background: var(--sheet);
  border: 1px solid var(--rule);
  border-top: 2px solid var(--live);
  display: flex;
  flex-direction: column;
  justify-content: center;
  text-align: center;
  opacity: 0.35;
  transition: opacity 380ms ease, box-shadow 300ms ease, border-top-color 300ms ease;
}
.memory.on { opacity: 1; }
.memory.hit { box-shadow: 0 0 34px rgba(255, 77, 109, 0.35); border-top-color: var(--retire); }
.mem-label { font-size: 12px; color: var(--ink); line-height: 1.3; }
.mem-sub { font-size: 9.5px; color: var(--ghost); line-height: 1.3; }

.caption {
  margin: 10px 0 0;
  font-family: var(--prose);
  font-size: 13.5px;
  color: var(--ghost);
}

/* ── session panel ────────────────────────────────────────── */
.session {
  background: var(--sheet);
  border: 1px solid var(--rule);
  display: flex;
  flex-direction: column;
}
.chrome {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--rule);
  flex: none;
}
.dot { width: 7px; height: 7px; border-radius: 50%; background: var(--rule-lit); }
.url { margin-left: 10px; font-size: 10px; color: var(--ghost); }

.rows-title {
  margin: 0;
  padding: 12px 14px 4px;
  font-size: 9px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--ghost);
  flex: none;
}

.rows { flex: 1; padding: 0 14px; overflow: hidden; }
.row {
  display: grid;
  grid-template-columns: 74px 1fr auto;
  gap: 9px;
  align-items: baseline;
  padding: 7px 0;
  border-bottom: 1px solid var(--rule);
  opacity: 0;
  transform: translateX(10px);
  transition: opacity 340ms ease, transform 340ms ease;
}
.row.in { opacity: 1; transform: none; }
.row.struck .title { text-decoration: line-through; color: var(--ghost); }

.op {
  font-size: 8.5px;
  letter-spacing: 0.12em;
  padding: 2px 4px;
  border: 1px solid currentColor;
  text-align: center;
}
.op.add { color: var(--live); }
.op.noop { color: var(--ghost); }
.op.supersede { color: var(--retire); }

.title { font-size: 11px; color: var(--ink); line-height: 1.3; }
.src { font-size: 9.5px; color: var(--ghost); }

.foot {
  border-top: 1px solid var(--rule);
  padding: 9px 14px;
  font-size: 10.5px;
  display: flex;
  gap: 7px;
  flex: none;
  opacity: 0;
  transition: opacity 400ms ease;
}
.foot.on { opacity: 1; }
</style>
