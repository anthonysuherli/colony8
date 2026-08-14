"""Fan the fleet out on threads. Agents hold no state: CockroachDB is the only shared thing."""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor

from colony8.agents.researcher import research_subtopic
from colony8.config import get_settings


def _default_deps() -> dict:
    from colony8.agents.extractor import extract_findings
    from colony8.agents.planner import plan_subtopics
    from colony8.ai.bedrock import embed
    from colony8.ai.classifier import classify
    from colony8.search import search_sources

    return {"plan_fn": plan_subtopics, "search_fn": search_sources,
            "extract_fn": extract_findings, "classify_fn": classify, "embed_fn": embed}


def run_fleet(pool, run_id: str, question: str, *, fleet_size: int | None = None,
              deps: dict | None = None) -> dict:
    try:
        d = deps or _default_deps()
        n = fleet_size or get_settings().fleet_size
        subtopics = d["plan_fn"](question, n)
        with ThreadPoolExecutor(max_workers=n) as ex:
            results = list(
                ex.map(
                    lambda st: research_subtopic(
                        pool, run_id, st, embed_fn=d["embed_fn"],
                        classify_fn=d["classify_fn"], search_fn=d["search_fn"],
                        extract_fn=d["extract_fn"],
                    ),
                    subtopics,
                )
            )
        any_failed = any(r["failed"] for r in results)
        status = "completed_with_failures" if any_failed else "completed"
        with pool.connection() as conn:
            conn.execute("UPDATE runs SET status = %s WHERE id = %s", (status, run_id))
        from colony8.agents.audit import audit_memory
        try:
            audit_memory(pool, run_id)
        except Exception:  # noqa: BLE001
            pass
        return {"status": status, "submitted": sum(r["submitted"] for r in results),
                "results": results}
    except Exception:
        with pool.connection() as conn:
            conn.execute("UPDATE runs SET status = %s WHERE id = %s", ("failed", run_id))
        raise
