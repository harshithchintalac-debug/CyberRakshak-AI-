"""
Central configuration. All secrets/config come from environment variables
(.env file locally). Never hardcode API keys or secrets here.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List


class Settings(BaseSettings):
    # --- App ---
    APP_NAME: str = "CyberRakshak AI"
    ENV: str = "development"
    DEBUG: bool = True

    # --- Database ---
    MONGODB_URI: str = "mongodb://localhost:27017"
    MONGODB_DB_NAME: str = "cyberrakshak"

    # --- Auth / JWT ---
    JWT_SECRET: str = "CHANGE_ME_DEV_ONLY_INSECURE_SECRET"
    JWT_REFRESH_SECRET: str = "CHANGE_ME_DEV_ONLY_INSECURE_REFRESH_SECRET"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # --- CORS ---
    CORS_ALLOWED_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
    ]

    # --- Ollama ---
    OLLAMA_HOST: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.1"
    OLLAMA_TIMEOUT_SECONDS: int = 120
    OLLAMA_ENABLED: bool = True

    # Generation determinism/quality. Low temperature + a fixed seed means the
    # same prompt reliably produces (near-)identical answers, which is what
    # "consistent AI responses" requires. Set OLLAMA_TEMPERATURE higher (and/or
    # OLLAMA_SEED=-1 to disable the fixed seed) if intentional variety is ever
    # wanted for a specific feature.
    OLLAMA_TEMPERATURE: float = 0.25
    OLLAMA_TOP_P: float = 0.9
    OLLAMA_SEED: int = 42
    OLLAMA_NUM_CTX: int = 1536
    OLLAMA_NUM_PREDICT: int = 512

    # In-memory response cache for identical first-turn prompts (e.g. the
    # "Quick Prompts" buttons). Avoids redundant Ollama calls and makes
    # repeated common questions feel instant.
    CHAT_CACHE_ENABLED: bool = True
    CHAT_CACHE_TTL_SECONDS: int = 600
    CHAT_CACHE_MAX_ENTRIES: int = 200

    # When a specific (non-auto) target language is requested, verify the
    # model actually answered in that language and retry once with a firmer
    # instruction if it didn't.
    CHAT_LANGUAGE_VERIFICATION_ENABLED: bool = False

    # --- File uploads ---
    MAX_FILE_SIZE_MB: int = 25
    MAX_IMAGE_SIZE_MB: int = 15
    MAX_VIDEO_SIZE_MB: int = 100
    UPLOAD_DIR: str = "./uploads"

    # --- Rate limiting ---
    RATE_LIMIT_DEFAULT: str = "60/minute"

    # --- Third-party threat intel (VirusTotal API) ---
    URL_REPUTATION_API_KEY: str = ""
    MALWARE_SCAN_API_KEY: str = ""
    VIRUSTOTAL_API_KEY: str = ""
    BREACH_INTEL_API_KEY: str = ""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()
