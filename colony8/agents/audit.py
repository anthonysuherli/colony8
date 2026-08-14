"""The fleet's introspection organ: reads its own memory through the CockroachDB
Cloud Managed MCP Server (read-only SQL over MCP), then narrates health via Bedrock.
Quickstart: https://www.cockroachlabs.com/docs/cockroachcloud/connect-to-the-cockroachdb-cloud-mcp-server
"""
from __future__ import annotations

import asyncio
import json
import logging

from colony8.ai.bedrock import llm_json
from colony8.config import get_settings

log = logging.getLogger(__name__)

NARRATE_SCHEMA = {
    "type": "object",
    "properties": {"narrative": {"type": "string"}},
    "required": ["narrative"],
    "additionalProperties": False,
}


def _token_present() -> bool:
    return bool(get_settings().crdb_mcp_token)


def _metric_queries(run_id: str) -> dict[str, str]:
    return {
        "live_findings": f"SELECT count(*) FROM findings WHERE run_id = '{run_id}' AND invalidated_at IS NULL",
        "superseded": f"SELECT count(*) FROM findings WHERE run_id = '{run_id}' AND invalidated_at IS NOT NULL",
        "supersede_events": f"SELECT count(*) FROM resolution_events WHERE run_id = '{run_id}' AND op = 'SUPERSEDE'",
        "deferred": f"SELECT count(*) FROM resolution_events WHERE run_id = '{run_id}' AND op = 'DEFERRED'",
    }


def _mcp_sql(queries: dict[str, str]) -> dict:
    """Run each query through the managed MCP server; return {name: scalar}."""

    async def _run() -> dict:
        from mcp import ClientSession
        from mcp.client.streamable_http import streamablehttp_client

        s = get_settings()
        headers = {"Authorization": f"Bearer {s.crdb_mcp_token}"}
        async with streamablehttp_client(s.crdb_mcp_url, headers=headers) as (r, w, _):
            async with ClientSession(r, w) as session:
                await session.initialize()
                tools = await session.list_tools()
                sql_tool = next(t.name for t in tools.tools if "sql" in t.name.lower())
                out: dict = {}
                for name, q in queries.items():
                    res = await session.call_tool(sql_tool, {"query": q})
                    text = res.content[0].text if res.content else "0"
                    digits = "".join(c for c in text if c.isdigit())
                    out[name] = int(digits) if digits else text
                return out

    return asyncio.run(_run())


def audit_memory(pool, run_id: str) -> dict | None:
    if not _token_present():
        log.warning("CRDB_MCP_TOKEN unset; skipping memory audit")
        return None
    try:
        metrics = _mcp_sql(_metric_queries(run_id))
    except Exception:  # noqa: BLE001 — audit must never sink the run
        log.exception("MCP audit failed")
        return None
    total = metrics.get("live_findings", 0) + metrics.get("superseded", 0)
    metrics["contradiction_rate"] = (
        round(metrics.get("supersede_events", 0) / total, 3) if total else 0.0
    )
    narrated = llm_json(
        "Write ONE paragraph (<=60 words) summarizing this agent-memory health report. "
        f"Metrics: {json.dumps(metrics)}",
        NARRATE_SCHEMA,
    )
    health = {**metrics, **narrated}
    with pool.connection() as conn:
        conn.execute("UPDATE runs SET health = %s WHERE id = %s", (json.dumps(health), run_id))
    return health
