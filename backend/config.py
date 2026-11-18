"""Configuration loading for the AI-HAS backend."""

import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
KB_DIR = BASE_DIR / "kb"

# Load environment variables from .env at project root if present
load_dotenv(BASE_DIR / ".env")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "").strip() or None

# Auto-detect Gemini API key if custom base URL not explicitly set
if not OPENAI_BASE_URL and (OPENAI_API_KEY.startswith("AIzaSy") or OPENAI_API_KEY.startswith("AQ.")):
    OPENAI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"

_is_gemini = bool(OPENAI_BASE_URL and "generativelanguage.googleapis.com" in OPENAI_BASE_URL)
OPENAI_CHAT_MODEL = os.getenv("OPENAI_CHAT_MODEL", "gemini-3.1-flash-lite-preview" if _is_gemini else "gpt-4o-mini")
OPENAI_EMBEDDING_MODEL = os.getenv("OPENAI_EMBEDDING_MODEL", "gemini-embedding-001" if _is_gemini else "text-embedding-3-small")

WEBHOOK_URL = os.getenv("WEBHOOK_URL", "")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "changeme")

# Optional external Jira / Active Directory credentials (mocks run automatically if unset)
JIRA_API_URL = os.getenv("JIRA_API_URL", "").strip()
JIRA_API_TOKEN = os.getenv("JIRA_API_TOKEN", "").strip()
AD_API_URL = os.getenv("AD_API_URL", "").strip()
AD_API_TOKEN = os.getenv("AD_API_TOKEN", "").strip()

RETRIEVAL_TOP_K = 4
RETRIEVAL_MIN_SCORE = float(os.getenv("RETRIEVAL_MIN_SCORE", "0.35"))

DB_PATH = DATA_DIR / "app.db"
CHROMA_DIR = DATA_DIR / "chroma"
