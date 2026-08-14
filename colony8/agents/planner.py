"""One Bedrock call: question -> N research subtopics."""
from __future__ import annotations

from colony8.ai.bedrock import llm_json

SCHEMA = {
    "type": "object",
    "properties": {"subtopics": {"type": "array", "items": {"type": "string"}}},
    "required": ["subtopics"],
    "additionalProperties": False,
}


def plan_subtopics(question: str, n: int) -> list[str]:
    out = llm_json(
        f"Split this research question into exactly {n} focused, non-overlapping "
        f"subtopics (short noun phrases): {question}",
        SCHEMA,
    )
    return out["subtopics"][:n]
