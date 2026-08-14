from __future__ import annotations

from colony8.config import get_settings


def test_defaults_load() -> None:
    s = get_settings()
    assert s.embed_dim == 1024
    assert s.bedrock_model_id.startswith("anthropic.")
    assert s.database_url.startswith("postgresql://")
