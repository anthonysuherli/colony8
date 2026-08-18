"""Env-backed settings. Secrets in .env; everything is overridable per-process."""
from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql://root@localhost:26257/defaultdb?sslmode=disable"
    aws_region: str = "us-east-1"
    bedrock_model_id: str = "us.amazon.nova-pro-v1:0"
    bedrock_embed_model_id: str = "amazon.titan-embed-text-v2:0"
    embed_dim: int = 1024
    tavily_api_key: str = ""
    demo_mode: bool = False
    crdb_mcp_url: str = "https://cockroachlabs.cloud/mcp"
    crdb_mcp_token: str = ""
    fleet_size: int = 3
    allow_launch: bool = True


@lru_cache
def get_settings() -> Settings:
    return Settings()
