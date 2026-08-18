"""Bedrock access via boto3: Claude through the Converse API, embeddings via Titan.

Converse with a forced tool call carries the JSON-schema contract. The Anthropic SDK's
InvokeModel path is gated on a per-account use-case form that Converse is not, so
Converse is also the more portable choice for judges reproducing the deploy.
"""
from __future__ import annotations

import json
from functools import lru_cache

import boto3

from colony8.config import get_settings


@lru_cache
def _bedrock_rt():
    return boto3.client("bedrock-runtime", region_name=get_settings().aws_region)


def llm_json(prompt: str, schema: dict, max_tokens: int = 2000) -> dict:
    s = get_settings()
    resp = _bedrock_rt().converse(
        modelId=s.bedrock_model_id,
        messages=[{"role": "user", "content": [{"text": prompt}]}],
        inferenceConfig={"maxTokens": max_tokens},
        toolConfig={
            "tools": [{"toolSpec": {
                "name": "emit",
                "description": "Return the answer as structured JSON.",
                "inputSchema": {"json": schema},
            }}],
            "toolChoice": {"tool": {"name": "emit"}},
        },
    )
    for block in resp["output"]["message"]["content"]:
        if "toolUse" in block:
            return block["toolUse"]["input"]
    raise RuntimeError(f"no structured output returned (stopReason={resp.get('stopReason')})")


def embed(text: str) -> list[float]:
    s = get_settings()
    body = json.dumps({"inputText": text[:8000], "dimensions": s.embed_dim, "normalize": True})
    out = _bedrock_rt().invoke_model(modelId=s.bedrock_embed_model_id, body=body)
    return json.loads(out["body"].read())["embedding"]
