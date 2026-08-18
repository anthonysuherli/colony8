"""A stateless researcher: search -> read colony memory -> extract -> submit via resolver."""
from __future__ import annotations

import logging

from colony8.memory.resolver import submit_finding
from colony8.memory.store import log_event, recall_colony

log = logging.getLogger(__name__)

# recall_colony returns nearest neighbors unconditionally; below this cosine floor a
# neighbor is noise, not context, and must not enter the prompt or log an INJECT.
INJECT_THRESHOLD = 0.35


def research_subtopic(pool, run_id: str, subtopic: str, *, embed_fn, classify_fn,
                      search_fn, extract_fn) -> dict:
    submitted, failed, injected = 0, False, False
    try:
        sources = search_fn(subtopic)
    except Exception:  # noqa: BLE001 — a dead search API fails the subtopic, not the run
        log.exception("search failed for %r", subtopic)
        return {"subtopic": subtopic, "submitted": 0, "failed": True}
    for source in sources:
        try:
            matches = [m for m in recall_colony(pool, embed_fn(subtopic), k=5)
                       if m.similarity >= INJECT_THRESHOLD]
            foreign = [m for m in matches if m.run_id != run_id]
            if foreign and not injected:
                # Another session's memory is entering this agent's prompt: commit the
                # moment to the ledger so the injection is auditable, not implicit.
                injected = True
                with pool.connection() as conn:
                    log_event(conn, run_id, "INJECT", subtopic, target_id=foreign[0].id,
                              reason=f"{len(foreign)} claims from prior sessions "
                                     f"injected into researcher context")
            for cand in extract_fn(subtopic, source, [m.claim for m in matches]):
                submit_finding(pool, run_id, cand, embed_fn, classify_fn)
                submitted += 1
        except Exception:  # noqa: BLE001
            log.exception("extract/submit failed for %s", source.get("url"))
            failed = True
    return {"subtopic": subtopic, "submitted": submitted, "failed": failed}
