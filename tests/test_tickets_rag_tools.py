"""Integration & unit tests for Ticket SLA lifecycle, Hybrid RAG, and validated tools."""

from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend import config  # noqa: E402
from backend import main as backend_main  # noqa: E402
from backend import tools as backend_tools  # noqa: E402
from backend.db import Base, DEFAULT_USERS, get_db  # noqa: E402
from backend.llm import answer_with_rag  # noqa: E402
from backend.models import Ticket, ToolAuditLog, User  # noqa: E402
from backend.rag import match_sop_for_ticket, retrieve  # noqa: E402


class TestTicketsRagAndTools(unittest.TestCase):
    """Verify SLA stop/reopen math, hybrid RAG threshold/citations, and tool audit/approval."""

    @classmethod
    def setUpClass(cls) -> None:
        cls._tmpdir = tempfile.TemporaryDirectory()
        cls._db_path = Path(cls._tmpdir.name) / "test_features.db"
        cls._engine = create_engine(
            f"sqlite:///{cls._db_path}",
            connect_args={"check_same_thread": False},
        )
        cls._Session = sessionmaker(autocommit=False, autoflush=False, bind=cls._engine)
        Base.metadata.create_all(bind=cls._engine)

        seed_db = cls._Session()
        for uname, name, role in DEFAULT_USERS:
            seed_db.add(User(username=uname, name=name, role=role))
        seed_db.commit()
        seed_db.close()

        def _override_get_db():
            db = cls._Session()
            try:
                yield db
            finally:
                db.close()

        backend_main.app.dependency_overrides[get_db] = _override_get_db
        cls._orig_sla_path = backend_main.SLA_SETTINGS_PATH
        backend_main.SLA_SETTINGS_PATH = Path(cls._tmpdir.name) / "sla_settings.json"
        cls.client = TestClient(backend_main.app)

        agent_login = cls.client.post(
            "/auth/login",
            json={"username": "jane.doe@company.com", "password": "demo123", "role": "agent"},
        ).json()
        cust_login = cls.client.post(
            "/auth/login",
            json={"username": "marcus.vance@company.com", "password": "demo123", "role": "customer"},
        ).json()
        cls.agent_headers = {"Authorization": f"Bearer {agent_login['token']}"}
        cls.cust_headers = {"Authorization": f"Bearer {cust_login['token']}"}

    @classmethod
    def tearDownClass(cls) -> None:
        backend_main.SLA_SETTINGS_PATH = cls._orig_sla_path
        backend_main.app.dependency_overrides.clear()
        cls._engine.dispose()
        cls._tmpdir.cleanup()

    def test_01_resolve_stops_sla_met_and_hides_suggested_sop(self) -> None:
        create_res = self.client.post(
            "/tickets",
            headers=self.cust_headers,
            json={
                "title": "Forgot AD password",
                "description": "Locked out of laptop login after 3 attempts.",
                "priority": "high",
            },
        )
        self.assertEqual(create_res.status_code, 200, create_res.text)
        tid = create_res.json()["id"]

        resolve_res = self.client.patch(
            f"/tickets/{tid}",
            headers=self.agent_headers,
            json={"status": "resolved"},
        )
        self.assertEqual(resolve_res.status_code, 200, resolve_res.text)
        body = resolve_res.json()
        self.assertEqual(body["status"], "resolved")
        self.assertIsNotNone(body["resolved_at"])
        self.assertEqual(body["sla_status"], "met")
        self.assertEqual(body["sla_label"], "SLA Met")
        self.assertIsNone(body["suggested_sop"])

    def test_02_resolve_late_ticket_records_sla_breached(self) -> None:
        db = self._Session()
        old_created = datetime.now(timezone.utc) - timedelta(hours=10)
        late_ticket = Ticket(
            title="Old Urgent VPN Outage",
            description="Created 10h ago against 1h urgent SLA.",
            priority="urgent",
            status="open",
            assignee="Jane Doe",
            created_at=old_created,
            updated_at=old_created,
        )
        db.add(late_ticket)
        db.commit()
        db.refresh(late_ticket)
        tid = late_ticket.id
        db.close()

        # Before resolve, timer should report breached
        get_res = self.client.get(f"/tickets/{tid}", headers=self.agent_headers)
        self.assertEqual(get_res.status_code, 200, get_res.text)
        self.assertEqual(get_res.json()["sla_status"], "breached")
        self.assertTrue(get_res.json()["sla_label"].startswith("SLA Breached"))

        # On resolve, timer stops cleanly at "SLA Breached"
        res = self.client.patch(
            f"/tickets/{tid}",
            headers=self.agent_headers,
            json={"status": "resolved"},
        )
        self.assertEqual(res.status_code, 200, res.text)
        data = res.json()
        self.assertEqual(data["sla_status"], "breached")
        self.assertEqual(data["sla_label"], "SLA Breached")
        self.assertIsNotNone(data["resolved_at"])

    def test_03_reopen_clears_resolved_at_and_resumes_sla(self) -> None:
        create_res = self.client.post(
            "/tickets",
            headers=self.cust_headers,
            json={
                "title": "Printer offline on 3F",
                "description": "Cannot print to Marketing-MFP.",
                "priority": "medium",
            },
        )
        tid = create_res.json()["id"]

        resolved = self.client.patch(
            f"/tickets/{tid}",
            headers=self.agent_headers,
            json={"status": "resolved"},
        ).json()
        self.assertIsNotNone(resolved["resolved_at"])
        self.assertEqual(resolved["sla_label"], "SLA Met")

        reopened = self.client.patch(
            f"/tickets/{tid}",
            headers=self.agent_headers,
            json={"status": "open"},
        ).json()
        self.assertEqual(reopened["status"], "open")
        self.assertIsNone(reopened["resolved_at"])
        self.assertEqual(reopened["sla_status"], "active")
        self.assertTrue(reopened["sla_label"].startswith("SLA: "))

    def test_04_list_tickets_sorted_by_updated_at_desc(self) -> None:
        t1 = self.client.post(
            "/tickets",
            headers=self.cust_headers,
            json={"title": "Ticket Older Update", "description": "First created.", "priority": "low"},
        ).json()["id"]
        t2 = self.client.post(
            "/tickets",
            headers=self.cust_headers,
            json={"title": "Ticket Newer Create", "description": "Second created.", "priority": "low"},
        ).json()["id"]

        # Bump t1's updated_at by posting a reply on it so t1 moves above t2
        bump = self.client.post(
            f"/tickets/{t1}/reply",
            headers=self.agent_headers,
            json={"message": "Touching older ticket so it moves to top of inbox."},
        )
        self.assertEqual(bump.status_code, 200, bump.text)

        inbox = self.client.get("/tickets", headers=self.agent_headers).json()
        ids = [item["id"] for item in inbox]
        self.assertIn(t1, ids)
        self.assertIn(t2, ids)
        self.assertLess(ids.index(t1), ids.index(t2))

    def test_05_hybrid_rag_returns_section_citations_and_sop_match(self) -> None:
        chunks = retrieve("How do I reset my corporate password?", top_k=4)
        self.assertGreaterEqual(len(chunks), 1)
        top = chunks[0]
        self.assertGreaterEqual(top["score"], config.RETRIEVAL_MIN_SCORE)
        self.assertEqual(top["source"], "01_password_reset.md")
        self.assertTrue(top.get("section"))

        sop_match = match_sop_for_ticket(
            "Reset corporate password",
            "Need help resetting my corporate domain password via the self-service portal.",
        )
        self.assertIsNotNone(sop_match)
        self.assertEqual(sop_match["source"], "01_password_reset.md")
        self.assertGreaterEqual(sop_match["confidence_pct"], int(config.RETRIEVAL_MIN_SCORE * 100))
        self.assertTrue(sop_match["section"])
        self.assertGreaterEqual(len(sop_match["steps"]), 1)

    def test_06_low_confidence_off_topic_escalates_without_llm_guess(self) -> None:
        chunks = retrieve("How do I bake sourdough bread?", top_k=4)
        best_score = chunks[0]["score"] if chunks else 0.0
        self.assertLess(best_score, config.RETRIEVAL_MIN_SCORE)

        db = self._Session()
        try:
            with patch("backend.llm.OpenAI") as mock_openai, patch(
                "backend.tools.requests.post"
            ) as mock_post, patch.object(backend_tools.config, "WEBHOOK_URL", "https://example.invalid/hook"):
                mock_post.return_value = MagicMock(ok=True, status_code=200)
                result = answer_with_rag("How do I bake sourdough bread?", chunks, db=db)
                mock_openai.assert_not_called()
                self.assertTrue(result["escalated"])
                self.assertEqual(result["action_taken"], "escalate_to_human")
                self.assertEqual(result["citations"], [])
                mock_post.assert_called_once()
        finally:
            db.close()

    def test_07_tools_validation_audit_log_and_webhook(self) -> None:
        db = self._Session()
        try:
            with patch("backend.tools.requests.post") as mock_post, patch.object(
                backend_tools.config, "WEBHOOK_URL", "https://hooks.example.test/n8n"
            ), patch.object(backend_tools.config, "JIRA_API_URL", ""), patch.object(
                backend_tools.config, "JIRA_API_TOKEN", ""
            ):
                mock_post.return_value = MagicMock(ok=True, status_code=200)

                # Invalid Pydantic payload triggers validation_error and logs status='error'
                bad_res = backend_tools.execute_tool("reset_password", {"username": "a"}, db=db)
                self.assertEqual(bad_res["status"], "validation_error")

                # Valid create_jira_ticket mocks Jira provider cleanly, sends webhook & logs audit
                jira_res = backend_tools.execute_tool(
                    "create_jira_ticket",
                    {
                        "title": "Monitor flickering on desk 4B",
                        "description": "DisplayPort intermittently drops signal.",
                        "priority": "high",
                    },
                    db=db,
                )
                self.assertEqual(jira_res["status"], "success")
                self.assertEqual(jira_res["provider"], "mock_jira")
                self.assertTrue(jira_res["jira_key"].startswith("ITSD-"))
                self.assertIsNotNone(jira_res["audit_id"])
                mock_post.assert_called_once()

                audit_row = (
                    db.query(ToolAuditLog).filter(ToolAuditLog.id == jira_res["audit_id"]).first()
                )
                self.assertIsNotNone(audit_row)
                self.assertEqual(audit_row.tool_name, "create_jira_ticket")
                self.assertEqual(audit_row.status, "executed")
                self.assertTrue(audit_row.webhook_sent)
        finally:
            db.close()

    def test_08_sensitive_tools_require_approval_and_agent_approve_executes(self) -> None:
        db = self._Session()
        try:
            with patch("backend.tools.requests.post") as mock_post, patch.object(
                backend_tools.config, "WEBHOOK_URL", "https://hooks.example.test/n8n"
            ), patch.object(backend_tools.config, "AD_API_URL", ""), patch.object(
                backend_tools.config, "AD_API_TOKEN", ""
            ):
                mock_post.return_value = MagicMock(ok=True, status_code=200)

                pending_res = backend_tools.execute_tool(
                    "request_software_access",
                    {
                        "username": "marcus.vance@company.com",
                        "software_name": "Figma Pro",
                        "justification": "Design review sprint",
                    },
                    db=db,
                    require_approval_for_sensitive=True,
                )
                self.assertEqual(pending_res["status"], "pending_approval")
                self.assertTrue(pending_res["requires_approval"])
                approval_ticket_id = pending_res["ticket_id"]

                pending_audit = (
                    db.query(ToolAuditLog)
                    .filter(ToolAuditLog.id == pending_res["audit_id"])
                    .first()
                )
                self.assertEqual(pending_audit.status, "pending_approval")

                # Agent approves via API endpoint -> executes with approved_by & logs audit row
                approve_res = self.client.post(
                    f"/tickets/{approval_ticket_id}/approve-action",
                    headers=self.agent_headers,
                    json={
                        "tool_name": "request_software_access",
                        "arguments": pending_res["arguments"],
                        "resolve_ticket": True,
                    },
                )
                self.assertEqual(approve_res.status_code, 200, approve_res.text)
                approve_body = approve_res.json()
                self.assertEqual(approve_body["status"], "resolved")

                logs_res = self.client.get("/audit-logs?limit=10", headers=self.agent_headers)
                self.assertEqual(logs_res.status_code, 200, logs_res.text)
                logs = logs_res.json()
                approved_entries = [
                    row
                    for row in logs
                    if row["tool_name"] == "request_software_access"
                    and row["status"] == "approved_and_executed"
                ]
                self.assertGreaterEqual(len(approved_entries), 1)
                self.assertEqual(approved_entries[0]["actor"], "Jane Doe")
                self.assertTrue(approved_entries[0]["webhook_sent"])
        finally:
            db.close()

    def test_09_contextual_ticket_followup_retrieves_software_sop(self) -> None:
        contextual = (
            "Ticket: Adobe Creative Cloud License Request\n"
            "Description: Marketing new hire requires Adobe CC Pro seat.\n"
            "Question: Can I do something about this?"
        )
        chunks = retrieve(contextual, top_k=4)
        self.assertGreaterEqual(len(chunks), 1)
        self.assertEqual(chunks[0]["source"], "04_software_access_request.md")
        self.assertGreaterEqual(chunks[0]["score"], config.RETRIEVAL_MIN_SCORE)

    def test_10_ticket_chat_persists_to_ticket_notes_and_chat_history(self) -> None:
        create_res = self.client.post(
            "/tickets",
            headers=self.cust_headers,
            json={
                "title": "Cannot connect to VPN",
                "description": "IT shows error",
                "priority": "medium",
            },
        )
        self.assertEqual(create_res.status_code, 200, create_res.text)
        tid = create_res.json()["id"]

        fake_chunks = [
            {
                "title": "SOP-02: Corporate VPN Connection & Troubleshooting",
                "source": "02_vpn_connection.md",
                "section": "Resolution Steps",
                "score": 0.88,
                "snippet": "Check local internet and refresh VPN client.",
            }
        ]
        fake_answer = {
            "reply": "Follow SOP-02 to check local internet and refresh your VPN client.",
            "citations": fake_chunks,
            "action_taken": None,
            "escalated": False,
            "prompt_tokens": 110,
            "completion_tokens": 25,
            "total_tokens": 135,
            "cost_usd": 0.000032,
            "top_rag_score": 0.88,
            "retrieved_chunks": fake_chunks,
            "outcome": "answered",
        }

        with patch("backend.main.retrieve", return_value=fake_chunks), patch(
            "backend.main.answer_with_rag", return_value=fake_answer
        ):
            chat_res = self.client.post(
                "/chat",
                headers=self.cust_headers,
                json={
                    "session_id": f"ticket-{tid}",
                    "message": "Ticket: Cannot connect to VPN\nDescription: IT shows error\nQuestion: VPN issue",
                    "display_message": "VPN issue",
                    "ticket_id": tid,
                    "role": "user",
                },
            )
            self.assertEqual(chat_res.status_code, 200, chat_res.text)

            # Verify agent view of the ticket now contains BOTH the customer message and AI reply + citations
            agent_ticket = self.client.get(f"/tickets/{tid}", headers=self.agent_headers)
            self.assertEqual(agent_ticket.status_code, 200, agent_ticket.text)
            notes = agent_ticket.json()["notes"]
            self.assertEqual(len(notes), 2)
            self.assertEqual(notes[0]["type"], "customer")
            self.assertEqual(notes[0]["text"], "VPN issue")
            self.assertEqual(notes[1]["type"], "ai")
            self.assertIn("SOP-02", notes[1]["text"])
            self.assertEqual(notes[1]["citations"][0]["source"], "02_vpn_connection.md")

            # Verify standalone portal chat history persists and enforces customer isolation
            cust_login = self.client.post(
                "/auth/login",
                json={"username": "marcus.vance@company.com", "password": "demo123", "role": "customer"},
            ).json()
            portal_sid = f"portal-user-{cust_login['id']}"
            portal_res = self.client.post(
                "/chat",
                headers=self.cust_headers,
                json={"session_id": portal_sid, "message": "VPN troubleshooting steps", "role": "user"},
            )
            self.assertEqual(portal_res.status_code, 200)

            hist_res = self.client.get(f"/chat/history?session_id={portal_sid}", headers=self.cust_headers)
            self.assertEqual(hist_res.status_code, 200, hist_res.text)
            hist_rows = hist_res.json()
            self.assertGreaterEqual(len(hist_rows), 1)
            self.assertEqual(hist_rows[-1]["message"], "VPN troubleshooting steps")
            self.assertIn("SOP-02", hist_rows[-1]["reply"])

            forbidden_hist = self.client.get("/chat/history?session_id=portal-user-999", headers=self.cust_headers)
            self.assertEqual(forbidden_hist.status_code, 403)


if __name__ == "__main__":
    unittest.main()
