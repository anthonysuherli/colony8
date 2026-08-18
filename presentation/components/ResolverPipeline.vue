<script setup lang="ts">
/* The signature element: a candidate travelling the resolver.
   Phase 1 is outside any transaction; phase 2 is one SERIALIZABLE txn.
   Mirrors the docstring flow in colony8/memory/resolver.py. */
import { ref, onMounted, onUnmounted } from 'vue'

// Starts at 9 (committed) so a static PDF/PNG export captures the finished
// state; the loop then replays from 1.
// 1 recall · 2 classify · 3 enter txn · 4 lock+verify
// 5 drift → retry · 6 recall again · 7 classify again · 8 apply · 9 committed
const step = ref(9)
let timer: ReturnType<typeof setInterval> | undefined
let kickoff: ReturnType<typeof setTimeout> | undefined

// Hold the settled frame so static exports capture the finished state.
const HOLD_MS = 4000

onMounted(() => {
  kickoff = setTimeout(() => {
    timer = setInterval(() => {
      step.value = step.value >= 9 ? 1 : step.value + 1
    }, 950)
  }, HOLD_MS)
})
onUnmounted(() => {
  clearTimeout(kickoff)
  clearInterval(timer)
})

const active = (...s: number[]) => s.includes(step.value)
const past = (n: number) => step.value > n
</script>

<template>
  <div class="pipe">
    <!-- phase 1 -->
    <div class="phase">
      <p class="phase-label">phase 1 · no transaction, no lock</p>
      <div class="stages">
        <div class="stage" :class="{ on: active(1, 6), done: past(1) }">
          <span class="sn">recall</span>
          <span class="sd">vector search, k=5</span>
        </div>
        <span class="arrow" :class="{ on: past(1) }">→</span>
        <div class="stage" :class="{ on: active(2, 7), done: past(2) }">
          <span class="sn">classify</span>
          <span class="sd">ADD · UPDATE · NOOP · SUPERSEDE</span>
        </div>
      </div>
    </div>

    <span class="arrow big" :class="{ on: past(2) }">→</span>

    <!-- phase 2 -->
    <div class="phase txn" :class="{ open: step >= 3 && step !== 5 }">
      <p class="phase-label fence">phase 2 · one SERIALIZABLE transaction</p>
      <div class="stages">
        <div class="stage" :class="{ on: active(4), done: past(4) && step !== 5 }">
          <span class="sn">SELECT … FOR UPDATE</span>
          <span class="sd">re-read the target row</span>
        </div>
        <span class="arrow" :class="{ on: past(4) && step !== 5 }">→</span>
        <div class="stage" :class="{ on: active(8), done: past(8) }">
          <span class="sn">verify + apply</span>
          <span class="sd">version == snapshot?</span>
        </div>
      </div>
    </div>

    <!-- outcomes -->
    <div class="outs">
      <div class="out retry" :class="{ fired: step === 5 }">
        version drift → re-snapshot
      </div>
      <div class="out defer">
        retries exhausted → <span class="fence">DEFERRED</span>
      </div>
      <div class="out commit" :class="{ fired: step === 9 }">
        committed → <span class="live">1 live fact</span> + chain
      </div>
    </div>
  </div>
</template>

<style scoped>
.pipe { display: flex; flex-direction: column; gap: 10px; }

.phase {
  border: 1px solid var(--rule);
  background: var(--sheet);
  padding: 12px 14px 14px;
  position: relative;
  transition: border-color 300ms ease, box-shadow 300ms ease;
}
.phase.txn { border-left: 2px solid var(--fence); }
.phase.txn.open { box-shadow: 0 0 26px rgba(255, 194, 71, 0.16); border-color: var(--rule-lit); }

.phase-label {
  margin: 0 0 12px;
  font-size: 9.5px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--ghost);
}
.phase-label.fence { color: var(--fence); }

.stages { display: flex; align-items: stretch; gap: 12px; }

.stage {
  flex: 1;
  border: 1px solid var(--rule);
  border-left: 2px solid var(--rule-lit);
  padding: 9px 12px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  opacity: 0.45;
  transition: opacity 300ms ease, border-left-color 300ms ease, background 300ms ease;
}
.stage.done { opacity: 1; border-left-color: var(--live); }
.stage.on {
  opacity: 1;
  border-left-color: var(--trace);
  background: rgba(91, 141, 255, 0.07);
}
.sn { font-size: 12.5px; color: var(--ink); }
.sd { font-size: 10px; color: var(--ghost); }

.arrow {
  align-self: center;
  color: var(--rule-lit);
  font-size: 15px;
  transition: color 300ms ease;
}
.arrow.on { color: var(--live); }
.arrow.big { align-self: flex-start; margin-left: 22px; transform: rotate(90deg); }

.outs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.out {
  border: 1px solid var(--rule);
  border-top: 2px solid var(--rule-lit);
  padding: 8px 11px;
  font-size: 10.5px;
  line-height: 1.4;
  color: var(--ghost);
  transition: border-top-color 300ms ease, color 300ms ease, background 300ms ease;
}
.out.retry.fired {
  border-top-color: var(--trace);
  color: var(--ink);
  background: rgba(91, 141, 255, 0.08);
}
.out.commit.fired {
  border-top-color: var(--live);
  color: var(--ink);
  background: rgba(53, 240, 168, 0.07);
}
.out.defer { border-top-color: var(--fence); }
</style>
