# AI-HAS User Manual

Welcome to **AI-HAS**, the corporate IT Helpdesk & Workflow Automation System.

---

## 1. Quick Start

### Option A: Docker Compose (Frontend + Backend)
1. Ensure `.env` exists at the repository root with your LLM key (`OPENAI_API_KEY`) and `ADMIN_PASSWORD`.
2. Start both services:
   ```powershell
   docker compose up --build
   ```
3. Open **http://localhost:3000** (Next.js portal) and **http://localhost:8000/api/health** (FastAPI health check).

### Option B: Local Development Servers
1. Create a Python 3.11 virtual environment and install dependencies:
   ```powershell
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   python backend/index_kb.py
   python seed_demo_data.py
   uvicorn backend.main:app --reload --port 8000
   ```
2. Start the Next.js frontend in a second terminal:
   ```powershell
   cd frontend
   npm install
   npm run dev
   ```
3. Navigate to **http://localhost:3000/login**.

---

## 2. Demo User Accounts

| Role | Email / Username | Password | Accessible Portal Routes |
| --- | --- | --- | --- |
| **Customer (Employee)** | `marcus.vance@company.com` or `elena.rostova@company.com` | Any non-empty string (e.g. `demo123`) | `/`, `/submit`, `/my-tickets` |
| **Support Agent** | `jane.doe@company.com` | Any non-empty string (e.g. `demo123`) | `/`, `/agent` |
| **Administrator** | `admin` | Value of `ADMIN_PASSWORD` in `.env` | `/`, `/agent`, `/admin/dashboard`, `/admin/kb`, `/admin/settings` |

Attempting to access a route outside your role automatically redirects you via `frontend/middleware.js`, and backend endpoints enforce HTTP `403`.

---

## 3. Using the System by Role

### Employee / Customer Portal
1. **Help Center & AI Assistant (`/`)**:
   - Type L1 IT questions (VPN, MFA, Outlook, Wi-Fi, printers, password resets) into the assistant.
   - View **Sources cited** pills showing the exact KB SOP title, filename, and section used.
   - Sensitive data you accidentally paste (emails, phone numbers, passwords, API keys, credit cards, national IDs) is scrubbed before hitting the AI model or logs.
   - Out-of-scope or low-confidence questions automatically escalate to a human specialist without guessing.
2. **Submit Request (`/submit`)**:
   - Choose priority and submit a structured support ticket owned by your user account.
3. **My Tickets (`/my-tickets`)**:
   - Track ticket status and SLA progress, and ask follow-up AI questions inside the ticket drawer (internal staff notes remain hidden).

### Support Agent Workspace (`/agent`)
1. **Inbox Queue (Left Pane)**:
   - Filter by **All**, **Assigned to me**, **Unassigned**, **Urgent/High**, **Escalated**, or **Active**, or search by ticket ID, requester, subject, or assignee.
   - Queue is sorted by most recently updated (`updated_at desc`), and the inbox badge reflects the filtered ticket count.
2. **Thread, Composer & SLA Controls (Center Pane)**:
   - Monitor live SLA countdown or frozen completion badges (**SLA Met** / **SLA Breached**).
   - Click **Resolve** to freeze `resolved_at` and calculate final SLA adherence, or **Reopen** to resume work and clear `resolved_at`.
   - Use **Human Agent Reply** for customer-visible responses, **Ask AI (RAG Reply)** for AI copilot responses (with KB source + section citations), or **Internal Note** for staff-only collaboration.
3. **Ticket Properties & AI Match Card (Right Pane)**:
   - Update **Status**, **Assignee**, and **Priority** (changes sync immediately across the list badge, header, and dropdown).
   - Approve pending sensitive actions triggered by chat via **Approve Password Reset** or **Approve Software Access** (writes a `ToolAuditLog` record and fires configured webhooks).
   - For open tickets, review the **AI Match (%)** card showing real hybrid confidence score, top matching SOP file, section, and click **Insert Steps to Reply** to draft resolution steps for the customer.

### Administrator Console (`/admin/*`)
1. **Analytics & Observability Dashboard (`/admin/dashboard`)**:
   - Monitor **Deflection Rate**, **MTTR (min)**, **Avg Latency (ms)**, **Escalation Rate (%)**, **Avg RAG Score**, total token/cost consumption, and live ticket pipeline counts.
   - Inspect **Recent LLM & RAG Call Telemetry** (per-session outcomes, RAG scores, retrieved chunks, tokens, cost, latency) or click **Export CSV**.
2. **Knowledge Base Manager (`/admin/kb`)**:
   - Inspect all indexed SOP files, upload/create/edit/delete `.md` / `.txt` SOPs, or trigger a ChromaDB re-index.
3. **SLA, Guardrails & RBAC Settings (`/admin/settings`)**:
   - Configure per-priority SLA target minutes (`urgent`, `high`, `medium`, `low`), update `retrieval_min_score`, toggle guardrails, and promote/demote user roles.

---

## 4. Running Tests & Evaluation

- **Unit & Integration Tests** (`guardrails`, `rbac`, `SLA / RAG / tools`):
  ```powershell
  pytest -v
  # or: python -m unittest discover -s tests -v
  ```
- **32-Case Evaluation Suite** (Accuracy, Citation Correctness, Deflection Rate, avg/p50/p95 latency -> `eval/results.md`):
  ```powershell
  # Against running local backend (or live TestClient):
  python eval/run_eval.py

  # Offline deterministic CI mode (no API key required):
  python eval/run_eval.py --ci
  ```
- **High-Concurrency Stress Benchmark** (reports p50/p95 latency & ACID checks):
  ```powershell
  python eval/stress_test.py
  ```
