from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://cyclestrong:cyclestrong@localhost:5432/cyclestrong"
    cors_origins: List[str] = ["http://localhost:19006", "http://localhost:8081"]

settings = Settings()
