"""Bedrock access: Claude via the Anthropic Mantle client, embeddings via Titan (boto3)."""
from __future__ import annotations

import json
from functools import lru_cache

import boto3
from anthropic import AnthropicBedrockMantle

from colony8.config import get_settings


@lru_cache
def _claude() -> AnthropicBedrockMantle:
    return AnthropicBedrockMantle(aws_region=get_settings().aws_region)


@lru_cache
def _bedrock_rt():
    return boto3.client("bedrock-runtime", region_name=get_settings().aws_region)


def llm_json(prompt: str, schema: dict, max_tokens: int = 2000) -> dict:
    s = get_settings()
    resp = _claude().messages.create(
        model=s.bedrock_model_id,
        max_tokens=max_tokens,
        output_config={"format": {"type": "json_schema", "schema": schema}},
        messages=[{"role": "user", "content": prompt}],
    )
    if resp.stop_reason == "refusal":
        raise RuntimeError("model refused request")
    text = next(b.text for b in resp.content if b.type == "text")
    return json.loads(text)


def embed(text: str) -> list[float]:
    s = get_settings()
    body = json.dumps({"inputText": text[:8000], "dimensions": s.embed_dim, "normalize": True})
    out = _bedrock_rt().invoke_model(modelId=s.bedrock_embed_model_id, body=body)
    return json.loads(out["body"].read())["embedding"]
