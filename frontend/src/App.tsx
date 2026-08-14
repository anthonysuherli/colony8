import { useEffect, useRef, useState } from "react";
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
  ADD: "#3fb950", UPDATE: "#58a6ff", NOOP: "#8b949e",
  SUPERSEDE: "#f85149", DEFERRED: "#d29922",
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
  const timer = useRef<number>(0);

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
      setLedger(await ledR.json());
    };
    poll();
    timer.current = window.setInterval(poll, 2000);
    return () => window.clearInterval(timer.current);
  }, [runId]);

  const live = ledger.findings.filter((f) => !f.invalidated_at);
  const dead = ledger.findings.filter((f) => f.invalidated_at);
  const byId = Object.fromEntries(ledger.findings.map((f) => [f.id, f]));

  return (
    <main>
      <header>
        <h1>colony8</h1>
        <p className="tag">stateless agents · one transactional memory · CockroachDB × Bedrock</p>
        {!replay && (
          <div className="launcher">
            <input value={question} onChange={(e) => setQuestion(e.target.value)} />
            <button onClick={startRun} disabled={!!runId && status === "running"}>
              {status === "running" ? "fleet running…" : "launch fleet"}
            </button>
          </div>
        )}
        {status && <span className={`status ${status}`}>{status}</span>}
      </header>

      <div className="panes">
        <section>
          <h2>memory ledger <small>{live.length} live / {dead.length} superseded</small></h2>
          {live.map((f) => (
            <article key={f.id} className="finding">
              <p>{f.content.claim}</p>
              <footer>
                conf {f.confidence.toFixed(2)} ·{" "}
                {f.provenance.map((p) => (
                  <a key={p.url} href={p.url}>{p.title}</a>
                ))}
              </footer>
            </article>
          ))}
          {dead.map((f) => (
            <article key={f.id} className="finding dead">
              <p><s>{f.content.claim}</s></p>
              <footer>
                superseded by → {f.superseded_by && byId[f.superseded_by]
                  ? byId[f.superseded_by].content.claim.slice(0, 80) : f.superseded_by}
              </footer>
            </article>
          ))}
        </section>

        <section>
          <h2>resolution events <small>{ledger.events.length}</small></h2>
          {[...ledger.events].reverse().map((e) => (
            <article key={e.id} className="event">
              <b style={{ color: OP_COLOR[e.op] }}>{e.op}</b> {e.candidate_title}
              {e.reason && <i> — {e.reason}</i>}
            </article>
          ))}
          {health && (
            <>
              <h2>memory health (via CockroachDB MCP)</h2>
              <pre>{JSON.stringify(health, null, 2)}</pre>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
