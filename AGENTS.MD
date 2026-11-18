# AI-HAS: AI Helpdesk & Workflow Automation System

## Goal

Capstone demo: an IT helpdesk chatbot that answers L1 IT questions using RAG
with citations, executes actions via LLM function calling, escalates what it
can't handle, and shows KPIs on an admin dashboard. Deadline is 3 days.
PRIORITY: a working end-to-end demo beats completeness. Keep it simple.

## Stack (do not substitute)

- Backend: Python 3.11, FastAPI, SQLAlchemy + SQLite (data/app.db)
- Vector DB: ChromaDB, persisted at data/chroma
- LLM: OpenAI API, model gpt-4o-mini, plain openai SDK (NO LangChain)
  Embeddings: text-embedding-3-small
- Frontend: Streamlit multipage (chat page + admin pages)
- Config: .env (OPENAI_API_KEY, WEBHOOK_URL, ADMIN_PASSWORD). Never commit it.
- Deploy: Dockerfile + docker-compose (backend and frontend services)

## Folder structure

/backend
main.py FastAPI app and routes
config.py env loading
db.py, models.py SQLAlchemy setup and tables
rag.py chunking, embedding, retrieval
llm.py chat completion + tool-calling loop
tools.py reset_password, create_ticket, escalate_to_human
guardrails.py PII redaction, injection check
auth.py role checks (user / admin)
/frontend
app.py chat page
pages/1_Dashboard.py, 2_Tickets.py, 3_Knowledge_Base.py
/kb markdown SOP files (one SOP per file)
/eval
questions.json, run_eval.py
/docs README, architecture diagram (Mermaid)

## API contract (do not change without asking)

POST /chat body {session_id, message, role}
returns {reply, citations: [{title, snippet}], action_taken,
escalated: bool, latency_ms}
GET /tickets (admin only)
GET /metrics (admin only) -> total_chats, deflection_rate,
avg_latency_ms, escalation_count, tickets_by_status
POST /kb/upload (admin only) markdown/text file, re-indexes it
POST /kb/reindex (admin only)
GET /health

## Behavior rules

- RAG: retrieve top 4 chunks. If best similarity is below threshold
  (RETRIEVAL_MIN_SCORE in config), do NOT answer from the model's own
  knowledge. Say it isn't sure and call escalate_to_human.
- Every answer from the KB must include citations (SOP title).
- Tools: reset_password(username), create_ticket(title, description, priority),
  escalate_to_human(reason). Handlers write to SQLite and POST to WEBHOOK_URL.
  They are MOCKS and must never touch real systems.
- Tool-calling loop is capped at 3 rounds.
- Guardrails: redact PII (emails, phone numbers, credit cards, national IDs)
  with regex BEFORE sending to the LLM and BEFORE logging. Detect prompt
  injection ("ignore previous instructions", "reveal system prompt", etc.),
  refuse politely, and log it. System prompt must forbid revealing itself.
- RBAC: admin endpoints require role=admin (simple token/password is fine).
- Log every chat to chat_logs: session_id, redacted message, reply, latency,
  escalated, action_taken, injection_flag, created_at.
- Seed demo data (tickets and chat logs) via a seed script.

## Working rules for the agent

- Build ONLY what the current prompt asks for. Do not implement ahead.
- After each task, tell me exactly how to run and test it.
- Keep code simple and commented. No unnecessary abstractions.
- Don't modify files outside the scope of the task.
- If something is ambiguous, pick the simplest option and say what you chose.
