# app/core/chat_config.py
from pydantic_settings import BaseSettings
from pathlib import Path
from typing import Dict
from pydantic import PrivateAttr
import threading


class Settings(BaseSettings):
    PROJECT_NAME: str = "Ollama Gemma3 Chatbot"
    VERSION: str = "1.0.0"
    STORAGE_DIR: Path = Path("chat_data")
    SESSIONS_DIR: Path = STORAGE_DIR / "sessions"
    SESSION_INDEX_FILE: Path = STORAGE_DIR / "session_index.json"
    SYSTEM_PROMPT: str = """You are a helpful, knowledgeable, and friendly AI assistant. You provide clear, accurate, and contextually relevant responses. You maintain conversation context within the current session and build upon previous exchanges naturally. You are curious, thoughtful, and aim to be genuinely helpful to users."""

    # Runtime-only attributes (not part of settings validation)
    chat_sessions: Dict = {}
    session_index: Dict = {}
    _save_lock: threading.Lock = PrivateAttr(default_factory=threading.Lock)
    _auto_save_thread: threading.Thread = PrivateAttr(default=None)
    _shutdown: bool = PrivateAttr(default=False)

    class Config:
        env_file = ".env"


# Instantiate once
settings = Settings()

# Ensure storage directories exist
settings.STORAGE_DIR.mkdir(exist_ok=True)
settings.SESSIONS_DIR.mkdir(exist_ok=True)
