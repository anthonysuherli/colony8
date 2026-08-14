"""ADD/UPDATE/NOOP/SUPERSEDE verdicts. Runs OUTSIDE any transaction (snapshot phase)."""
from __future__ import annotations

from colony8.ai.bedrock import llm_json
from colony8.memory.resolver import Decision
from colony8.memory.store import Candidate, Match

SCHEMA = {
    "type": "object",
    "properties": {
        "op": {"type": "string", "enum": ["ADD", "UPDATE", "NOOP", "SUPERSEDE"]},
        "target_id": {"type": "string"},
        "reason": {"type": "string"},
    },
    "required": ["op", "reason"],
    "additionalProperties": False,
}

PROMPT = """You maintain a shared research memory for a fleet of agents. A new candidate
finding arrived. Compare it against the existing similar findings and pick ONE operation:

- NOOP: candidate says the same thing as an existing finding (no new information)
- UPDATE: candidate refines, extends, or adds precision to an existing finding
- SUPERSEDE: candidate CONTRADICTS an existing finding and is better supported or newer
- ADD: candidate is about something the existing findings do not cover

For UPDATE/NOOP/SUPERSEDE, set target_id to the id of the affected existing finding.
Give a one-sentence reason.

CANDIDATE: {claim}

EXISTING FINDINGS:
{matches}
"""


def classify(cand: Candidate, matches: list[Match]) -> Decision:
    listing = "\n".join(f"- id={m.id} (similarity {m.similarity:.2f}): {m.claim}" for m in matches)
    verdict = llm_json(PROMPT.format(claim=cand.claim, matches=listing), SCHEMA)
    op = verdict["op"]
    target = verdict.get("target_id")
    valid_ids = {m.id for m in matches}
    if op != "ADD" and target not in valid_ids:
        return Decision(op="ADD", reason="classifier returned unknown target; treated as new")
    return Decision(op=op, target_id=target if op != "ADD" else None, reason=verdict["reason"])
