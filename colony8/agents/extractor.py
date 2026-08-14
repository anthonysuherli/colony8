"""Turn one source into claim-shaped Candidates. Provenance is the source, always."""
from __future__ import annotations

from colony8.ai.bedrock import llm_json
from colony8.memory.store import Candidate

SCHEMA = {
    "type": "object",
    "properties": {
        "findings": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "claim": {"type": "string"},
                    "quote": {"type": "string"},
                    "confidence": {"type": "number"},
                },
                "required": ["title", "claim", "confidence"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["findings"],
    "additionalProperties": False,
}

PROMPT = """Extract 1-3 atomic, claim-shaped findings about "{subtopic}" from this source.
Each claim must be a single verifiable statement grounded in the text (include a short
supporting quote when possible). Skip anything the shared memory already knows:
{known}

SOURCE ({title}):
{content}
"""


def extract_findings(subtopic: str, source: dict, known_claims: list[str]) -> list[Candidate]:
    known = "\n".join(f"- {c}" for c in known_claims) or "- (memory is empty)"
    out = llm_json(
        PROMPT.format(subtopic=subtopic, known=known, title=source["title"],
                      content=source["content"][:6000]),
        SCHEMA,
    )
    prov = [{"url": source["url"], "title": source["title"]}]
    return [
        Candidate(title=f["title"][:200], claim=f["claim"], quote=f.get("quote"),
                  provenance=prov, confidence=min(max(f["confidence"], 0.0), 1.0))
        for f in out["findings"]
    ]
