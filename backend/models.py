"""SQLAlchemy ORM models for users, tickets, and chat_logs."""

from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String, Text

from backend.db import Base


class User(Base):
    """Helpdesk user with one of: customer, agent, admin."""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    role = Column(String, nullable=False, default="customer")


class Ticket(Base):
    """IT helpdesk ticket created by users, tools, or seeded for demo."""

    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    priority = Column(String, nullable=False, default="medium")
    status = Column(String, nullable=False, default="open")
    assignee = Column(String, nullable=True, default="Unassigned")
    notes_json = Column(Text, nullable=True, default="[]")
    created_at = Column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at = Column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    resolved_at = Column(DateTime, nullable=True)


class ToolAuditLog(Base):
    """Audit log of every helpdesk tool call, approval request, and execution."""

    __tablename__ = "tool_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    tool_name = Column(String, nullable=False, index=True)
    arguments_json = Column(Text, nullable=False)
    status = Column(String, nullable=False)
    actor = Column(String, nullable=False, default="ai_assistant")
    ticket_id = Column(Integer, nullable=True, index=True)
    webhook_sent = Column(Boolean, nullable=False, default=False)
    result_json = Column(Text, nullable=True)
    created_at = Column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )


class ChatLog(Base):
    """Audit log of every chat interaction and LLM/RAG telemetry."""

    __tablename__ = "chat_logs"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, index=True, nullable=False)
    message = Column(Text, nullable=False)
    reply = Column(Text, nullable=False)
    latency_ms = Column(Float, nullable=False, default=0.0)
    escalated = Column(Boolean, nullable=False, default=False)
    action_taken = Column(String, nullable=True)
    injection_flag = Column(Boolean, nullable=False, default=False)
    prompt_tokens = Column(Integer, nullable=False, default=0)
    completion_tokens = Column(Integer, nullable=False, default=0)
    total_tokens = Column(Integer, nullable=False, default=0)
    cost_usd = Column(Float, nullable=False, default=0.0)
    top_rag_score = Column(Float, nullable=False, default=0.0)
    retrieved_chunks_json = Column(Text, nullable=True, default="[]")
    outcome = Column(String, nullable=False, default="answered")
    created_at = Column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
