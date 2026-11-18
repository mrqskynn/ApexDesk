"""FastAPI application entrypoint and routes for AI-HAS."""

from contextlib import asynccontextmanager
import csv
from datetime import datetime, timedelta, timezone
import io
import json
import logging
from pathlib import Path
import sys
import time
from typing import Any, Dict, List, Optional

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from openai import OpenAI
from pydantic import BaseModel
from sqlalchemy import func, text
from sqlalchemy.orm import Session

# Allow running from either project root (`uvicorn backend.main:app`) or `backend/`
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.auth import (  # noqa: E402
    VALID_ROLES,
    CurrentUser,
    LoginRequest,
    LoginResponse,
    authenticate_user,
    require_role,
)
from backend.config import (  # noqa: E402
    DATA_DIR,
    KB_DIR,
    OPENAI_API_KEY,
    OPENAI_BASE_URL,
    OPENAI_CHAT_MODEL,
    OPENAI_EMBEDDING_MODEL,
    RETRIEVAL_MIN_SCORE,
    RETRIEVAL_TOP_K,
)
from backend.db import get_db, init_db  # noqa: E402
from backend.guardrails import (  # noqa: E402
    INJECTION_REFUSAL_MESSAGE,
    check_rate_limit,
    detect_prompt_injection,
    redact_pii,
)
from backend.llm import answer_with_rag  # noqa: E402
from backend.models import ChatLog, Ticket, ToolAuditLog, User  # noqa: E402
from backend.rag import (  # noqa: E402
    get_chroma_collection,
    index_kb,
    list_kb_documents,
    match_sop_for_ticket,
    retrieve,
    warm_query_embeddings,
)
from backend.tools import execute_tool  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("ai_has.main")

ALLOWED_KB_EXTENSIONS = {".md", ".txt"}
SLA_SETTINGS_PATH = DATA_DIR / "sla_settings.json"
DEFAULT_SLA_SETTINGS: Dict[str, Any] = {
    "urgent_minutes": 60,
    "high_minutes": 240,
    "medium_minutes": 720,
    "low_minutes": 1440,
    "retrieval_min_score": RETRIEVAL_MIN_SCORE,
    "redact_pii": True,
    "detect_injection": True,
}


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Initialize SQLite tables and, on a fresh disk (e.g. Render free tier), the KB index."""
    init_db()

    # Free hosting wipes the disk on redeploy, so rebuild the vector index if it is empty.
    try:
        if OPENAI_API_KEY and get_chroma_collection().count() == 0:
            index_kb(KB_DIR)
    except Exception as exc:  # never block startup on indexing problems
        logger.warning("Startup KB auto-index skipped: %s", exc)
    yield


app = FastAPI(title="AI-HAS Helpdesk API", lifespan=lifespan)

# Let the Vercel-hosted website call this API. Auth is header-based (no cookies), so "*" is fine for the demo.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    """Request payload for POST /chat."""

    session_id: str
    message: str
    role: str = "user"


class Citation(BaseModel):
    """Citation entry referencing a knowledge base SOP."""

    title: str
    snippet: str
    source: str = ""
    section: str = ""
    score: Optional[float] = None


class ChatResponse(BaseModel):
    """Response payload for POST /chat."""

    reply: str
    citations: List[Citation]
    action_taken: Optional[str] = None
    escalated: bool = False
    latency_ms: float


class TicketItem(BaseModel):
    """Serialized ticket returned by ticket endpoints."""

    id: int
    user_id: Optional[int] = None
    title: str
    description: str
    priority: str
    status: str
    assignee: str = "Unassigned"
    notes: List[Dict[str, Any]] = []
    created_at: str
    updated_at: str = ""
    resolved_at: Optional[str] = None
    sla_status: str = "active"
    sla_label: str = ""
    suggested_sop: Optional[Dict[str, Any]] = None


class AuditLogItem(BaseModel):
    """Serialized tool audit log entry for agents and admins."""

    id: int
    tool_name: str
    arguments: Dict[str, Any] = {}
    status: str
    actor: str
    ticket_id: Optional[int] = None
    webhook_sent: bool = False
    result: Dict[str, Any] = {}
    created_at: str


class MetricsResponse(BaseModel):
    """Admin KPI metrics returned by GET /metrics."""

    total_chats: int
    deflection_rate: float
    avg_latency_ms: float
    escalation_count: int
    escalation_rate: float = 0.0
    mttr_minutes: float = 0.0
    avg_rag_score: float = 0.0
    total_tokens: int = 0
    total_cost_usd: float = 0.0
    recent_llm_calls: List[Dict[str, Any]] = []
    tickets_by_status: Dict[str, int]


class UserItem(BaseModel):
    """Serialized user returned by admin user-management endpoints."""

    id: int
    username: str
    name: str
    role: str


class UpdateUserRoleRequest(BaseModel):
    """Payload for PATCH /users/{user_id}/role."""

    role: str


class UpdateKBDocRequest(BaseModel):
    """Payload for PUT /kb/docs/{filename}."""

    content: str


class SLASettingsPayload(BaseModel):
    """Payload for GET/PUT /settings/sla."""

    urgent_minutes: int = 60
    high_minutes: int = 240
    medium_minutes: int = 720
    low_minutes: int = 1440
    retrieval_min_score: float = RETRIEVAL_MIN_SCORE
    redact_pii: bool = True
    detect_injection: bool = True


def _parse_notes(raw: Optional[str], include_internal: bool = True) -> List[Dict[str, Any]]:
    try:
        parsed = json.loads(raw or "[]")
        if not isinstance(parsed, list):
            return []
    except Exception:
        return []
    if include_internal:
        return parsed
    return [item for item in parsed if item.get("type") != "internal"]


def _parse_json_dict(raw: Optional[str]) -> Dict[str, Any]:
    try:
        parsed = json.loads(raw or "{}")
        return parsed if isinstance(parsed, dict) else {}
    except Exception:
        return {}


def _ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """Attach UTC tzinfo to naive SQLite datetimes so SLA math never throws TypeError."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _format_duration(total_seconds: int) -> str:
    """Format duration seconds as compact human-readable string (e.g., 1h 15m, 45m)."""
    mins = max(0, int(abs(total_seconds) // 60))
    hours, rem_mins = divmod(mins, 60)
    if hours >= 24:
        days, rem_hours = divmod(hours, 24)
        return f"{days}d {rem_hours}h"
    if hours > 0:
        return f"{hours}h {rem_mins}m" if rem_mins else f"{hours}h"
    return f"{max(1, rem_mins)}m"


def _compute_sla(t: Ticket, sla_settings: Optional[Dict[str, Any]] = None) -> tuple[str, str]:
    """Compute SLA status and label on the backend; stops timer on resolved tickets."""
    settings = sla_settings or _load_sla_settings()
    priority = (t.priority or "medium").strip().lower()
    target_map = {
        "urgent": int(settings.get("urgent_minutes", 60)),
        "high": int(settings.get("high_minutes", 240)),
        "medium": int(settings.get("medium_minutes", 720)),
        "low": int(settings.get("low_minutes", 1440)),
    }
    target_minutes = target_map.get(priority, int(settings.get("medium_minutes", 720)))

    created_dt = _ensure_utc(t.created_at) or datetime.now(timezone.utc)
    due_at = created_dt + timedelta(minutes=target_minutes)

    if (t.status or "").strip().lower() == "resolved":
        resolved_dt = (
            _ensure_utc(t.resolved_at)
            or _ensure_utc(t.updated_at)
            or created_dt
        )
        if resolved_dt <= due_at:
            return "met", "SLA Met"
        return "breached", "SLA Breached"

    remaining_seconds = int((due_at - datetime.now(timezone.utc)).total_seconds())
    if remaining_seconds <= 0:
        return "breached", f"SLA Breached (+{_format_duration(remaining_seconds)})"
    return "active", f"SLA: {_format_duration(remaining_seconds)} left"


def _serialize_ticket(
    t: Ticket,
    include_internal: bool = True,
    sla_settings: Optional[Dict[str, Any]] = None,
    include_sop_match: bool = True,
) -> TicketItem:
    sla_status, sla_label = _compute_sla(t, sla_settings=sla_settings)
    is_resolved = (t.status or "").strip().lower() == "resolved"

    suggested_sop = None
    if include_sop_match and not is_resolved:
        try:
            suggested_sop = match_sop_for_ticket(t.title, t.description)
        except Exception as exc:
            logger.warning("SOP match skipped for ticket %s: %s", t.id, exc)

    created_dt = _ensure_utc(t.created_at)
    updated_dt = _ensure_utc(t.updated_at) or created_dt
    resolved_dt = _ensure_utc(t.resolved_at) if is_resolved else None

    return TicketItem(
        id=t.id,
        user_id=t.user_id,
        title=t.title,
        description=t.description,
        priority=t.priority,
        status=t.status,
        assignee=t.assignee or "Unassigned",
        notes=_parse_notes(t.notes_json, include_internal=include_internal),
        created_at=created_dt.isoformat() if created_dt else "",
        updated_at=updated_dt.isoformat() if updated_dt else "",
        resolved_at=resolved_dt.isoformat() if resolved_dt else None,
        sla_status=sla_status,
        sla_label=sla_label,
        suggested_sop=suggested_sop,
    )


def _append_ticket_note(ticket: Ticket, entry: Dict[str, Any]) -> None:
    notes = _parse_notes(ticket.notes_json, include_internal=True)
    notes.append(entry)
    ticket.notes_json = json.dumps(notes)


def _safe_kb_path(filename: str) -> Path:
    safe_name = Path(filename or "").name
    suffix = Path(safe_name).suffix.lower()
    if not safe_name or suffix not in ALLOWED_KB_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Only .md or .txt files are supported.")
    kb_root = KB_DIR.resolve()
    dest = (kb_root / safe_name).resolve()
    if dest.parent != kb_root:
        raise HTTPException(status_code=400, detail="Invalid KB filename.")
    return dest


def _load_sla_settings() -> Dict[str, Any]:
    if SLA_SETTINGS_PATH.exists():
        try:
            saved = json.loads(SLA_SETTINGS_PATH.read_text(encoding="utf-8"))
            if isinstance(saved, dict):
                return {**DEFAULT_SLA_SETTINGS, **saved}
        except Exception:
            logger.warning("Failed to parse %s; falling back to defaults.", SLA_SETTINGS_PATH)
    return dict(DEFAULT_SLA_SETTINGS)


def _save_sla_settings(settings: Dict[str, Any]) -> Dict[str, Any]:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    SLA_SETTINGS_PATH.write_text(json.dumps(settings, indent=2), encoding="utf-8")
    return settings


@app.get("/health")
def health() -> dict:
    """Health check endpoint."""
    return {"status": "ok"}


@app.get("/api/health")
def api_health(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Deep health check verifying OpenAI, ChromaDB, and SQLite connectivity."""
    checks: Dict[str, Any] = {}

    # 1. SQLite check
    try:
        db.execute(text("SELECT 1"))
        checks["sqlite"] = {
            "ok": True,
            "tickets": db.query(Ticket).count(),
            "chat_logs": db.query(ChatLog).count(),
        }
    except Exception as exc:
        logger.exception("SQLite health check failed")
        checks["sqlite"] = {"ok": False, "error": str(exc)}

    # 2. ChromaDB check
    try:
        collection = get_chroma_collection(reset=False)
        chunk_count = collection.count()
        checks["chroma"] = {
            "ok": chunk_count > 0,
            "chunks_indexed": chunk_count,
        }
        if chunk_count == 0:
            checks["chroma"]["error"] = "Chroma collection is empty; run backend/index_kb.py."
    except Exception as exc:
        logger.exception("ChromaDB health check failed")
        checks["chroma"] = {"ok": False, "error": str(exc)}

    # 3. OpenAI / Gemini API check
    if not OPENAI_API_KEY:
        checks["openai"] = {
            "ok": False,
            "error": "OPENAI_API_KEY is not set in environment.",
            "model": OPENAI_CHAT_MODEL,
            "embedding_model": OPENAI_EMBEDDING_MODEL,
        }
    else:
        t0 = time.perf_counter()
        try:
            client = OpenAI(api_key=OPENAI_API_KEY, base_url=OPENAI_BASE_URL, timeout=10.0)
            client.embeddings.create(model=OPENAI_EMBEDDING_MODEL, input=["healthcheck"])
            checks["openai"] = {
                "ok": True,
                "model": OPENAI_CHAT_MODEL,
                "embedding_model": OPENAI_EMBEDDING_MODEL,
                "latency_ms": round((time.perf_counter() - t0) * 1000, 2),
            }
        except Exception as exc:
            logger.exception("OpenAI health check failed")
            checks["openai"] = {
                "ok": False,
                "model": OPENAI_CHAT_MODEL,
                "embedding_model": OPENAI_EMBEDDING_MODEL,
                "error": str(exc),
            }

    all_ok = all(item.get("ok") for item in checks.values())
    return {
        "status": "ok" if all_ok else "degraded",
        "checks": checks,
    }


@app.post("/auth/login", response_model=LoginResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)) -> LoginResponse:
    """Unified login endpoint for customers, agents, and administrators."""
    return authenticate_user(request, db=db)


@app.post("/chat", response_model=ChatResponse)
def chat(
    request: ChatRequest,
    db: Session = Depends(get_db),
    _current_user: CurrentUser = Depends(require_role("customer", "agent", "admin")),
) -> ChatResponse:
    """Answer IT questions using rate limits, guardrails, hybrid RAG, or escalate."""
    rate_key = request.session_id.strip() if request.session_id else f"user:{_current_user.id}"
    if not check_rate_limit(rate_key):
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded. Please wait before sending more messages.",
        )

    start = time.perf_counter()

    # Redact PII (emails, phones, passwords, API keys, cards, IDs) BEFORE any LLM call or SQLite logging
    redacted_message = redact_pii(request.message)
    injection_flag = detect_prompt_injection(request.message) or detect_prompt_injection(
        redacted_message
    )

    prompt_tokens = 0
    completion_tokens = 0
    total_tokens = 0
    cost_usd = 0.0
    top_rag_score = 0.0
    retrieved_chunks: List[Dict[str, Any]] = []
    outcome = "answered"

    if injection_flag:
        reply_text = INJECTION_REFUSAL_MESSAGE
        citations: List[Citation] = []
        action_taken: Optional[str] = None
        escalated = False
        outcome = "refused"
    else:
        try:
            chunks = retrieve(redacted_message, top_k=RETRIEVAL_TOP_K)
            result = answer_with_rag(redacted_message, chunks, db=db)
            reply_text = redact_pii(result["reply"])
            citations = [Citation(**c) for c in result["citations"]]
            action_taken = result["action_taken"]
            escalated = result["escalated"]
            prompt_tokens = int(result.get("prompt_tokens", 0))
            completion_tokens = int(result.get("completion_tokens", 0))
            total_tokens = int(result.get("total_tokens", 0))
            cost_usd = float(result.get("cost_usd", 0.0))
            top_rag_score = float(result.get("top_rag_score", 0.0))
            retrieved_chunks = list(result.get("retrieved_chunks", []))
            outcome = str(result.get("outcome", "escalated" if escalated else "answered"))
        except Exception:
            # Graceful degradation on upstream LLM/vector errors: escalate rather than hard crashing
            logger.exception("Error during RAG/LLM processing for session %s", request.session_id)
            reply_text = (
                "I am currently experiencing connectivity issues with our AI knowledge service. "
                "I have escalated your request to a human IT specialist who will review it shortly."
            )
            citations = []
            action_taken = "escalate_to_human"
            escalated = True
            outcome = "escalated"

    latency_ms = round((time.perf_counter() - start) * 1000, 2)
    logger.info(
        "llm_call session=%s outcome=%s latency_ms=%.2f tokens=%d cost_usd=%.6f top_rag_score=%.4f chunks=%d",
        request.session_id,
        outcome,
        latency_ms,
        total_tokens,
        cost_usd,
        top_rag_score,
        len(retrieved_chunks),
    )

    # Persist redacted chat interaction + observability telemetry to chat_logs
    try:
        log_entry = ChatLog(
            session_id=request.session_id,
            message=redacted_message,
            reply=reply_text,
            latency_ms=latency_ms,
            escalated=escalated,
            action_taken=action_taken,
            injection_flag=injection_flag,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            cost_usd=cost_usd,
            top_rag_score=top_rag_score,
            retrieved_chunks_json=json.dumps(retrieved_chunks),
            outcome=outcome,
        )
        db.add(log_entry)
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Failed to commit chat_log for session %s", request.session_id)

    return ChatResponse(
        reply=reply_text,
        citations=citations,
        action_taken=action_taken,
        escalated=escalated,
        latency_ms=latency_ms,
    )


class CreateTicketRequest(BaseModel):
    """Payload for creating a ticket."""

    title: str
    description: str
    priority: str = "medium"


class UpdateTicketRequest(BaseModel):
    """Payload for updating a ticket."""

    status: Optional[str] = None
    priority: Optional[str] = None
    assignee: Optional[str] = None


class TicketMessageRequest(BaseModel):
    """Payload for agent reply or internal note."""

    message: str


class ApproveActionRequest(BaseModel):
    """Payload for approving/executing a tool action on a ticket."""

    tool_name: str
    arguments: Dict[str, Any] = {}
    resolve_ticket: bool = False


@app.post("/tickets", response_model=TicketItem)
def create_ticket_endpoint(
    payload: CreateTicketRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("customer", "agent", "admin")),
) -> TicketItem:
    """Create a new support ticket owned by the authenticated session user."""
    from backend.tools import create_ticket

    desc = payload.description.strip()
    if "Requester:" not in desc:
        desc = f"Requester: {current_user.name} <{current_user.username}>\n\n{desc}"

    res = create_ticket(
        title=payload.title,
        description=desc,
        priority=payload.priority,
        db=db,
    )
    ticket = db.query(Ticket).filter(Ticket.id == res["ticket_id"]).first()
    ticket.user_id = current_user.id
    if not ticket.assignee:
        ticket.assignee = "Unassigned"
    db.commit()
    db.refresh(ticket)
    is_staff = current_user.role in ("agent", "admin")
    return _serialize_ticket(ticket, include_internal=is_staff, include_sop_match=is_staff)


@app.get("/tickets", response_model=List[TicketItem])
def list_tickets(
    status: Optional[str] = None,
    assignee: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("customer", "agent", "admin")),
) -> List[TicketItem]:
    """List tickets: customers see only their own tickets; agents & admins see all."""
    query = db.query(Ticket)

    if current_user.role == "customer":
        query = query.filter(Ticket.user_id == current_user.id)
    elif assignee:
        clean_assignee = assignee.strip()
        if clean_assignee.lower() == "me":
            query = query.filter(Ticket.assignee == current_user.name)
        elif clean_assignee.lower() != "all":
            query = query.filter(Ticket.assignee == clean_assignee)

    if status and status.strip().lower() != "all":
        query = query.filter(Ticket.status == status.strip().lower())

    tickets = query.order_by(Ticket.updated_at.desc(), Ticket.id.desc()).all()
    include_internal = current_user.role in ("agent", "admin")
    sla_settings = _load_sla_settings()
    if include_internal:
        non_resolved_queries = [
            f"{t.title}\n{t.description}".strip()
            for t in tickets
            if (t.status or "").strip().lower() != "resolved"
        ]
        try:
            warm_query_embeddings(non_resolved_queries)
        except Exception as exc:
            logger.warning("Failed to warm SOP query embeddings: %s", exc)
    return [
        _serialize_ticket(
            t,
            include_internal=include_internal,
            sla_settings=sla_settings,
            include_sop_match=include_internal,
        )
        for t in tickets
    ]


@app.get("/tickets/{ticket_id}", response_model=TicketItem)
def get_ticket_detail(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("customer", "agent", "admin")),
) -> TicketItem:
    """Fetch a single ticket; customers can only read tickets they own (403 otherwise)."""
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if current_user.role == "customer" and ticket.user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Forbidden: customers can only access their own tickets.",
        )

    is_staff = current_user.role in ("agent", "admin")
    return _serialize_ticket(ticket, include_internal=is_staff, include_sop_match=is_staff)


@app.patch("/tickets/{ticket_id}", response_model=TicketItem)
def update_ticket_endpoint(
    ticket_id: int,
    payload: UpdateTicketRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("agent", "admin")),
) -> TicketItem:
    """Update a ticket's status, priority, or assignee in SQLite (agent & admin)."""
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    now = datetime.now(timezone.utc)
    if payload.status:
        new_status = payload.status.strip().lower()
        ticket.status = new_status
        if new_status == "resolved":
            if ticket.resolved_at is None:
                ticket.resolved_at = now
        else:
            ticket.resolved_at = None
    if payload.priority:
        ticket.priority = payload.priority.strip().lower()
    if payload.assignee is not None:
        clean_assignee = payload.assignee.strip()
        ticket.assignee = current_user.name if clean_assignee.lower() == "me" else clean_assignee
    ticket.updated_at = now

    db.commit()
    db.refresh(ticket)
    return _serialize_ticket(ticket, include_internal=True)


@app.post("/tickets/{ticket_id}/reply", response_model=TicketItem)
def reply_to_ticket(
    ticket_id: int,
    payload: TicketMessageRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("agent", "admin")),
) -> TicketItem:
    """Append a human agent reply authored by the current session user (agent & admin)."""
    text_body = payload.message.strip()
    if not text_body:
        raise HTTPException(status_code=400, detail="Reply message cannot be empty.")

    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    now = datetime.now(timezone.utc)
    _append_ticket_note(
        ticket,
        {
            "id": f"agent-{int(time.time() * 1000)}",
            "type": "agent",
            "author": current_user.name,
            "author_id": current_user.id,
            "author_role": current_user.role,
            "time": now.isoformat(),
            "text": text_body,
        },
    )
    if ticket.status == "open":
        ticket.status = "in_progress"
    ticket.updated_at = now
    db.commit()
    db.refresh(ticket)
    return _serialize_ticket(ticket, include_internal=True)


@app.post("/tickets/{ticket_id}/notes", response_model=TicketItem)
def add_internal_note(
    ticket_id: int,
    payload: TicketMessageRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("agent", "admin")),
) -> TicketItem:
    """Append an internal staff-only note authored by current session user (agent & admin)."""
    text_body = payload.message.strip()
    if not text_body:
        raise HTTPException(status_code=400, detail="Internal note cannot be empty.")

    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    now = datetime.now(timezone.utc)
    _append_ticket_note(
        ticket,
        {
            "id": f"note-{int(time.time() * 1000)}",
            "type": "internal",
            "author": current_user.name,
            "author_id": current_user.id,
            "author_role": current_user.role,
            "time": now.isoformat(),
            "text": text_body,
        },
    )
    ticket.updated_at = now
    db.commit()
    db.refresh(ticket)
    return _serialize_ticket(ticket, include_internal=True)


@app.post("/tickets/{ticket_id}/approve-action", response_model=TicketItem)
def approve_tool_action(
    ticket_id: int,
    payload: ApproveActionRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("agent", "admin")),
) -> TicketItem:
    """Approve and execute a suggested helpdesk tool action (agent & admin)."""
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    tool_result = execute_tool(
        payload.tool_name,
        payload.arguments,
        db=db,
        approved_by=current_user.name,
    )
    if tool_result.get("status") in ("validation_error", "error"):
        raise HTTPException(
            status_code=400,
            detail=tool_result.get("message", "Tool execution failed"),
        )

    now = datetime.now(timezone.utc)
    _append_ticket_note(
        ticket,
        {
            "id": f"approve-{int(time.time() * 1000)}",
            "type": "system",
            "author": current_user.name,
            "author_id": current_user.id,
            "author_role": current_user.role,
            "time": now.isoformat(),
            "text": (
                f"Approved tool action '{payload.tool_name}' by {current_user.name}: "
                f"{tool_result.get('message', tool_result.get('status'))}"
            ),
            "audit_id": tool_result.get("audit_id"),
        },
    )
    if payload.resolve_ticket:
        ticket.status = "resolved"
        if ticket.resolved_at is None:
            ticket.resolved_at = now
    ticket.updated_at = now
    db.commit()
    db.refresh(ticket)
    return _serialize_ticket(ticket, include_internal=True)


@app.get("/metrics", response_model=MetricsResponse)
def get_metrics(
    db: Session = Depends(get_db),
    _admin: CurrentUser = Depends(require_role("admin")),
) -> MetricsResponse:
    """Return helpdesk KPIs aggregated from chat_logs and tickets (admin only)."""
    total_chats = db.query(ChatLog).count()
    escalation_count = (
        db.query(ChatLog).filter(ChatLog.escalated.is_(True)).count()
    )
    avg_latency_raw = db.query(func.avg(ChatLog.latency_ms)).scalar()

    deflection_rate = (
        round(((total_chats - escalation_count) / total_chats) * 100, 1)
        if total_chats > 0
        else 0.0
    )
    escalation_rate = (
        round((escalation_count / total_chats) * 100, 1)
        if total_chats > 0
        else 0.0
    )
    avg_latency_ms = round(float(avg_latency_raw or 0.0), 2)

    resolved_tickets = (
        db.query(Ticket)
        .filter(func.lower(Ticket.status) == "resolved", Ticket.resolved_at.isnot(None))
        .all()
    )
    mttr_durations = []
    for resolved_ticket in resolved_tickets:
        created_dt = _ensure_utc(resolved_ticket.created_at)
        resolved_dt = _ensure_utc(resolved_ticket.resolved_at)
        if created_dt and resolved_dt and resolved_dt >= created_dt:
            mttr_durations.append((resolved_dt - created_dt).total_seconds() / 60.0)
    mttr_minutes = round(sum(mttr_durations) / len(mttr_durations), 1) if mttr_durations else 0.0

    rag_avg_raw = (
        db.query(func.avg(ChatLog.top_rag_score))
        .filter(ChatLog.injection_flag.is_(False), ChatLog.top_rag_score > 0.0)
        .scalar()
    )
    avg_rag_score = round(float(rag_avg_raw or 0.0), 3)

    total_tokens = int(
        db.query(func.coalesce(func.sum(ChatLog.total_tokens), 0)).scalar() or 0
    )
    total_cost_usd = round(
        float(db.query(func.coalesce(func.sum(ChatLog.cost_usd), 0.0)).scalar() or 0.0),
        6,
    )

    recent_rows = db.query(ChatLog).order_by(ChatLog.id.desc()).limit(10).all()
    recent_llm_calls: List[Dict[str, Any]] = []
    for row in recent_rows:
        try:
            chunks_list = json.loads(row.retrieved_chunks_json or "[]")
            if not isinstance(chunks_list, list):
                chunks_list = []
        except Exception:
            chunks_list = []
        recent_llm_calls.append(
            {
                "id": row.id,
                "session_id": row.session_id,
                "message": row.message,
                "outcome": row.outcome
                or ("refused" if row.injection_flag else ("escalated" if row.escalated else "answered")),
                "latency_ms": round(float(row.latency_ms or 0.0), 2),
                "prompt_tokens": int(row.prompt_tokens or 0),
                "completion_tokens": int(row.completion_tokens or 0),
                "total_tokens": int(row.total_tokens or 0),
                "cost_usd": round(float(row.cost_usd or 0.0), 6),
                "top_rag_score": round(float(row.top_rag_score or 0.0), 4),
                "retrieved_chunks": chunks_list,
                "action_taken": row.action_taken,
                "escalated": bool(row.escalated),
                "injection_flag": bool(row.injection_flag),
                "created_at": _ensure_utc(row.created_at).isoformat() if row.created_at else "",
            }
        )

    tickets_by_status: Dict[str, int] = {
        "open": 0,
        "in_progress": 0,
        "escalated": 0,
        "resolved": 0,
    }
    grouped = (
        db.query(Ticket.status, func.count(Ticket.id))
        .group_by(Ticket.status)
        .all()
    )
    for ticket_status, count in grouped:
        tickets_by_status[ticket_status] = int(count)

    return MetricsResponse(
        total_chats=total_chats,
        deflection_rate=deflection_rate,
        avg_latency_ms=avg_latency_ms,
        escalation_count=escalation_count,
        escalation_rate=escalation_rate,
        mttr_minutes=mttr_minutes,
        avg_rag_score=avg_rag_score,
        total_tokens=total_tokens,
        total_cost_usd=total_cost_usd,
        recent_llm_calls=recent_llm_calls,
        tickets_by_status=tickets_by_status,
    )


@app.get("/metrics/export")
def export_metrics(
    format: str = "json",
    db: Session = Depends(get_db),
    _admin: CurrentUser = Depends(require_role("admin")),
):
    """Export helpdesk KPIs and ticket breakdown as JSON or CSV (admin only)."""
    summary = get_metrics(db=db, _admin=_admin)
    tickets = db.query(Ticket).order_by(Ticket.id.asc()).all()

    if format.strip().lower() == "csv":
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(["id", "user_id", "title", "priority", "status", "assignee", "created_at"])
        for t in tickets:
            writer.writerow([t.id, t.user_id, t.title, t.priority, t.status, t.assignee, t.created_at])
        return PlainTextResponse(
            content=buf.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=ai-has-analytics.csv"},
        )

    return {
        "metrics": summary.model_dump(),
        "tickets": [
            _serialize_ticket(t, include_internal=True, include_sop_match=False).model_dump()
            for t in tickets
        ],
    }


@app.get("/audit-logs", response_model=List[AuditLogItem])
def list_audit_logs(
    limit: int = 50,
    db: Session = Depends(get_db),
    _staff: CurrentUser = Depends(require_role("agent", "admin")),
) -> List[AuditLogItem]:
    """Return recent tool execution audit logs (agent & admin)."""
    safe_limit = max(1, min(limit, 200))
    rows = (
        db.query(ToolAuditLog)
        .order_by(ToolAuditLog.id.desc())
        .limit(safe_limit)
        .all()
    )
    return [
        AuditLogItem(
            id=row.id,
            tool_name=row.tool_name,
            arguments=_parse_json_dict(row.arguments_json),
            status=row.status,
            actor=row.actor or "ai_assistant",
            ticket_id=row.ticket_id,
            webhook_sent=bool(row.webhook_sent),
            result=_parse_json_dict(row.result_json),
            created_at=_ensure_utc(row.created_at).isoformat() if row.created_at else "",
        )
        for row in rows
    ]


@app.get("/settings/sla")
def get_sla_settings(
    _admin: CurrentUser = Depends(require_role("admin")),
) -> Dict[str, Any]:
    """Read SLA & guardrail settings (admin only)."""
    return _load_sla_settings()


@app.put("/settings/sla")
def update_sla_settings(
    payload: SLASettingsPayload,
    _admin: CurrentUser = Depends(require_role("admin")),
) -> Dict[str, Any]:
    """Update SLA & guardrail settings (admin only)."""
    return _save_sla_settings(payload.model_dump())


@app.get("/users", response_model=List[UserItem])
def list_users(
    db: Session = Depends(get_db),
    _admin: CurrentUser = Depends(require_role("admin")),
) -> List[UserItem]:
    """List all helpdesk users and roles (admin only)."""
    users = db.query(User).order_by(User.id.asc()).all()
    return [UserItem(id=u.id, username=u.username, name=u.name, role=u.role) for u in users]


@app.patch("/users/{user_id}/role", response_model=UserItem)
def update_user_role(
    user_id: int,
    payload: UpdateUserRoleRequest,
    db: Session = Depends(get_db),
    _admin: CurrentUser = Depends(require_role("admin")),
) -> UserItem:
    """Update a user's RBAC role (admin only)."""
    new_role = normalize_role(payload.role)
    if new_role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role '{payload.role}'. Must be customer, agent, or admin.")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.role = new_role
    db.commit()
    db.refresh(user)
    return UserItem(id=user.id, username=user.username, name=user.name, role=user.role)


@app.get("/kb/docs")
def get_kb_docs(_admin: CurrentUser = Depends(require_role("admin"))) -> dict:
    """List all SOP files currently present in /kb (admin only)."""
    return {"documents": list_kb_documents(KB_DIR)}


@app.post("/kb/upload")
async def upload_kb_doc(
    file: UploadFile = File(...),
    _admin: CurrentUser = Depends(require_role("admin")),
) -> dict:
    """Save an uploaded .md/.txt SOP file into /kb and re-index ChromaDB (admin only)."""
    dest = _safe_kb_path(file.filename or "")

    raw_bytes = await file.read()
    try:
        content = raw_bytes.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise HTTPException(
            status_code=400,
            detail="Uploaded file must be UTF-8 encoded text.",
        ) from exc

    KB_DIR.mkdir(parents=True, exist_ok=True)
    dest.write_text(content, encoding="utf-8")

    try:
        summary = index_kb(KB_DIR)
    except Exception as exc:
        logger.exception("KB indexing failed during upload")
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return {
        "status": "ok",
        "filename": dest.name,
        **summary,
        "documents": list_kb_documents(KB_DIR),
    }


@app.put("/kb/docs/{filename}")
def update_kb_doc(
    filename: str,
    payload: UpdateKBDocRequest,
    _admin: CurrentUser = Depends(require_role("admin")),
) -> dict:
    """Create or update a markdown/text SOP in /kb and re-index ChromaDB (admin only)."""
    dest = _safe_kb_path(filename)
    KB_DIR.mkdir(parents=True, exist_ok=True)
    dest.write_text(payload.content, encoding="utf-8")

    try:
        summary = index_kb(KB_DIR)
    except Exception as exc:
        logger.exception("KB indexing failed during update of %s", dest.name)
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return {
        "status": "ok",
        "filename": dest.name,
        **summary,
        "documents": list_kb_documents(KB_DIR),
    }


@app.delete("/kb/docs/{filename}")
def delete_kb_doc(
    filename: str,
    _admin: CurrentUser = Depends(require_role("admin")),
) -> dict:
    """Delete an SOP file from /kb and re-index ChromaDB (admin only)."""
    dest = _safe_kb_path(filename)
    if not dest.exists():
        raise HTTPException(status_code=404, detail="KB document not found")
    dest.unlink()

    try:
        summary = index_kb(KB_DIR)
    except Exception as exc:
        logger.exception("KB indexing failed after deleting %s", dest.name)
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return {
        "status": "ok",
        "deleted": dest.name,
        **summary,
        "documents": list_kb_documents(KB_DIR),
    }


@app.post("/kb/reindex")
def reindex_kb(_admin: CurrentUser = Depends(require_role("admin"))) -> dict:
    """Re-index all SOP files in /kb into ChromaDB (admin only)."""
    try:
        summary = index_kb(KB_DIR)
    except Exception as exc:
        logger.exception("KB reindex failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return {
        "status": "ok",
        **summary,
        "documents": list_kb_documents(KB_DIR),
    }

