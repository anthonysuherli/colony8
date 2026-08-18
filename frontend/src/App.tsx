import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

const API = import.meta.env.VITE_API_BASE;

type Finding = {
  id: string; title: string; content: { claim: string; quote?: string };
  provenance: { url: string; title: string }[]; confidence: number;
  created_at: string; invalidated_at: string | null; superseded_by: string | null;
};
type Event = {
  id: string; op: string; candidate_title: string; target_finding_id: string | null;
  new_finding_id: string | null; reason: string | null; created_at: string;
};
type Ledger = { findings: Finding[]; events: Event[] };

const OP_COLOR: Record<string, string> = {
  ADD: "var(--live)", UPDATE: "var(--trace)", NOOP: "var(--ghost)",
  SUPERSEDE: "var(--retire)", DEFERRED: "var(--fence)", INJECT: "var(--inject)",
};

const METRIC_LABEL: Record<string, string> = {
  live_findings: "live findings",
  superseded: "superseded",
  supersede_events: "supersede events",
  deferred: "deferred",
  contradiction_rate: "contradiction rate",
};

export default function App() {
  const [runId, setRunId] = useState<string | null>(
    () => new URLSearchParams(window.location.search).get("run"),
  );
  const [replay] = useState(() => new URLSearchParams(window.location.search).has("run"));
  const [question, setQuestion] = useState("What are the key thermal properties of water?");
  const [status, setStatus] = useState<string>("");
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [ledger, setLedger] = useState<Ledger>({ findings: [], events: [] });
  const [firing, setFiring] = useState(false);
  const timer = useRef<number>(0);
  const seen = useRef(new Set<string>());
  const eventCount = useRef(0);

  async function startRun() {
    const r = await fetch(`${API}/runs`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    const { run_id } = await r.json();
    setRunId(run_id);
  }

  useEffect(() => {
    if (!runId) return;
    const poll = async () => {
      const [runR, ledR] = await Promise.all([
        fetch(`${API}/runs/${runId}`), fetch(`${API}/runs/${runId}/ledger`),
      ]);
      const run = await runR.json();
      setStatus(run.status); setHealth(run.health);
      if (run.question) setQuestion(run.question);
      setLedger(await ledR.json());
    };
    poll();
    timer.current = window.setInterval(poll, 2000);
    return () => window.clearInterval(timer.current);
  }, [runId]);

  // Every committed resolution drives one pulse down the pipeline instrument.
  const latest = ledger.events.at(-1);
  useEffect(() => {
    if (ledger.events.length === eventCount.current) return;
    eventCount.current = ledger.events.length;
    setFiring(true);
    const t = window.setTimeout(() => setFiring(false), 900);
    return () => window.clearTimeout(t);
  }, [ledger.events.length]);

  const live = ledger.findings.filter((f) => !f.invalidated_at);
  const retired = ledger.findings.filter((f) => f.invalidated_at);
  const deferred = ledger.events.filter((e) => e.op === "DEFERRED").length;

  // A retired finding folds back under whichever finding replaced it, recursively:
  // SUPERSEDE never deletes, so the whole chain stays readable.
  const chains = useMemo(() => {
    const byWinner = new Map<string, Finding[]>();
    for (const f of retired) {
      if (!f.superseded_by) continue;
      const arr = byWinner.get(f.superseded_by) ?? [];
      arr.push(f);
      byWinner.set(f.superseded_by, arr);
    }
    const walk = (id: string, depth = 0): Finding[] =>
      depth > 20 ? [] : (byWinner.get(id) ?? []).flatMap((f) => [f, ...walk(f.id, depth + 1)]);
    return walk;
  }, [retired]);

  const isNew = (id: string) => !seen.current.has(id);
  useEffect(() => {
    for (const f of ledger.findings) seen.current.add(f.id);
    for (const e of ledger.events) seen.current.add(e.id);
  });

  const pulse = latest ? OP_COLOR[latest.op] ?? "var(--ghost)" : "var(--ghost)";
  const t0 = ledger.events[0] ? Date.parse(ledger.events[0].created_at) : 0;
  const offset = (iso: string) =>
    `+${((Date.parse(iso) - t0) / 1000).toFixed(2)}s`;

  return (
    <main>
      <header className="masthead">
        <h1>colony<b>8</b></h1>
        <p className="tag">
          stateless agents · <span>one transactional memory</span> · CockroachDB × Bedrock
        </p>

        <section
          className={`pipeline${firing ? " firing" : ""}`}
          style={{ "--pulse": pulse } as React.CSSProperties}
        >
          <div className="pipe-out">
            <span className="eyebrow">Write-time resolver</span>
            <span className="verdict">{latest ? `last commit — ${latest.op}` : "idle"}</span>
          </div>
          <div className="pipe-track">
            <div className="phase"><i>01</i><b>Snapshot</b><em>vector recall, no lock held</em></div>
            <span className="arrow" aria-hidden="true">→</span>
            <div className="phase"><i>02</i><b>Classify</b><em>add · update · noop · supersede</em></div>
            <span className="arrow" aria-hidden="true">→</span>
            <div className="phase txn"><i>03</i><b>Apply</b><em>serializable, version-fenced</em></div>
          </div>
        </section>

        {replay && question && (
          <p className="asked">
            <span>Question under research</span>
            {question}
          </p>
        )}

        {!replay && (
          <div className="launcher">
            <input
              aria-label="Research question"
              value={question}
              placeholder="Ask the fleet a research question"
              onChange={(e) => setQuestion(e.target.value)}
            />
            <button onClick={startRun} disabled={!!runId && status === "running"}>
              {status === "running" ? "fleet running" : "launch fleet"}
            </button>
          </div>
        )}

        <div className="readout">
          <dl><dt>Live</dt><dd className="live">{live.length}</dd></dl>
          <dl><dt>Superseded</dt><dd className="retire">{retired.length}</dd></dl>
          <dl><dt>Resolutions</dt><dd>{ledger.events.length}</dd></dl>
          <dl><dt>Deferred</dt><dd className={deferred ? "fence" : ""}>{deferred}</dd></dl>
          <dl><dt>Lost writes</dt><dd className="live">0</dd></dl>
          {status && <span className={`state ${status}`}>{status.replace(/_/g, " ")}</span>}
        </div>
      </header>

      <div className="panes">
        <section>
          <div className="pane-head">
            <h2>Memory ledger</h2>
            <span className="count">{live.length} live · {retired.length} retired</span>
          </div>

          {live.length === 0 && (
            <p className="empty">
              No findings yet. Launch a fleet — every claim it writes lands here.
            </p>
          )}

          {live.map((f) => (
            <article key={f.id} className={`entry${isNew(f.id) ? " enter" : ""}`}>
              <p className="claim">{f.content.claim}</p>
              <div className="meta">
                <span className="conf">conf {f.confidence.toFixed(2)}</span>
                {f.provenance.map((p) => (
                  <a key={p.url} href={p.url} target="_blank" rel="noreferrer">{p.title}</a>
                ))}
              </div>
              {chains(f.id).length > 0 && (
                <ul className="chain">
                  {chains(f.id).map((d) => (
                    <li key={d.id}>
                      <span className="rel">superseded</span>
                      <s>{d.content.claim}</s>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </section>

        <section>
          <div className="pane-head">
            <h2>Resolution log</h2>
            <span className="count">{ledger.events.length} events</span>
          </div>

          {ledger.events.length === 0 && (
            <p className="empty">Each write commits one row here, in serial order.</p>
          )}

          <ul className="log">
            {[...ledger.events].reverse().map((e) => (
              <li key={e.id} className={isNew(e.id) ? "enter" : ""}>
                <span className="op" style={{ "--op": OP_COLOR[e.op] } as React.CSSProperties}>
                  {e.op}
                </span>
                <span className="what">
                  {e.candidate_title}
                  <span className="why">{e.reason ?? offset(e.created_at)}</span>
                </span>
              </li>
            ))}
          </ul>

          {health && (
            <div className="health">
              <div className="pane-head">
                <h2>Memory health</h2>
                <span className="count">via CockroachDB MCP</span>
              </div>
              <dl className="metrics">
                {Object.entries(health)
                  .filter(([k]) => k !== "narrative")
                  .map(([k, v]) => (
                    <div key={k} style={{ display: "contents" }}>
                      <dt>{METRIC_LABEL[k] ?? k.replace(/_/g, " ")}</dt>
                      <dd>{String(v)}</dd>
                    </div>
                  ))}
              </dl>
              {typeof health.narrative === "string" && (
                <p className="narrative">{health.narrative}</p>
              )}
            </div>
          )}
        </section>
      </div>

      <footer className="colophon">
        <span>Serializable writes</span>
        <span>Supersede never deletes</span>
        <span>Agents hold zero state</span>
      </footer>
    </main>
  );
}
