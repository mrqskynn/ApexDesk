# AI-HAS: Data Integrity Rules (always follow)

## 1. No mock data

- Never hardcode sample arrays, fake metrics, placeholder responses, lorem ipsum, or `Math.random()` values in the frontend or backend.
- Every value shown in the UI must come from the database or an API call.

## 2. Single source of truth (Vercel deployment)

- Deployed on Vercel (Next.js). Do NOT use SQLite, local files, or in-memory
  storage for app data. The serverless filesystem is not persistent.
- Database: Neon Postgres via DATABASE_URL (env var). Use Drizzle ORM.
- Vector search: pgvector in the same Postgres database (`kb_chunks.embedding`).
- Uploaded KB documents: store extracted text in `kb_documents` / `kb_chunks`
  (or Vercel Blob for the original file). Never write to local disk.
- Secrets (DATABASE_URL, OPENAI_API_KEY) live in .env.local and Vercel
  environment variables. Never hardcode them.
- Local dev must work with `docker compose up` (local Postgres + pgvector).
- Frontend ONLY talks to the backend API routes.

## 3. Everything must connect

- Chat message -> rows in `conversations` and `messages`.
- Chatbot answer -> real vector DB retrieval; save cited `kb_documents` IDs.
- Function call (password reset / create ticket) -> real row in `tickets`, linked by foreign key to the conversation and user.
- Escalation -> conversation status changes; it appears in the agent dashboard by querying the DB.
- Admin KPIs (deflection rate, MTTR, latency, intent counts) -> computed by SQL queries on real tables. Never hardcoded.
- KB upload -> saved in DB AND indexed in the vector DB.
- Guardrail triggers -> row in `guardrail_events`.

## 4. Empty states, not fake states

- If there is no data, show "No data yet". Do not fill the UI to look good.

## 5. External services

- If Jira/email/AD is unavailable, write a real adapter that logs to an `integration_logs` table, labeled `# STUB` in code. Never fake the response in the UI.

## 6. Definition of done (for every feature)

After building, show me how to verify end to end:

1. Perform the action in the UI.
2. Show the SQL query and the resulting rows.
3. Show the dashboard value changing.

If you cannot show this, the feature is not done.

## 7. Seed data

- Test data must be inserted by `seed.py` through the same DB schema/API. Never embed test data in frontend code.
