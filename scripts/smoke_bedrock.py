"""Manual smoke: one Claude call + one Titan call. Run: uv run python scripts/smoke_bedrock.py"""
from __future__ import annotations

from colony8.ai.bedrock import embed, llm_json

v = embed("hello world")
print(f"embed ok: dim={len(v)}")
out = llm_json(
    'Return {"ok": true}',
    {"type": "object", "properties": {"ok": {"type": "boolean"}},
     "required": ["ok"], "additionalProperties": False},
)
print(f"llm ok: {out}")
