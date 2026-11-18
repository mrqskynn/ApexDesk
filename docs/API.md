# AI-HAS REST API Reference

Base URL (local): `http://localhost:8000`

## Authentication

- Protected endpoints accept a session JWT returned by `POST /auth/login`:
  - `Authorization: Bearer <jwt_token>`
- Admin-only endpoints also accept `X-Admin-Password: <ADMIN_PASSWORD>` (plus `X-Role: admin` if omitted).
- Insufficient role, missing token, or invalid token returns **HTTP `403`**.

---

## Endpoint Summary

| Method | Path | Allowed Roles | Description |
| --- | --- | --- | --- |
| `GET` | `/health` | Public | Liveness check returning `{"status": "ok"}`. |
| `GET` | `/api/health` | Public | Readiness check probing SQLite (`SELECT 1`), ChromaDB chunk count, and OpenAI/Gemini embeddings connectivity. |
| `POST` | `/auth/login` | Public | Authenticate `customer`, `agent`, or `admin` and issue a 7-day HS256 JWT + user profile. |
| `POST` | `/chat` | `customer`, `agent`, `admin` | Sliding-window rate-limited (`429`), PII-redacted, prompt-injection checked Hybrid RAG + up to 3 tool-calling rounds. |
| `POST` | `/tickets` | `customer`, `agent`, `admin` | Create a ticket owned by the authenticated session user (`user_id` derived from JWT). |
| `GET` | `/tickets` | `customer`, `agent`, `admin` | List tickets sorted by `updated_at desc`. Customers see only own tickets (internal notes excluded); staff see all tickets + SLA/SOP match. Optional `?status=` and `?assignee=` filters. |
| `GET` | `/tickets/{ticket_id}` | `customer` (own), `agent`, `admin` | Fetch one ticket (`403` if customer requests another user's ticket; `404` if missing). |
| `PATCH` | `/tickets/{ticket_id}` | `agent`, `admin` | Update `status` (sets/clears `resolved_at`), `priority`, or `assignee` (`"me"` resolves to session user name). |
| `POST` | `/tickets/{ticket_id}/reply` | `agent`, `admin` | Append a customer-visible human reply (transitions `open` -> `in_progress`, updates `updated_at`). |
| `POST` | `/tickets/{ticket_id}/notes` | `agent`, `admin` | Append an internal staff-only note (`type: "internal"`, never returned to customers). |
| `POST` | `/tickets/{ticket_id}/approve-action` | `agent`, `admin` | Approve and execute a validated helpdesk tool (`reset_password`, `request_software_access`, `create_jira_ticket`, `escalate_to_human`), write `ToolAuditLog`, fire webhook, and optionally resolve the ticket. |
| `GET` | `/metrics` | `admin` | Aggregated KPIs: `total_chats`, `deflection_rate`, `escalation_rate`, `mttr_minutes`, `avg_latency_ms`, `escalation_count`, `avg_rag_score`, `total_tokens`, `total_cost_usd`, `recent_llm_calls`, `tickets_by_status`. |
| `GET` | `/metrics/export` | `admin` | Export metrics and ticket records as JSON (`?format=json`) or downloadable CSV (`?format=csv`). |
| `GET` | `/audit-logs` | `agent`, `admin` | List recent `ToolAuditLog` entries (`?limit=50`, clamped `1..200`). |
| `GET` | `/settings/sla` | `admin` | Read SLA minute targets (`urgent_minutes`, `high_minutes`, `medium_minutes`, `low_minutes`), `retrieval_min_score`, `redact_pii`, `detect_injection`. |
| `PUT` | `/settings/sla` | `admin` | Persist SLA targets and guardrail thresholds to `data/sla_settings.json`. |
| `GET` | `/users` | `admin` | List all helpdesk user accounts (`id`, `username`, `name`, `role`). |
| `PATCH` | `/users/{user_id}/role` | `admin` | Update a user's RBAC role (`customer`, `agent`, or `admin`). |
| `GET` | `/kb/docs` | `admin` | List `.md` / `.txt` SOP documents in `/kb` with chunk counts and sizes. |
| `POST` | `/kb/upload` | `admin` | Upload a UTF-8 `.md` or `.txt` SOP file (`multipart/form-data`) and re-index ChromaDB. |
| `PUT` | `/kb/docs/{filename}` | `admin` | Create or update an SOP document by filename and re-index ChromaDB. |
| `DELETE` | `/kb/docs/{filename}` | `admin` | Delete an SOP document from `/kb` and re-index ChromaDB. |
| `POST` | `/kb/reindex` | `admin` | Force a full rebuild of the `kb_sops` ChromaDB collection from `/kb`. |

---

## Key Request & Response Payloads

### `POST /auth/login`
```json
{
  "username": "jane.doe@company.com",
  "password": "demo123",
  "role": "agent"
}
```
Response:
```json
{
  "token": "<jwt>",
  "id": 2,
  "username": "jane.doe@company.com",
  "name": "Jane Doe",
  "role": "agent"
}
```

### `POST /chat`
Request:
```json
{
  "session_id": "web-session-1",
  "message": "How do I reset my corporate password?",
  "role": "user"
}
```
Response (`200 OK`, or `429 Too Many Requests` when rate-limited):
```json
{
  "reply": "Use the self-service portal... (Source: SOP-01: Active Directory & SSO Password Reset)",
  "citations": [
    {
      "title": "SOP-01: Active Directory & SSO Password Reset",
      "source": "01_password_reset.md",
      "section": "Resolution Steps",
      "score": 0.86,
      "snippet": "..."
    }
  ],
  "action_taken": null,
  "escalated": false,
  "latency_ms": 482.5
}
```

### `POST /tickets/{ticket_id}/approve-action`
```json
{
  "tool_name": "request_software_access",
  "arguments": {
    "username": "marcus.vance@company.com",
    "software_name": "Figma Pro",
    "justification": "Design review sprint",
    "access_level": "standard"
  },
  "resolve_ticket": true
}
```
Returns updated `TicketItem` with `sla_status`, `sla_label`, `resolved_at`, and system audit note. Returns `400` if Pydantic tool validation fails.
