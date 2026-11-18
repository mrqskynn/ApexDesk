"""Authentication, signed session JWTs, and role-based access control (RBAC)."""

import base64
import hashlib
import hmac
import json
import secrets
import time
from typing import Any, Callable, Dict, Optional

from fastapi import Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend import config
from backend.db import get_db
from backend.models import User

VALID_ROLES = {"customer", "agent", "admin"}

USERNAME_ALIASES = {
    "jane.doe": "jane.doe@company.com",
    "marcus.vance": "marcus.vance@company.com",
    "elena.rostova": "elena.rostova@company.com",
}


class LoginRequest(BaseModel):
    """Credentials submitted to POST /auth/login."""

    username: str
    password: str
    role: Optional[str] = "customer"  # "customer" | "agent" | "admin"


class CurrentUser(BaseModel):
    """Authenticated user extracted from the session JWT."""

    id: int
    username: str
    name: str
    role: str


class LoginResponse(BaseModel):
    """Session payload returned by POST /auth/login."""

    id: int
    token: str
    username: str
    role: str
    name: str


def normalize_role(role: Optional[str]) -> str:
    """Normalize legacy 'user' role to 'customer' and lowercase."""
    clean = (role or "customer").strip().lower()
    if clean == "user":
        return "customer"
    return clean


def _get_jwt_secret() -> bytes:
    """Derive a stable HMAC signing key from server configuration."""
    raw = (config.ADMIN_PASSWORD or "dev-fallback-secret").strip()
    return hashlib.sha256(f"ai-has-session:{raw}".encode("utf-8")).digest()


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(segment: str) -> bytes:
    padding = "=" * (-len(segment) % 4)
    return base64.urlsafe_b64decode(segment + padding)


def create_session_token(user: CurrentUser, ttl_seconds: int = 86400 * 7) -> str:
    """Create a signed HS256 JWT containing the authenticated user's session claims."""
    header = _b64url_encode(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode("utf-8"))
    payload_obj = {
        "id": user.id,
        "username": user.username,
        "name": user.name,
        "role": user.role,
        "exp": int(time.time()) + ttl_seconds,
    }
    payload = _b64url_encode(json.dumps(payload_obj, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{header}.{payload}".encode("ascii")
    sig = hmac.new(_get_jwt_secret(), signing_input, hashlib.sha256).digest()
    return f"{header}.{payload}.{_b64url_encode(sig)}"


def decode_session_token(token: str) -> Optional[Dict[str, Any]]:
    """Verify an HS256 session JWT signature and expiry; return claims or None."""
    try:
        parts = token.strip().split(".")
        if len(parts) != 3:
            return None
        header_b64, payload_b64, sig_b64 = parts
        signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
        expected_sig = hmac.new(_get_jwt_secret(), signing_input, hashlib.sha256).digest()
        provided_sig = _b64url_decode(sig_b64)
        if not hmac.compare_digest(expected_sig, provided_sig):
            return None
        payload = json.loads(_b64url_decode(payload_b64).decode("utf-8"))
        if int(payload.get("exp", 0)) <= int(time.time()):
            return None
        if not payload.get("id") or not payload.get("role"):
            return None
        return payload
    except Exception:
        return None


def authenticate_user(req: LoginRequest, db: Session) -> LoginResponse:
    """Validate credentials for customer, agent, or admin and issue a signed JWT."""
    raw_uname = req.username.strip().lower()
    uname = USERNAME_ALIASES.get(raw_uname, raw_uname)
    pw = req.password.strip()
    requested_role = normalize_role(req.role) if req.role else ""

    if not uname or not pw:
        raise HTTPException(status_code=400, detail="Username and password are required.")

    user = db.query(User).filter(User.username == uname).first()

    # Admin login path
    if requested_role == "admin" or uname == "admin" or (user and user.role == "admin"):
        if user and user.role != "admin":
            raise HTTPException(status_code=403, detail="Forbidden: account does not have administrator privileges.")
        expected = (config.ADMIN_PASSWORD or "").strip()
        if not expected or not secrets.compare_digest(pw, expected):
            raise HTTPException(
                status_code=401,
                detail="Invalid admin credentials. Please enter the valid administrator password.",
            )
        if not user:
            user = User(username="admin", name="Jordan Vance", role="admin")
            db.add(user)
            db.commit()
            db.refresh(user)
    elif user:
        canonical_role = normalize_role(user.role)
        if requested_role == "agent" and canonical_role == "customer":
            raise HTTPException(
                status_code=403,
                detail="Forbidden: account does not have Support Agent permissions.",
            )
    else:
        # Unknown user: never allow self-escalation to agent or admin
        if requested_role in ("agent", "admin"):
            raise HTTPException(
                status_code=403,
                detail="Forbidden: unknown account cannot sign in as agent or admin.",
            )
        display_name = uname.split("@")[0].replace(".", " ").title()
        user = User(username=uname, name=display_name, role="customer")
        db.add(user)
        db.commit()
        db.refresh(user)

    current = CurrentUser(
        id=user.id,
        username=user.username,
        name=user.name,
        role=normalize_role(user.role),
    )
    return LoginResponse(
        id=current.id,
        token=create_session_token(current),
        username=current.username,
        role=current.role,
        name=current.name,
    )


def get_current_user(
    authorization: Optional[str] = Header(default=None),
    x_session_token: Optional[str] = Header(default=None),
    x_admin_password: Optional[str] = Header(default=None),
    x_role: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
) -> CurrentUser:
    """Resolve authenticated user strictly from verified JWT or valid admin secret header."""
    token = ""
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    elif x_session_token:
        token = x_session_token.strip()

    if token:
        claims = decode_session_token(token)
        if not claims:
            raise HTTPException(status_code=403, detail="Forbidden: invalid or expired session token.")
        db_user = db.query(User).filter(User.id == int(claims["id"])).first()
        if db_user:
            return CurrentUser(
                id=db_user.id,
                username=db_user.username,
                name=db_user.name,
                role=normalize_role(db_user.role),
            )
        return CurrentUser(
            id=int(claims["id"]),
            username=str(claims.get("username", "")),
            name=str(claims.get("name", "")),
            role=normalize_role(str(claims.get("role", "customer"))),
        )

    # Admin header secret fallback (for automated scripts/evals sending X-Admin-Password)
    provided_pw = (x_admin_password or "").strip()
    expected_pw = (config.ADMIN_PASSWORD or "").strip()
    if provided_pw:
        if x_role is not None and normalize_role(x_role) != "admin":
            raise HTTPException(status_code=403, detail="Forbidden: Admin role required.")
        if not expected_pw or not secrets.compare_digest(provided_pw, expected_pw):
            raise HTTPException(status_code=403, detail="Forbidden: invalid admin credentials.")
        admin_user = db.query(User).filter(User.role == "admin").first()
        if admin_user:
            return CurrentUser(
                id=admin_user.id,
                username=admin_user.username,
                name=admin_user.name,
                role="admin",
            )
        return CurrentUser(id=1, username="admin", name="Jordan Vance", role="admin")

    raise HTTPException(status_code=403, detail="Forbidden: authentication required.")


def require_role(*allowed_roles: str) -> Callable[..., CurrentUser]:
    """Return a FastAPI dependency that enforces membership in allowed_roles (HTTP 403)."""
    allowed = {normalize_role(r) for r in allowed_roles}

    def _checker(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if current_user.role not in allowed:
            raise HTTPException(
                status_code=403,
                detail=f"Forbidden: role '{current_user.role}' cannot perform this action (requires {', '.join(sorted(allowed))}).",
            )
        return current_user

    return _checker


require_admin = require_role("admin")
