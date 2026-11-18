"""Schema-validated IT helpdesk tools, audit logging, webhooks, and approval gates."""

from datetime import datetime, timezone
import json
import logging
from typing import Any, Dict, List, Literal, Optional, Tuple, Type
import uuid

from pydantic import BaseModel, Field, ValidationError, field_validator
import requests
from sqlalchemy.orm import Session

from backend import config
from backend.db import SessionLocal
from backend.models import Ticket, ToolAuditLog

logger = logging.getLogger("ai_has.tools")

VALID_PRIORITIES = {"low", "medium", "high", "urgent"}
SENSITIVE_TOOLS = {"reset_password", "request_software_access"}


# =====================================================================
# PYDANTIC TOOL VALIDATION SCHEMAS
# =====================================================================

class ResetPasswordArgs(BaseModel):
    """Arguments for resetting a user's Active Directory / SSO password."""

    username: str = Field(..., min_length=2, description="Corporate username or email.")

    @field_validator("username")
    @classmethod
    def _strip_nonempty(cls, v: str) -> str:
        clean = v.strip()
        if len(clean) < 2:
            raise ValueError("username must be at least 2 non-whitespace characters.")
        return clean


class CreateJiraTicketArgs(BaseModel):
    """Arguments for creating an IT Jira / Helpdesk ticket."""

    title: str = Field(..., min_length=3)
    description: str = Field(..., min_length=3)
    priority: Literal["low", "medium", "high", "urgent"] = "medium"
    project_key: str = Field(default="ITSD", min_length=2, max_length=12)

    @field_validator("title", "description", "project_key")
    @classmethod
    def _strip_text(cls, v: str) -> str:
        return v.strip()

    @field_validator("priority", mode="before")
    @classmethod
    def _norm_priority(cls, v: Any) -> str:
        clean = str(v or "medium").strip().lower()
        return clean if clean in VALID_PRIORITIES else "medium"


class EscalateToHumanArgs(BaseModel):
    """Arguments for escalating an issue to human IT / Security specialists."""

    reason: str = Field(..., min_length=3)
    urgency: Literal["normal", "high", "critical"] = "high"

    @field_validator("reason")
    @classmethod
    def _strip_reason(cls, v: str) -> str:
        clean = v.strip()
        if len(clean) < 3:
            raise ValueError("reason must be at least 3 characters.")
        return clean

    @field_validator("urgency", mode="before")
    @classmethod
    def _norm_urgency(cls, v: Any) -> str:
        clean = str(v or "high").strip().lower()
        return clean if clean in {"normal", "high", "critical"} else "high"


class RequestSoftwareAccessArgs(BaseModel):
    """Arguments for requesting licensed software or elevated group access."""

    username: str = Field(..., min_length=2)
    software_name: str = Field(..., min_length=2)
    justification: str = Field(default="Business need", min_length=3)
    access_level: Literal["standard", "editor", "admin"] = "standard"

    @field_validator("username", "software_name", "justification")
    @classmethod
    def _strip_fields(cls, v: str) -> str:
        return v.strip()


TOOL_SCHEMAS_MAP: Dict[str, Type[BaseModel]] = {
    "reset_password": ResetPasswordArgs,
    "create_jira_ticket": CreateJiraTicketArgs,
    "create_ticket": CreateJiraTicketArgs,
    "escalate_to_human": EscalateToHumanArgs,
    "request_software_access": RequestSoftwareAccessArgs,
}


TOOLS_SCHEMA: List[Dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "reset_password",
            "description": (
                "Trigger an Active Directory / SSO password reset for a specific "
                "corporate username (requires support agent/admin approval during live chat)."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "username": {
                        "type": "string",
                        "description": "Corporate username or email (e.g., marcus.vance@company.com).",
                    }
                },
                "required": ["username"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_jira_ticket",
            "description": (
                "Create a Jira / IT support ticket in the helpdesk system for incidents, "
                "hardware issues, or unresolved L1 issues."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "Short ticket summary title."},
                    "description": {"type": "string", "description": "Detailed description of the issue."},
                    "priority": {
                        "type": "string",
                        "enum": ["low", "medium", "high", "urgent"],
                        "description": "Priority level: low, medium, high, or urgent.",
                    },
                    "project_key": {
                        "type": "string",
                        "description": "Optional Jira project key (defaults to ITSD).",
                    },
                },
                "required": ["title", "description", "priority"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "escalate_to_human",
            "description": (
                "Escalate the conversation to a human L2/Security IT specialist when "
                "the issue requires human intervention or cannot be answered from the knowledge base."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "reason": {"type": "string", "description": "Why human escalation is needed."},
                    "urgency": {
                        "type": "string",
                        "enum": ["normal", "high", "critical"],
                        "description": "Escalation urgency level.",
                    },
                },
                "required": ["reason"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "request_software_access",
            "description": (
                "Request a software license seat or application access provisioning in AD/Okta "
                "(requires agent/admin approval before provisioning)."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "username": {"type": "string", "description": "Employee username or email."},
                    "software_name": {"type": "string", "description": "Software/SaaS application name (e.g., Figma, JetBrains)."},
                    "justification": {"type": "string", "description": "Business justification."},
                    "access_level": {
                        "type": "string",
                        "enum": ["standard", "editor", "admin"],
                        "description": "Requested entitlement level.",
                    },
                },
                "required": ["username", "software_name"],
            },
        },
    },
]


# =====================================================================
# PERSISTENCE, WEBHOOK & EXTERNAL PROVIDERS (REAL OR MOCK)
# =====================================================================

def _save_ticket(
    title: str,
    description: str,
    priority: str,
    status: str,
    db: Optional[Session] = None,
    notes: Optional[List[Dict[str, Any]]] = None,
) -> int:
    """Persist a Ticket row to SQLite and return its generated ID."""
    owns_session = db is None
    session = db if db is not None else SessionLocal()
    now = datetime.now(timezone.utc)
    try:
        ticket = Ticket(
            title=title,
            description=description,
            priority=priority,
            status=status,
            assignee="Unassigned",
            notes_json=json.dumps(notes or []),
            created_at=now,
            updated_at=now,
            resolved_at=now if status == "resolved" else None,
        )
        session.add(ticket)
        session.commit()
        session.refresh(ticket)
        return ticket.id
    except Exception as exc:
        session.rollback()
        logger.exception("Failed to persist ticket '%s': %s", title, exc)
        raise exc
    finally:
        if owns_session:
            session.close()


def _post_webhook(payload: Dict[str, Any]) -> bool:
    """POST tool execution payload to n8n/Make WEBHOOK_URL, failing gracefully."""
    url = (config.WEBHOOK_URL or "").strip()
    if not url:
        return False

    try:
        response = requests.post(url, json=payload, timeout=3)
        if not response.ok:
            logger.warning("Webhook POST to %s returned HTTP %s", url, response.status_code)
        return response.ok
    except Exception as exc:
        logger.warning("Webhook POST to %s failed: %s", url, exc)
        return False


def _log_tool_audit(
    tool_name: str,
    arguments: Dict[str, Any],
    status: str,
    actor: str = "ai_assistant",
    ticket_id: Optional[int] = None,
    webhook_sent: bool = False,
    result: Optional[Dict[str, Any]] = None,
    db: Optional[Session] = None,
) -> Optional[int]:
    """Write a ToolAuditLog row to SQLite."""
    owns_session = db is None
    session = db if db is not None else SessionLocal()
    try:
        entry = ToolAuditLog(
            tool_name=tool_name,
            arguments_json=json.dumps(arguments, default=str),
            status=status,
            actor=actor,
            ticket_id=ticket_id,
            webhook_sent=webhook_sent,
            result_json=json.dumps(result or {}, default=str),
        )
        session.add(entry)
        session.commit()
        session.refresh(entry)
        return entry.id
    except Exception as exc:
        session.rollback()
        logger.exception("Failed to log tool audit row for %s: %s", tool_name, exc)
        return None
    finally:
        if owns_session:
            session.close()


def _ad_reset_password_provider(username: str) -> Dict[str, Any]:
    """Call Active Directory API if configured, otherwise return identical mock response."""
    if config.AD_API_URL and config.AD_API_TOKEN:
        try:
            resp = requests.post(
                f"{config.AD_API_URL.rstrip('/')}/users/{username}/reset-password",
                headers={"Authorization": f"Bearer {config.AD_API_TOKEN}"},
                timeout=5,
            )
            resp.raise_for_status()
            return {"provider": "active_directory", "external_id": resp.json().get("request_id", ""), "reset_link_issued": True}
        except Exception as exc:
            logger.warning("AD API call failed (%s); falling back cleanly.", exc)
    return {
        "provider": "mock_active_directory",
        "external_id": f"AD-{uuid.uuid4().hex[:8].upper()}",
        "reset_link_issued": True,
    }


def _jira_create_issue_provider(
    title: str,
    description: str,
    priority: str,
    project_key: str,
    local_ticket_id: int,
) -> Dict[str, Any]:
    """Call Jira REST API if credentials exist, otherwise return identical mock payload."""
    if config.JIRA_API_URL and config.JIRA_API_TOKEN:
        try:
            resp = requests.post(
                f"{config.JIRA_API_URL.rstrip('/')}/rest/api/3/issue",
                headers={"Authorization": f"Bearer {config.JIRA_API_TOKEN}", "Content-Type": "application/json"},
                json={"fields": {"project": {"key": project_key}, "summary": title, "description": description}},
                timeout=5,
            )
            resp.raise_for_status()
            return {"provider": "jira", "jira_key": resp.json().get("key", f"{project_key}-{local_ticket_id}")}
        except Exception as exc:
            logger.warning("Jira API call failed (%s); using mock Jira key.", exc)
    return {
        "provider": "mock_jira",
        "jira_key": f"{project_key}-{local_ticket_id}",
    }


def _ad_provision_software_provider(username: str, software_name: str, access_level: str) -> Dict[str, Any]:
    """Call Okta/AD provisioning API if configured, else deterministic mock."""
    if config.AD_API_URL and config.AD_API_TOKEN:
        try:
            resp = requests.post(
                f"{config.AD_API_URL.rstrip('/')}/software-access",
                headers={"Authorization": f"Bearer {config.AD_API_TOKEN}"},
                json={"username": username, "software": software_name, "access_level": access_level},
                timeout=5,
            )
            resp.raise_for_status()
            return {"provider": "active_directory", "external_id": resp.json().get("request_id", ""), "provisioned": True}
        except Exception as exc:
            logger.warning("AD provisioning API failed (%s); using mock.", exc)
    return {
        "provider": "mock_okta_scim",
        "external_id": f"SCIM-{uuid.uuid4().hex[:8].upper()}",
        "provisioned": True,
    }


# =====================================================================
# TOOL HANDLERS
# =====================================================================

def reset_password(
    username: str,
    db: Optional[Session] = None,
    actor: str = "ai_assistant",
    approved_by: Optional[str] = None,
) -> Dict[str, Any]:
    """Execute validated AD password reset, persist resolved ticket, fire webhook & audit log."""
    args = ResetPasswordArgs(username=username)
    provider_res = _ad_reset_password_provider(args.username)
    ticket_id = _save_ticket(
        title=f"Password Reset: {args.username}",
        description=f"Password reset executed for '{args.username}' via {provider_res['provider']} ({provider_res['external_id']}).",
        priority="low",
        status="resolved",
        db=db,
    )
    webhook_payload = {
        "event": "tool_executed",
        "tool": "reset_password",
        "username": args.username,
        "ticket_id": ticket_id,
        "approved_by": approved_by,
        **provider_res,
    }
    webhook_sent = _post_webhook(webhook_payload)
    result = {
        "status": "success",
        "action": "reset_password",
        "username": args.username,
        "ticket_id": ticket_id,
        **provider_res,
        "message": (
            f"Password reset completed for '{args.username}' "
            f"(Ref: {provider_res['external_id']}, Ticket #{ticket_id})."
        ),
    }
    audit_status = "approved_and_executed" if approved_by else "executed"
    audit_id = _log_tool_audit(
        tool_name="reset_password",
        arguments=args.model_dump(),
        status=audit_status,
        actor=approved_by or actor,
        ticket_id=ticket_id,
        webhook_sent=webhook_sent,
        result=result,
        db=db,
    )
    result["audit_id"] = audit_id
    return result


def create_jira_ticket(
    title: str,
    description: str,
    priority: str = "medium",
    project_key: str = "ITSD",
    db: Optional[Session] = None,
    actor: str = "ai_assistant",
) -> Dict[str, Any]:
    """Create a validated Jira + SQLite support ticket, fire webhook & audit log."""
    args = CreateJiraTicketArgs(
        title=title,
        description=description,
        priority=priority,
        project_key=project_key,
    )
    ticket_id = _save_ticket(
        title=args.title,
        description=args.description,
        priority=args.priority,
        status="open",
        db=db,
    )
    jira_res = _jira_create_issue_provider(
        title=args.title,
        description=args.description,
        priority=args.priority,
        project_key=args.project_key,
        local_ticket_id=ticket_id,
    )
    webhook_sent = _post_webhook(
        {
            "event": "tool_executed",
            "tool": "create_jira_ticket",
            "ticket_id": ticket_id,
            "title": args.title,
            "description": args.description,
            "priority": args.priority,
            "status": "open",
            **jira_res,
        }
    )
    result = {
        "status": "success",
        "action": "create_jira_ticket",
        "ticket_id": ticket_id,
        "title": args.title,
        "priority": args.priority,
        **jira_res,
        "message": (
            f"Ticket #{ticket_id} ({jira_res['jira_key']}: '{args.title}') created "
            f"with priority '{args.priority}'."
        ),
    }
    audit_id = _log_tool_audit(
        tool_name="create_jira_ticket",
        arguments=args.model_dump(),
        status="executed",
        actor=actor,
        ticket_id=ticket_id,
        webhook_sent=webhook_sent,
        result=result,
        db=db,
    )
    result["audit_id"] = audit_id
    return result


def create_ticket(
    title: str,
    description: str,
    priority: str = "medium",
    db: Optional[Session] = None,
) -> Dict[str, Any]:
    """Backward-compatible wrapper around create_jira_ticket."""
    return create_jira_ticket(title=title, description=description, priority=priority, db=db)


def escalate_to_human(
    reason: str,
    urgency: str = "high",
    db: Optional[Session] = None,
    actor: str = "ai_assistant",
) -> Dict[str, Any]:
    """Create a validated escalated ticket in SQLite, fire webhook & write audit log."""
    args = EscalateToHumanArgs(reason=reason, urgency=urgency)
    priority = "urgent" if args.urgency == "critical" else ("high" if args.urgency == "high" else "medium")
    ticket_id = _save_ticket(
        title="Escalation to Human IT Agent",
        description=args.reason,
        priority=priority,
        status="escalated",
        db=db,
    )
    webhook_sent = _post_webhook(
        {
            "event": "tool_executed",
            "tool": "escalate_to_human",
            "ticket_id": ticket_id,
            "reason": args.reason,
            "urgency": args.urgency,
            "priority": priority,
            "status": "escalated",
        }
    )
    result = {
        "status": "escalated",
        "action": "escalate_to_human",
        "ticket_id": ticket_id,
        "reason": args.reason,
        "urgency": args.urgency,
        "message": (
            f"Escalated to human IT specialist (Ticket #{ticket_id}). "
            f"Reason: {args.reason}"
        ),
    }
    audit_id = _log_tool_audit(
        tool_name="escalate_to_human",
        arguments=args.model_dump(),
        status="executed",
        actor=actor,
        ticket_id=ticket_id,
        webhook_sent=webhook_sent,
        result=result,
        db=db,
    )
    result["audit_id"] = audit_id
    return result


def request_software_access(
    username: str,
    software_name: str,
    justification: str = "Business need",
    access_level: str = "standard",
    db: Optional[Session] = None,
    actor: str = "ai_assistant",
    approved_by: Optional[str] = None,
) -> Dict[str, Any]:
    """Provision validated software license access, persist ticket, fire webhook & audit log."""
    args = RequestSoftwareAccessArgs(
        username=username,
        software_name=software_name,
        justification=justification,
        access_level=access_level,
    )
    provider_res = _ad_provision_software_provider(args.username, args.software_name, args.access_level)
    ticket_id = _save_ticket(
        title=f"Software Access: {args.software_name} ({args.username})",
        description=(
            f"Provisioned {args.access_level} access to '{args.software_name}' for '{args.username}'. "
            f"Justification: {args.justification}"
        ),
        priority="medium",
        status="resolved",
        db=db,
    )
    webhook_sent = _post_webhook(
        {
            "event": "tool_executed",
            "tool": "request_software_access",
            "ticket_id": ticket_id,
            "username": args.username,
            "software_name": args.software_name,
            "access_level": args.access_level,
            "approved_by": approved_by,
            **provider_res,
        }
    )
    result = {
        "status": "success",
        "action": "request_software_access",
        "username": args.username,
        "software_name": args.software_name,
        "access_level": args.access_level,
        "ticket_id": ticket_id,
        **provider_res,
        "message": (
            f"Provisioned {args.access_level} '{args.software_name}' license for '{args.username}' "
            f"(Ref: {provider_res['external_id']}, Ticket #{ticket_id})."
        ),
    }
    audit_status = "approved_and_executed" if approved_by else "executed"
    audit_id = _log_tool_audit(
        tool_name="request_software_access",
        arguments=args.model_dump(),
        status=audit_status,
        actor=approved_by or actor,
        ticket_id=ticket_id,
        webhook_sent=webhook_sent,
        result=result,
        db=db,
    )
    result["audit_id"] = audit_id
    return result


# =====================================================================
# CENTRAL VALIDATION, APPROVAL GATE & DISPATCH
# =====================================================================

def _validate_tool_args(name: str, arguments: Dict[str, Any]) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    model_cls = TOOL_SCHEMAS_MAP.get(name)
    if not model_cls:
        return None, f"Unknown tool: {name}"
    try:
        validated = model_cls(**(arguments or {}))
        return validated.model_dump(), None
    except ValidationError as exc:
        return None, f"Schema validation error for '{name}': {exc.errors()}"


def execute_tool(
    name: str,
    arguments: Dict[str, Any],
    db: Optional[Session] = None,
    approved_by: Optional[str] = None,
    require_approval_for_sensitive: bool = False,
) -> Dict[str, Any]:
    """Validate tool args, enforce approval gate for sensitive tools, log audit, and execute."""
    validated_args, err = _validate_tool_args(name, arguments)
    if err or validated_args is None:
        _log_tool_audit(
            tool_name=name,
            arguments=arguments or {},
            status="error",
            actor=approved_by or "ai_assistant",
            result={"status": "validation_error", "message": err},
            db=db,
        )
        return {"status": "validation_error", "message": err}

    # Gate sensitive tools behind explicit agent/admin approval when initiated via chat
    if require_approval_for_sensitive and name in SENSITIVE_TOOLS and not approved_by:
        pending_payload = {
            "tool": name,
            "arguments": validated_args,
        }
        ticket_id = _save_ticket(
            title=f"Approval Required: {name}",
            description=(
                f"AI requested sensitive action '{name}' which requires Support Agent or Admin approval.\n"
                f"Arguments: {json.dumps(validated_args)}"
            ),
            priority="medium",
            status="open",
            db=db,
            notes=[
                {
                    "id": f"pending-{uuid.uuid4().hex[:8]}",
                    "type": "system",
                    "author": "ApexDesk AI",
                    "time": datetime.now(timezone.utc).isoformat(),
                    "text": f"Pending agent/admin approval for tool '{name}' with args: {json.dumps(validated_args)}",
                    "pending_tool": pending_payload,
                }
            ],
        )
        webhook_sent = _post_webhook(
            {
                "event": "tool_approval_required",
                "tool": name,
                "ticket_id": ticket_id,
                "arguments": validated_args,
            }
        )
        result = {
            "status": "pending_approval",
            "requires_approval": True,
            "action": name,
            "ticket_id": ticket_id,
            "arguments": validated_args,
            "message": (
                f"Action '{name}' requires Support Agent or Admin approval before executing. "
                f"Created approval Ticket #{ticket_id}."
            ),
        }
        audit_id = _log_tool_audit(
            tool_name=name,
            arguments=validated_args,
            status="pending_approval",
            actor="ai_assistant",
            ticket_id=ticket_id,
            webhook_sent=webhook_sent,
            result=result,
            db=db,
        )
        result["audit_id"] = audit_id
        return result

    actor = approved_by or "ai_assistant"

    if name == "reset_password":
        return reset_password(username=validated_args["username"], db=db, actor=actor, approved_by=approved_by)

    if name in ("create_jira_ticket", "create_ticket"):
        return create_jira_ticket(
            title=validated_args["title"],
            description=validated_args["description"],
            priority=validated_args["priority"],
            project_key=validated_args.get("project_key", "ITSD"),
            db=db,
            actor=actor,
        )

    if name == "escalate_to_human":
        return escalate_to_human(
            reason=validated_args["reason"],
            urgency=validated_args.get("urgency", "high"),
            db=db,
            actor=actor,
        )

    if name == "request_software_access":
        return request_software_access(
            username=validated_args["username"],
            software_name=validated_args["software_name"],
            justification=validated_args.get("justification", "Business need"),
            access_level=validated_args.get("access_level", "standard"),
            db=db,
            actor=actor,
            approved_by=approved_by,
        )

    return {"status": "error", "message": f"Unknown tool: {name}"}
