from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    PROJECT_NAME: str = "Raptor API"
    ENVIRONMENT: str = "development"
    DATABASE_URL: str = "sqlite:///./raptor.db"
    SECRET_KEY: str = "raptor-secret-key-change-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day
    CORS_ORIGINS: List[str] = ["http://localhost:8080", "http://localhost:5173", "http://127.0.0.1:8080"]

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
