"""A stateless researcher: search -> read memory -> extract -> submit via resolver."""
from __future__ import annotations

import logging

from colony8.memory.resolver import submit_finding
from colony8.memory.store import recall

log = logging.getLogger(__name__)


def research_subtopic(pool, run_id: str, subtopic: str, *, embed_fn, classify_fn,
                      search_fn, extract_fn) -> dict:
    submitted, failed = 0, False
    try:
        sources = search_fn(subtopic)
    except Exception:  # noqa: BLE001 — a dead search API fails the subtopic, not the run
        log.exception("search failed for %r", subtopic)
        return {"subtopic": subtopic, "submitted": 0, "failed": True}
    for source in sources:
        try:
            known = [m.claim for m in recall(pool, run_id, embed_fn(subtopic), k=5)]
            for cand in extract_fn(subtopic, source, known):
                submit_finding(pool, run_id, cand, embed_fn, classify_fn)
                submitted += 1
        except Exception:  # noqa: BLE001
            log.exception("extract/submit failed for %s", source.get("url"))
            failed = True
    return {"subtopic": subtopic, "submitted": submitted, "failed": failed}
