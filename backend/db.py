"""SQLAlchemy database engine, session, and initialization helpers."""

from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

from backend.config import DATA_DIR, DB_PATH

# Ensure data directory exists before opening SQLite file
DATA_DIR.mkdir(parents=True, exist_ok=True)

SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

DEFAULT_USERS = [
    ("admin", "Jordan Vance", "admin"),
    ("jane.doe@company.com", "Jane Doe", "agent"),
    ("marcus.vance@company.com", "Marcus Vance", "customer"),
    ("elena.rostova@company.com", "Elena Rostova", "customer"),
]


def get_db():
    """Yield a SQLAlchemy database session and close it after the request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _migrate_tickets_columns() -> None:
    """Safely add RBAC/workflow/SLA columns to an existing SQLite tickets table."""
    with engine.begin() as conn:
        cols = {row[1] for row in conn.execute(text("PRAGMA table_info(tickets)")).fetchall()}
        if "user_id" not in cols:
            conn.execute(text("ALTER TABLE tickets ADD COLUMN user_id INTEGER"))
        if "assignee" not in cols:
            conn.execute(text("ALTER TABLE tickets ADD COLUMN assignee TEXT DEFAULT 'Unassigned'"))
        if "notes_json" not in cols:
            conn.execute(text("ALTER TABLE tickets ADD COLUMN notes_json TEXT DEFAULT '[]'"))
        if "updated_at" not in cols:
            conn.execute(text("ALTER TABLE tickets ADD COLUMN updated_at DATETIME"))
        if "resolved_at" not in cols:
            conn.execute(text("ALTER TABLE tickets ADD COLUMN resolved_at DATETIME"))

        # Backfill missing timestamps on existing rows
        conn.execute(text("UPDATE tickets SET updated_at = created_at WHERE updated_at IS NULL"))
        conn.execute(
            text(
                "UPDATE tickets SET resolved_at = COALESCE(updated_at, created_at) "
                "WHERE lower(status) = 'resolved' AND resolved_at IS NULL"
            )
        )


def _migrate_chat_logs_columns() -> None:
    """Safely add observability columns to an existing SQLite chat_logs table."""
    with engine.begin() as conn:
        cols = {row[1] for row in conn.execute(text("PRAGMA table_info(chat_logs)")).fetchall()}
        if "prompt_tokens" not in cols:
            conn.execute(text("ALTER TABLE chat_logs ADD COLUMN prompt_tokens INTEGER DEFAULT 0"))
        if "completion_tokens" not in cols:
            conn.execute(text("ALTER TABLE chat_logs ADD COLUMN completion_tokens INTEGER DEFAULT 0"))
        if "total_tokens" not in cols:
            conn.execute(text("ALTER TABLE chat_logs ADD COLUMN total_tokens INTEGER DEFAULT 0"))
        if "cost_usd" not in cols:
            conn.execute(text("ALTER TABLE chat_logs ADD COLUMN cost_usd REAL DEFAULT 0.0"))
        if "top_rag_score" not in cols:
            conn.execute(text("ALTER TABLE chat_logs ADD COLUMN top_rag_score REAL DEFAULT 0.0"))
        if "retrieved_chunks_json" not in cols:
            conn.execute(text("ALTER TABLE chat_logs ADD COLUMN retrieved_chunks_json TEXT DEFAULT '[]'"))
        if "outcome" not in cols:
            conn.execute(text("ALTER TABLE chat_logs ADD COLUMN outcome TEXT DEFAULT 'answered'"))


def ensure_default_users() -> None:
    """Ensure baseline admin, agent, and customer demo users exist."""
    from backend.models import User

    db = SessionLocal()
    try:
        for username, name, role in DEFAULT_USERS:
            existing = db.query(User).filter(User.username == username).first()
            if not existing:
                db.add(User(username=username, name=name, role=role))
            else:
                # Keep canonical seed role/name consistent (e.g. Jane Doe stays agent)
                existing.name = name
                existing.role = role
        db.commit()
    finally:
        db.close()


def init_db() -> None:
    """Import models, create missing tables/columns, and ensure baseline users."""
    import backend.models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _migrate_tickets_columns()
    _migrate_chat_logs_columns()
    ensure_default_users()
