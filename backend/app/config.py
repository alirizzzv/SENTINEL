"""Runtime configuration.

SQLite by default so the backend runs with zero setup (great for the demo and
tests). Point DATABASE_URL at Postgres for production, e.g.
    postgresql+psycopg2://user:pass@host:5432/sentinel
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="SENTINEL_", env_file=".env")

    database_url: str = "sqlite:///./sentinel.db"
    # Demo org bootstrapped on startup so the API is usable out of the box.
    seed_demo_org: bool = True
    demo_api_key: str = "demo-key-sentinel"


settings = Settings()
