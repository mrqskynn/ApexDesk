"""RBAC integration tests covering customer, agent, and admin isolation."""

from pathlib import Path
import sys
import tempfile
import unittest

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend import config  # noqa: E402
from backend.db import Base, DEFAULT_USERS, get_db  # noqa: E402
from backend.main import app  # noqa: E402
from backend.models import Ticket, User  # noqa: E402


class TestRBAC(unittest.TestCase):
    """Verify strict 403 RBAC isolation across customer, agent, and admin roles."""

    @classmethod
    def setUpClass(cls) -> None:
        cls._tmpdir = tempfile.TemporaryDirectory()
        cls._db_path = Path(cls._tmpdir.name) / "test_rbac.db"
        cls._engine = create_engine(
            f"sqlite:///{cls._db_path}",
            connect_args={"check_same_thread": False},
        )
        cls._Session = sessionmaker(autocommit=False, autoflush=False, bind=cls._engine)
        Base.metadata.create_all(bind=cls._engine)

        # Seed users across all 3 roles (matching production roles)
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

        app.dependency_overrides[get_db] = _override_get_db
        cls.client = TestClient(app)

        # Authenticate once per role to obtain real signed session JWTs
        cls.admin_login = cls.client.post(
            "/auth/login",
            json={"username": "admin", "password": config.ADMIN_PASSWORD, "role": "admin"},
        ).json()
        cls.agent_login = cls.client.post(
            "/auth/login",
            json={"username": "jane.doe@company.com", "password": "demo123", "role": "agent"},
        ).json()
        cls.cust_a_login = cls.client.post(
            "/auth/login",
            json={"username": "marcus.vance@company.com", "password": "demo123", "role": "customer"},
        ).json()
        cls.cust_b_login = cls.client.post(
            "/auth/login",
            json={"username": "elena.rostova@company.com", "password": "demo123", "role": "customer"},
        ).json()

        cls.admin_headers = {"Authorization": f"Bearer {cls.admin_login['token']}"}
        cls.agent_headers = {"Authorization": f"Bearer {cls.agent_login['token']}"}
        cls.cust_a_headers = {"Authorization": f"Bearer {cls.cust_a_login['token']}"}
        cls.cust_b_headers = {"Authorization": f"Bearer {cls.cust_b_login['token']}"}

        # Create one ticket owned by Customer A and one owned by Customer B
        res_a = cls.client.post(
            "/tickets",
            headers=cls.cust_a_headers,
            json={"title": "Customer A VPN Issue", "description": "Cannot connect to VPN.", "priority": "high"},
        )
        assert res_a.status_code == 200, res_a.text
        cls.ticket_a_id = res_a.json()["id"]

        res_b = cls.client.post(
            "/tickets",
            headers=cls.cust_b_headers,
            json={"title": "Customer B Email Sync", "description": "Outlook password loop.", "priority": "medium"},
        )
        assert res_b.status_code == 200, res_b.text
        cls.ticket_b_id = res_b.json()["id"]

    @classmethod
    def tearDownClass(cls) -> None:
        app.dependency_overrides.clear()
        cls._engine.dispose()
        cls._tmpdir.cleanup()

    def test_01_jane_doe_is_agent_not_admin(self) -> None:
        self.assertEqual(self.agent_login["role"], "agent")
        self.assertEqual(self.agent_login["name"], "Jane Doe")
        self.assertEqual(self.cust_a_login["role"], "customer")
        self.assertEqual(self.admin_login["role"], "admin")

    def test_02_agent_calling_admin_endpoints_returns_403(self) -> None:
        admin_endpoints = [
            ("GET", "/kb/docs", None),
            ("POST", "/kb/reindex", None),
            ("PUT", "/kb/docs/rbac_test.md", {"content": "# test"}),
            ("DELETE", "/kb/docs/rbac_test.md", None),
            ("GET", "/metrics", None),
            ("GET", "/metrics/export", None),
            ("GET", "/settings/sla", None),
            ("PUT", "/settings/sla", {"urgent_minutes": 30}),
            ("GET", "/users", None),
            ("PATCH", f"/users/{self.cust_a_login['id']}/role", {"role": "admin"}),
        ]
        for method, path, payload in admin_endpoints:
            with self.subTest(method=method, path=path):
                resp = self.client.request(method, path, headers=self.agent_headers, json=payload)
                self.assertEqual(resp.status_code, 403, f"{method} {path} returned {resp.status_code}: {resp.text}")

    def test_03_customer_calling_agent_and_admin_endpoints_returns_403(self) -> None:
        restricted_endpoints = [
            ("PATCH", f"/tickets/{self.ticket_a_id}", {"status": "resolved"}),
            ("POST", f"/tickets/{self.ticket_a_id}/reply", {"message": "Fake agent reply"}),
            ("POST", f"/tickets/{self.ticket_a_id}/notes", {"message": "Fake internal note"}),
            ("POST", f"/tickets/{self.ticket_a_id}/approve-action", {"tool_name": "reset_password", "arguments": {"username": "marcus.vance"}}),
            ("GET", "/metrics", None),
            ("GET", "/kb/docs", None),
            ("GET", "/users", None),
        ]
        for method, path, payload in restricted_endpoints:
            with self.subTest(method=method, path=path):
                resp = self.client.request(method, path, headers=self.cust_a_headers, json=payload)
                self.assertEqual(resp.status_code, 403, f"{method} {path} returned {resp.status_code}: {resp.text}")

    def test_04_customer_cannot_read_other_customers_ticket(self) -> None:
        # Customer A cannot read Customer B's ticket directly
        detail_resp = self.client.get(f"/tickets/{self.ticket_b_id}", headers=self.cust_a_headers)
        self.assertEqual(detail_resp.status_code, 403)

        # Customer A's list contains only Customer A's tickets
        list_resp = self.client.get("/tickets", headers=self.cust_a_headers)
        self.assertEqual(list_resp.status_code, 200)
        ids = {t["id"] for t in list_resp.json()}
        self.assertIn(self.ticket_a_id, ids)
        self.assertNotIn(self.ticket_b_id, ids)

    def test_05_unauthenticated_and_spoofed_headers_return_403(self) -> None:
        resp_no_auth = self.client.get("/tickets")
        self.assertEqual(resp_no_auth.status_code, 403)

        # Spoofed X-Role header without password or signed JWT must be rejected
        resp_spoof = self.client.get("/metrics", headers={"X-Role": "admin"})
        self.assertEqual(resp_spoof.status_code, 403)

        # Customer token paired with spoofed X-Role: admin header still gets 403
        resp_header_escalation = self.client.get(
            "/metrics",
            headers={**self.cust_a_headers, "X-Role": "admin"},
        )
        self.assertEqual(resp_header_escalation.status_code, 403)

    def test_06_agent_workflow_uses_session_identity_and_hides_internal_notes_from_customer(self) -> None:
        # Agent can read both customers' tickets
        inbox_resp = self.client.get("/tickets", headers=self.agent_headers)
        self.assertEqual(inbox_resp.status_code, 200)
        inbox_ids = {t["id"] for t in inbox_resp.json()}
        self.assertTrue({self.ticket_a_id, self.ticket_b_id}.issubset(inbox_ids))

        # Assign to self ("me") -> resolves from JWT to "Jane Doe"
        patch_resp = self.client.patch(
            f"/tickets/{self.ticket_a_id}",
            headers=self.agent_headers,
            json={"assignee": "me", "status": "in_progress"},
        )
        self.assertEqual(patch_resp.status_code, 200)
        self.assertEqual(patch_resp.json()["assignee"], "Jane Doe")

        # Agent reply authored by "Jane Doe"
        reply_resp = self.client.post(
            f"/tickets/{self.ticket_a_id}/reply",
            headers=self.agent_headers,
            json={"message": "Checking your VPN gateway certificate now."},
        )
        self.assertEqual(reply_resp.status_code, 200)
        agent_notes = [n for n in reply_resp.json()["notes"] if n["type"] == "agent"]
        self.assertEqual(agent_notes[-1]["author"], "Jane Doe")

        # Internal note authored by "Jane Doe"
        note_resp = self.client.post(
            f"/tickets/{self.ticket_a_id}/notes",
            headers=self.agent_headers,
            json={"message": "Internal diagnostic: cert expired yesterday."},
        )
        self.assertEqual(note_resp.status_code, 200)
        internal_notes = [n for n in note_resp.json()["notes"] if n["type"] == "internal"]
        self.assertEqual(internal_notes[-1]["author"], "Jane Doe")

        # Customer A can read their own ticket, sees the agent reply, but NEVER internal notes
        cust_detail = self.client.get(f"/tickets/{self.ticket_a_id}", headers=self.cust_a_headers)
        self.assertEqual(cust_detail.status_code, 200)
        cust_note_types = {n["type"] for n in cust_detail.json()["notes"]}
        self.assertIn("agent", cust_note_types)
        self.assertNotIn("internal", cust_note_types)

        # Agent approves tool action authored by "Jane Doe"
        approve_resp = self.client.post(
            f"/tickets/{self.ticket_a_id}/approve-action",
            headers=self.agent_headers,
            json={"tool_name": "reset_password", "arguments": {"username": "marcus.vance"}, "resolve_ticket": True},
        )
        self.assertEqual(approve_resp.status_code, 200)
        self.assertEqual(approve_resp.json()["status"], "resolved")
        self.assertEqual(approve_resp.json()["notes"][-1]["author"], "Jane Doe")

    def test_07_admin_can_access_admin_endpoints(self) -> None:
        self.assertEqual(self.client.get("/metrics", headers=self.admin_headers).status_code, 200)
        self.assertEqual(self.client.get("/metrics/export", headers=self.admin_headers).status_code, 200)
        self.assertEqual(self.client.get("/settings/sla", headers=self.admin_headers).status_code, 200)
        self.assertEqual(self.client.get("/users", headers=self.admin_headers).status_code, 200)
        self.assertEqual(self.client.get("/kb/docs", headers=self.admin_headers).status_code, 200)


if __name__ == "__main__":
    unittest.main()
