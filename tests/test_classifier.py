from __future__ import annotations

from colony8.ai import classifier
from colony8.memory.store import Candidate, Match

PROV = [{"url": "https://example.com/a", "title": "Source A"}]


def test_classify_parses_verdict(monkeypatch) -> None:
    monkeypatch.setattr(
        classifier, "llm_json",
        lambda prompt, schema, **kw: {
            "op": "SUPERSEDE", "target_id": "abc", "reason": "contradicts",
        },
    )
    cand = Candidate(title="t", claim="water boils at 100C", quote=None, provenance=PROV)
    matches = [Match(id="abc", title="old", claim="water boils at 90C", version=1, similarity=0.92)]
    d = classifier.classify(cand, matches)
    assert d.op == "SUPERSEDE" and d.target_id == "abc"


def test_classify_bad_target_falls_back_to_add(monkeypatch) -> None:
    monkeypatch.setattr(
        classifier, "llm_json",
        lambda prompt, schema, **kw: {"op": "SUPERSEDE", "target_id": "not-a-match", "reason": "?"},
    )
    cand = Candidate(title="t", claim="c", quote=None, provenance=PROV)
    matches = [Match(id="abc", title="old", claim="x", version=1, similarity=0.9)]
    d = classifier.classify(cand, matches)
    assert d.op == "ADD"  # never trust an id the model invented
