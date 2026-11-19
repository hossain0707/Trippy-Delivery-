from functools import lru_cache
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: Literal["local", "test", "preview", "staging", "production"] = "local"
    database_url: str = "postgresql+psycopg://trippy:local_only_change_me@localhost:5433/trippy"
    cors_origins: str = "http://localhost:3000"
    allow_dev_auth: bool = False
    jwt_issuer: str | None = None
    jwt_audience: str | None = None
    jwt_jwks_url: str | None = None
    google_client_id: str | None = None
    google_admin_email: str | None = None
    google_admin_subject: str | None = None
    live_orders_enabled: bool = False
    pilot_approved: bool = False
    active_cities: str = "dhaka"
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @model_validator(mode="after")
    def validate_environment(self):
        if self.app_env in ("preview", "staging", "production") and self.allow_dev_auth:
            raise ValueError("Development auth is forbidden for hosted environments")
        if self.app_env in ("staging", "production") and not self.google_client_id and not all(
            [self.jwt_issuer, self.jwt_audience, self.jwt_jwks_url]
        ):
            raise ValueError("JWT issuer, audience and JWKS URL are required")
        return self

    @property
    def cities(self) -> set[str]:
        return {value.strip().lower() for value in self.active_cities.split(",") if value.strip()}


@lru_cache
def settings() -> Settings:
    return Settings()
