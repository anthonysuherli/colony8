---
theme: default
title: colony8 — transactional shared memory for multi-agent fleets
info: |
  Hackathon deck for colony8. Substrate matches the ledger UI:
  ruled paper, mono for machine data, sans for claim prose.
class: text-left
highlighter: shiki
lineNumbers: false
transition: slide-left
drawings:
  persist: false
fonts:
  mono: JetBrains Mono
---

<p class="eyebrow">CockroachDB × AWS · hackathon submission</p>

# colony8

<p class="prose" style="margin: 14px 0 0; max-width: 42ch">
Transactional shared memory for multi-agent fleets.
</p>

<p class="dim" style="margin: 6px 0 0; font-size: 15px">
Stateless agents. One memory. Every write resolved inside a serializable transaction.
</p>

<hr class="rule" />

<div class="cols-3">
  <div class="panel">
    <p class="panel-title">the failure mode</p>
    <span class="retire" style="font-size: 15px">37% of multi-agent failures</span>
    <p class="dim" style="margin: 4px 0 0; font-size: 11.5px">come from inconsistent shared state</p>
  </div>
  <div class="panel">
    <p class="panel-title">the fix</p>
    <span class="live" style="font-size: 15px">write-time resolution</span>
    <p class="dim" style="margin: 4px 0 0; font-size: 11.5px">not read-time ranking, not async consolidation</p>
  </div>
  <div class="panel">
    <p class="panel-title">the proof</p>
    <span class="fence" style="font-size: 15px">200 writes → 1 live fact</span>
    <p class="dim" style="margin: 4px 0 0; font-size: 11.5px">0 lost writes, race-test enforced</p>
  </div>
</div>

<div class="slug"><span>colony8</span><span>github.com/anthonysuherli/colony8 · MIT</span></div>

---

<p class="eyebrow">the problem</p>

<div class="cols" style="align-items: center; height: 74%">
  <div>
    <div class="big-stat">37%</div>
    <p class="prose" style="margin: 18px 0 0; max-width: 34ch">
      of multi-agent system failures come from agents acting on
      <strong>inconsistent shared state</strong>.
    </p>
    <p class="dim" style="margin: 12px 0 0; font-size: 12px">
      Cemri et al., failure-mode study — summarized by O'Reilly, 2025
    </p>
  </div>
  <div>
    <div class="panel">
      <p class="panel-title">how it actually goes wrong</p>
      <p style="margin: 0 0 10px; font-size: 13px">
        <span class="trace">agent A</span> reads memory, starts a 4-second LLM call
      </p>
      <p style="margin: 0 0 10px; font-size: 13px">
        <span class="trace">agent B</span> writes a correction to the same fact
      </p>
      <p style="margin: 0 0 10px; font-size: 13px">
        <span class="trace">agent A</span> finishes and writes over it — B's correction is gone
      </p>
      <hr class="rule" style="margin: 14px 0" />
      <p class="dim" style="margin: 0; font-size: 12px">
        No error is raised. Both agents proceed as if nothing happened.
      </p>
    </div>
    <p class="claim" style="margin-top: 22px; font-size: 21px">
      colony8 makes this impossible by construction.
    </p>
  </div>
</div>

<div class="slug"><span>the problem</span><span>02</span></div>

---

<p class="eyebrow">the shape of it · agents deploy, one memory absorbs</p>

<FleetTopology />

<div class="slug"><span>architecture</span><span>03</span></div>

---

<p class="eyebrow">architecture</p>

<div style="display: flex; justify-content: center; align-items: center; height: 76%">
  <img src="/architecture.svg" style="max-height: 100%; max-width: 92%" alt="colony8 architecture" />
</div>

<div class="slug"><span>architecture</span><span>04</span></div>

---

<p class="eyebrow">the core · write-time resolver</p>

<h2 style="font-size: 26px; margin-bottom: 14px">Every candidate takes the same two phases</h2>

<ResolverPipeline />

<div class="slug"><span>resolver</span><span>05</span></div>

---

<p class="eyebrow">the core · this is the whole guarantee</p>

<div class="cols">
<div>

```python
# colony8/memory/resolver.py
for attempt in range(max_attempts):
    matches = recall(pool, run_id, embedding, k=5)
    if not matches or matches[0].similarity < ADD_THRESHOLD:
        decision = Decision(op="ADD", ...)
    else:
        decision = classify_fn(cand, matches)
    try:
        return _apply(pool, run_id, cand, ...)
    except (StaleSnapshot, SerializationFailure):
        time.sleep(random.uniform(0.01, 0.05) * (attempt + 1))
        continue

# attempts exhausted — parked, not dropped
log_event(conn, run_id, "DEFERRED", cand.title, ...)
```

</div>
<div>

```python
# inside one SERIALIZABLE transaction
row = conn.execute(
    "SELECT version FROM findings "
    "WHERE id = %s AND invalidated_at IS NULL "
    "FOR UPDATE",
    (target.id,),
).fetchone()

if row is None or row[0] != target.version:
    raise StaleSnapshot(f"{target.id} moved")

# winner inserted, loser retired — never deleted
fid = insert_finding(conn, run_id, cand, embedding)
invalidate(conn, target.id, superseded_by=fid,
           expected_version=target.version)
```

<p class="dim" style="margin: 14px 0 0; font-size: 12px">
Classification is expensive and happens <strong>outside</strong> the transaction.
The transaction only re-reads, compares a version, and applies.
</p>

</div>
</div>

<div class="slug"><span>resolver</span><span>06</span></div>

---

<p class="eyebrow">supersede never deletes</p>

## The chain stays queryable forever

<div class="panel" style="margin-top: 18px">
  <p class="panel-title">finding · thermal properties of water</p>
  <div style="display: flex; flex-direction: column; gap: 0">
    <div style="display: grid; grid-template-columns: 92px 1fr auto; gap: 14px; align-items: baseline; padding: 12px 0; border-bottom: 1px solid var(--rule)">
      <span class="retire" style="font-size: 9.5px; letter-spacing: 0.14em; border: 1px solid currentColor; padding: 2px 6px; text-align: center">RETIRED</span>
      <span style="font-size: 15px; text-decoration: line-through; color: var(--ghost)">Water boils at 90&deg;C</span>
      <span class="dim" style="font-size: 11px">Handbook, 2019</span>
    </div>
    <div style="display: grid; grid-template-columns: 92px 1fr auto; gap: 14px; align-items: baseline; padding: 12px 0">
      <span class="live" style="font-size: 9.5px; letter-spacing: 0.14em; border: 1px solid currentColor; padding: 2px 6px; text-align: center">LIVE</span>
      <span style="font-size: 15px">Water boils at 100&deg;C at 1 atm</span>
      <span class="dim" style="font-size: 11px">NIST reference</span>
    </div>
  </div>
</div>

<div class="cols" style="margin-top: 20px">
  <div>

```sql
-- the loser is marked, not removed
UPDATE findings
   SET invalidated_at = now(),
       superseded_by  = %s,
       version        = version + 1
 WHERE id = %s
   AND invalidated_at IS NULL
   AND version = %s
```

  </div>
  <div>
    <p class="prose" style="margin: 0; font-size: 17px">
      The <code>version = %s</code> predicate <strong>is</strong> the fence. If another
      agent moved the row since the snapshot, this update matches zero rows and the
      whole cycle re-runs against the new truth.
    </p>
    <p class="dim" style="margin: 14px 0 0; font-size: 12.5px">
      <code>resolution_events</code> keeps every decision the resolver ever made,
      with its reason — a complete audit log, not a bolt-on.
    </p>
  </div>
</div>

<div class="slug"><span>supersede</span><span>07</span></div>

---

<p class="eyebrow">the demo · what you will see</p>

## Kill the fleet mid-run. The memory doesn't care.

<div class="cols-3" style="margin-top: 20px">
  <div class="panel">
    <p class="panel-title">01 · contradiction lands</p>
    <p style="margin: 0; font-size: 13px">
      A 2019 handbook claims <span class="retire">90&deg;C</span>. Seconds later the NIST
      reference arrives. The resolver classifies it as a contradiction and supersedes
      the earlier claim <strong>on screen</strong> — struck through, chain intact.
    </p>
  </div>
  <div class="panel">
    <p class="panel-title">02 · backend killed</p>
    <p style="margin: 0; font-size: 13px">
      <code>Ctrl-C</code> on camera, mid-run. Connection refused. Every agent in the
      fleet dies with it.
    </p>
    <p class="dim" style="margin: 10px 0 0; font-size: 11.5px">
      There is nothing to lose — agents hold zero state.
    </p>
  </div>
  <div class="panel">
    <p class="panel-title">03 · full recall</p>
    <p style="margin: 0; font-size: 13px">
      Restart, reload with <code>?run=&lt;id&gt;</code>. The entire ledger replays from
      CockroachDB — <span class="live">supersede chain and all</span>.
    </p>
  </div>
</div>

<p class="claim" style="margin-top: 26px">
  Nothing ever lived in agent state, so nothing was there to lose.
</p>

<div class="slug"><span>demo</span><span>08</span></div>

---

<p class="eyebrow">proof · not a claim, a test</p>

## 200 conflicting writes at one fact

<div class="cols" style="margin-top: 14px">
  <div>
    <div class="panel" style="padding: 14px 16px">
      <p class="panel-title">contention run · scripts/bench.py</p>
      <table style="font-size: 12.5px">
        <tbody>
          <tr><td style="width: 46px"><span class="live">1</span></td><td>live fact remaining</td></tr>
          <tr><td>184</td><td>retired, with full audit chains</td></tr>
          <tr><td>155</td><td>conflict retries absorbed</td></tr>
          <tr><td><span class="fence">16</span></td><td>parked as DEFERRED — visible, retryable</td></tr>
          <tr><td><span class="live">0</span></td><td><strong>lost writes</strong></td></tr>
        </tbody>
      </table>
    </div>
    <p class="dim" style="margin: 10px 0 0; font-size: 11px">
      Numbers vary run to run. The invariants do not.
    </p>
  </div>
  <div>
    <div class="panel" style="padding: 14px 16px">
      <p class="panel-title">substrate throughput</p>
      <table style="font-size: 12.5px">
        <thead><tr><th>operation</th><th>thru</th><th>p50/p95 ms</th></tr></thead>
        <tbody>
          <tr><td>write, fast-path ADD</td><td>~135/s</td><td>7.6 / 8.3</td></tr>
          <tr><td>recall, k=5</td><td>~395/s</td><td>2.3 / 3.7</td></tr>
          <tr><td>contended SUPERSEDE &times;8</td><td>~96/s</td><td>&mdash;</td></tr>
        </tbody>
      </table>
    </div>
    <p class="dim" style="margin: 10px 0 0; font-size: 11px">
      Single-node in-memory CockroachDB; LLM and embedding calls excluded — this
      measures the substrate, not model latency.
    </p>
  </div>
</div>

<p style="margin: 14px 0 0; font-size: 13px">
  <span class="live">26 tests passing</span>, including
  <code>test_concurrent_contradiction</code> — a real race, not a simulation.
</p>

<div class="slug"><span>benchmarks</span><span>09</span></div>

---

<p class="eyebrow">how it differs</p>

## Against typical agent-memory layers

<table style="margin-top: 20px">
  <thead>
    <tr><th></th><th style="color: var(--live)">colony8</th><th>typical agent-memory layers*</th></tr>
  </thead>
  <tbody>
    <tr>
      <td class="dim">conflict handling</td>
      <td>resolved at <strong>write time</strong>, in a serializable transaction</td>
      <td class="dim">read-time ranking, or async consolidation minutes–hours later</td>
    </tr>
    <tr>
      <td class="dim">concurrent writers</td>
      <td><strong>version-fenced</strong> — one live fact, race-test proven</td>
      <td class="dim">per-agent views can diverge over a shared archive</td>
    </tr>
    <tr>
      <td class="dim">history</td>
      <td><strong>supersede chains</strong> — retired, never deleted</td>
      <td class="dim">facts updated or overwritten in place</td>
    </tr>
    <tr>
      <td class="dim">storage</td>
      <td>SQL + vectors in <strong>one database, one transaction</strong></td>
      <td class="dim">separate vector + graph + KV stores stitched together</td>
    </tr>
    <tr>
      <td class="dim">agent restart</td>
      <td><strong>full recall</strong> — agents hold zero state</td>
      <td class="dim">framework session state to rebuild</td>
    </tr>
  </tbody>
</table>

<p class="dim" style="margin-top: 18px; font-size: 11.5px">
* patterns documented across Mem0, Zep, and Letta/MemGPT public papers and docs.
</p>

<div class="slug"><span>differentiation</span><span>10</span></div>

---

<p class="eyebrow">required tools · every one load-bearing</p>

<table style="margin-top: 12px">
  <thead><tr><th>tool</th><th>role on the demo path</th></tr></thead>
  <tbody>
    <tr>
      <td class="live">CockroachDB Distributed Vector Indexing</td>
      <td>semantic recall before <strong>every</strong> write, feeding candidates to the resolver</td>
    </tr>
    <tr>
      <td class="live">CockroachDB Cloud Managed MCP Server</td>
      <td>the audit agent's <strong>only</strong> access path — read-only SQL over MCP</td>
    </tr>
    <tr>
      <td class="live">ccloud CLI</td>
      <td>scripted, repeatable cluster + scoped SQL user provisioning</td>
    </tr>
    <tr>
      <td class="fence">Amazon Bedrock</td>
      <td>planner / researcher / classifier / audit LLM, and Titan v2 embeddings</td>
    </tr>
    <tr>
      <td class="fence">AWS Lambda</td>
      <td>stateless container runtime for the API and ledger replay</td>
    </tr>
    <tr>
      <td class="fence">Amazon S3 + CloudFront</td>
      <td>static hosting and CDN for the ledger UI</td>
    </tr>
  </tbody>
</table>

<div class="panel" style="margin-top: 22px; border-left: 2px solid var(--trace)">
  <p class="panel-title">the sharpest edge we hit</p>
  <p style="margin: 0; font-size: 13px">
    A vector index built with the default opclass is <strong>silently ignored</strong> by a
    query ordering on <code>&lt;=&gt;</code> — no error, no warning, just a full scan. Adding an
    ordinary <code>WHERE</code> predicate to the ordering query defeats it the same silent way.
    <code>EXPLAIN</code> is the only way to find out.
  </p>
</div>

<div class="slug"><span>tools</span><span>11</span></div>

---

<p class="eyebrow">the index is on the hot path — here is the proof</p>

<div class="cols" style="margin-top: 10px">
<div>

```sql
-- opclass must match the operator recall() orders by
CREATE VECTOR INDEX IF NOT EXISTS findings_embedding_idx
    ON findings (run_id, embedding vector_cosine_ops);
```

```sql
-- EXPLAIN, against 800 findings
• top-k
└── • lookup join
    └── • vector search
          table: findings@findings_embedding_idx
          target count: 40
```

</div>
<div>
  <div class="panel">
    <p class="panel-title">two details that make it real</p>
    <p style="margin: 0 0 12px; font-size: 13px">
      <span class="live">01</span> &nbsp;the opclass is <code>vector_cosine_ops</code>, matching
      the <code>&lt;=&gt;</code> operator — an <code>l2</code> index falls back to a full scan
      without saying so.
    </p>
    <p style="margin: 0; font-size: 13px">
      <span class="live">02</span> &nbsp;<code>invalidated_at IS NULL</code> is <strong>not</strong>
      in the ordering query — that predicate defeats the index too. Recall over-fetches
      and filters retired rows afterwards.
    </p>
  </div>
  <p class="dim" style="margin: 14px 0 0; font-size: 12px">
    If the index is ever unavailable, recall falls back to an exact scan — slower,
    identical results. Correctness never depends on it.
  </p>
</div>
</div>

<div class="slug"><span>vector index</span><span>12</span></div>

---

<p class="eyebrow">what breaks, and what happens</p>

## Failure modes are the product

<table style="margin-top: 12px; font-size: 12.5px">
  <thead><tr><th style="width: 38%">what goes wrong</th><th>what colony8 does</th></tr></thead>
  <tbody>
    <tr><td class="dim">Two agents write one fact at once</td><td>Loser's version check fails; re-snapshot and re-classify</td></tr>
    <tr><td class="dim">CockroachDB returns <code>SQLSTATE 40001</code></td><td>Jittered retry, up to 5 attempts</td></tr>
    <tr><td class="dim">All retries exhausted</td><td><span class="fence">DEFERRED</span> event — parked and visible, never silently dropped</td></tr>
    <tr><td class="dim">A researcher agent crashes</td><td>Subtopic marked failed; other agents' writes stay intact</td></tr>
    <tr><td class="dim">The whole fleet dies</td><td>Nothing to lose — the ledger replays from CockroachDB</td></tr>
    <tr><td class="dim"><code>EMBED_DIM</code> disagrees with the table</td><td>Startup fails loudly, not one insert at a time</td></tr>
  </tbody>
</table>

<div class="panel" style="margin-top: 14px; padding: 12px 16px; border-left: 2px solid var(--retire)">
  <p class="panel-title">one honest gap</p>
  <p style="margin: 0; font-size: 12.5px">
    Two agents concurrently <code>ADD</code>ing brand-new, near-identical claims can both
    land — there is no existing row yet to fence on. The duplicate isn't lost; it is
    retired the moment a later candidate matches and supersedes it.
  </p>
</div>

<div class="slug"><span>failure modes</span><span>13</span></div>

---

<p class="eyebrow">colony8</p>

# One memory.<br />Nothing lost.

<p class="prose" style="margin: 20px 0 0; max-width: 46ch">
Stateless agents on Bedrock, one CockroachDB table, every write resolved inside a
serializable transaction — and a full audit chain behind every live fact.
</p>

<hr class="rule" />

<div class="cols-3">
  <div class="panel">
    <p class="panel-title">repo</p>
    <span style="font-size: 13px">github.com/anthonysuherli/colony8</span>
    <p class="dim" style="margin: 4px 0 0; font-size: 11.5px">MIT · 26 tests · free tier</p>
  </div>
  <div class="panel">
    <p class="panel-title">live demo</p>
    <span class="dim" style="font-size: 13px">CloudFront — see SUBMISSION.md</span>
    <p class="dim" style="margin: 4px 0 0; font-size: 11.5px">replay of a completed run</p>
  </div>
  <div class="panel">
    <p class="panel-title">run it yourself</p>
    <span style="font-size: 13px">./scripts/dev_db.sh</span>
    <p class="dim" style="margin: 4px 0 0; font-size: 11.5px">a full local run takes about a minute</p>
  </div>
</div>

<div class="slug"><span>thank you</span><span>colony8</span></div>
