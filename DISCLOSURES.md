# Disclosures (hackathon rules compliance)

- All code in this repository was newly written during the submission window
  (2026-08-13 onward) with AI coding-assistant support (permitted by the rules).
- The repository is public and MIT-licensed. `LICENSE` landed in the third commit,
  within the first hour of the project; the first two commits contain only the
  project vision document.
- The ADD/UPDATE/NOOP/SUPERSEDE resolution semantics are inspired by the public
  open-source delapan project (github.com/anthonysuherli/delapan) by the same
  author; no code was copied.
- Third-party services: Tavily (web search). The demo corpus in `demo/sources.json`
  is original content written for this project.
- Recording note: in `demo/colony8-demo.mp4`, the UI segments were recorded with the
  Bedrock LLM calls replaced by deterministic stubs (the recording machine has no AWS
  credentials). The resolver, the serializable CockroachDB transactions, the supersede
  chains, the colony-wide recall, the INJECT event, the ledger API and the test run on
  camera are all real and unmodified. In the cross-session segment, the stub extractor
  honors the real prompt's "skip anything the shared memory already knows" instruction
  by exact claim match. From 0:09 to 1:20 a "context anchor" schematic panel is
  composited beside the footage (motion graphics, rendered with Remotion); the footage
  next to it is scaled to fit but otherwise untouched. The panel's dimmed
  "session 3/4/N" lanes are illustrative — the recorded run contains sessions 1 and 2
  only; everything else in the panel mirrors events actually on camera. The comparison
  card at 2:03-2:19 is likewise re-authored over the recorded one and reports measured
  output from `scripts/compare.py`. The rows named for Zep/Graphiti, Mem0 and Letta are
  **this repository's reimplementations of the resolution algorithms those systems
  document publicly** — no vendor code was run and these are not their products' scores;
  the card says so on screen.
