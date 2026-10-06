"""
Application configuration — reads all settings from environment / .env file.
"""
import json
from typing import List
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Database ──────────────────────────────────────────────
    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/sentinelai"

    # ── JWT ───────────────────────────────────────────────────
    SECRET_KEY: str = "change-this-secret-key-to-something-secure-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    # ── First Admin Seed ──────────────────────────────────────
    FIRST_ADMIN_NAME: str = "Administrator"
    FIRST_ADMIN_EMAIL: str = "admin@sentinelai.com"
    FIRST_ADMIN_PASSWORD: str = "Admin@12345"

    # ── YOLOv11 ───────────────────────────────────────────────
    MODEL_PATH: str = "./model/best.pt"
    CONFIDENCE_THRESHOLD: float = 0.35
    IOU_THRESHOLD: float = 0.45
    IMAGE_SIZE: int = 640
    DEVICE: str = "auto"
    FRAME_SKIP: int = 1
    VIOLATION_CONFIRMATION_FRAMES: int = 3
    INCIDENT_COOLDOWN_SECONDS: int = 30
    # Comma-separated list of PPE items required for compliance.
    # Use canonical names matching SH17 dataset aliases:
    #   helmet, vest, gloves, goggles, boots, mask, ear_protection, face_guard, suit
    REQUIRED_PPE: str = "helmet,vest,gloves"

    # ── Storage ───────────────────────────────────────────────
    UPLOAD_DIR: str = "./storage/uploads"
    STORAGE_DIR: str = "./storage"
    INCIDENTS_DIR: str = "./storage/incidents"

    # ── CORS ──────────────────────────────────────────────────
    CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000", "http://localhost:8080"]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return [o.strip() for o in v.split(",")]
        return v


settings = Settings()
