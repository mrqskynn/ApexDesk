"""Evaluation runner for AI-HAS POST /chat across /eval/questions.json."""

import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import statistics
import sys
import tempfile
from types import SimpleNamespace
from typing import Any, Dict, List, Optional
from unittest.mock import patch

from dotenv import load_dotenv
import requests

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.guardrails import INJECTION_REFUSAL_MESSAGE, reset_rate_limiter  # noqa: E402

load_dotenv(ROOT_DIR / ".env")
DEFAULT_BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000").rstrip("/")

EVAL_DIR = Path(__file__).resolve().parent
QUESTIONS_PATH = EVAL_DIR / "questions.json"
RESULTS_PATH = EVAL_DIR / "results.md"


def classify_outcome(resp_data: Dict[str, Any], expected: str) -> str:
    """Map a POST /chat JSON response to answered / action:<tool> / escalated / refused."""
    reply = (resp_data.get("reply") or "").strip()
    if INJECTION_REFUSAL_MESSAGE in reply or (
        "cannot comply with requests to ignore instructions" in reply.lower()
    ):
        return "refused"

    escalated = bool(resp_data.get("escalated"))
    action_taken = (resp_data.get("action_taken") or "").strip()

    if expected == "escalated" and escalated:
        return "escalated"

    if action_taken:
        tools = [t.strip() for t in action_taken.split(",") if t.strip()]
        if expected.startswith("action:"):
            target_tool = expected.split(":", 1)[1]
            if target_tool in tools:
                return expected
            if target_tool == "create_ticket" and "create_jira_ticket" in tools:
                return expected
        return f"action:{tools[0]}"

    if escalated:
        return "escalated"

    if reply:
        return "answered"

    return "error"


def check_citation_correctness(
    citations: List[Dict[str, Any]],
    expected_source: Optional[str],
) -> bool:
    """Verify returned citations match expected KB source (or none when expected_source is None)."""
    if not expected_source:
        return len(citations) == 0

    for c in citations:
        src = str(c.get("source") or "").strip()
        title = str(c.get("title") or "").strip()
        if src == expected_source or expected_source in title:
            return True
    return False


def _percentile(values: List[float], pct: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    idx = min(len(ordered) - 1, int(len(ordered) * pct))
    return round(ordered[idx], 2)


def _md_cell(value: str, max_len: int = 80) -> str:
    """Sanitize and truncate text for markdown table cells."""
    clean = value.replace("\r", " ").replace("\n", " ").replace("|", "\\|").strip()
    if len(clean) > max_len:
        return clean[: max_len - 3] + "..."
    return clean


class _CIStubClient:
    """Deterministic OpenAI chat completion stub for offline CI evaluation."""

    class _Completions:
        @staticmethod
        def create(**kwargs):
            messages = kwargs.get("messages") or []
            last = messages[-1] if messages else {}
            if last.get("role") == "tool":
                msg = SimpleNamespace(
                    content="Action completed using IT SOP workflow.",
                    tool_calls=None,
                )
                return SimpleNamespace(
                    choices=[SimpleNamespace(message=msg)],
                    usage=SimpleNamespace(prompt_tokens=200, completion_tokens=25),
                )

            full_text = str(last.get("content") or "")
            q = (
                full_text.split("User Question:\n", 1)[-1].strip()
                if "User Question:\n" in full_text
                else full_text
            )
            ql = q.lower()

            tool_calls = None
            if ("reset" in ql and "password" in ql) and re.search(r"\b(?:user|username)\s+([a-z0-9._-]+)", ql):
                uname = re.search(r"\b(?:user|username)\s+([a-z0-9._-]+)", ql).group(1)
                tool_calls = [
                    SimpleNamespace(
                        id="tc-reset-1",
                        function=SimpleNamespace(
                            name="reset_password",
                            arguments=json.dumps({"username": uname}),
                        ),
                    )
                ]
            elif ("please request" in ql or "for username" in ql) and "software access" in ql:
                uname_m = re.search(r"username\s+([a-z0-9._-]+)", ql)
                uname = uname_m.group(1) if uname_m else "marcus.vance"
                tool_calls = [
                    SimpleNamespace(
                        id="tc-sw-1",
                        function=SimpleNamespace(
                            name="request_software_access",
                            arguments=json.dumps(
                                {
                                    "username": uname,
                                    "software_name": "Figma Pro",
                                    "justification": "Design review",
                                }
                            ),
                        ),
                    )
                ]
            elif ("ticket" in ql) and any(k in ql for k in ("log ", "open ", "create ")):
                tool_calls = [
                    SimpleNamespace(
                        id="tc-jira-1",
                        function=SimpleNamespace(
                            name="create_jira_ticket",
                            arguments=json.dumps(
                                {
                                    "title": q[:70],
                                    "description": q,
                                    "priority": "high" if "high priority" in ql else "medium",
                                }
                            ),
                        ),
                    )
                ]
            elif any(k in ql for k in ("phishing", "stolen", "escalate immediately", "escalate this")):
                tool_calls = [
                    SimpleNamespace(
                        id="tc-esc-1",
                        function=SimpleNamespace(
                            name="escalate_to_human",
                            arguments=json.dumps({"reason": q, "urgency": "high"}),
                        ),
                    )
                ]

            msg = SimpleNamespace(
                content=None if tool_calls else "Follow the documented IT SOP steps shown above.",
                tool_calls=tool_calls,
            )
            return SimpleNamespace(
                choices=[SimpleNamespace(message=msg)],
                usage=SimpleNamespace(prompt_tokens=260, completion_tokens=42),
            )

    def __init__(self, **_kwargs) -> None:
        self.chat = SimpleNamespace(completions=self._Completions())


def build_results_markdown(
    results: List[Dict[str, Any]],
    accuracy: float,
    citation_accuracy: float,
    avg_latency_ms: float,
    p50_latency_ms: float,
    p95_latency_ms: float,
    deflection_rate: float,
    target_label: str,
) -> str:
    """Format evaluation KPIs, citation correctness, and latency percentiles as Markdown."""
    total = len(results)
    passed_count = sum(1 for r in results if r["passed"])
    citation_ok_count = sum(1 for r in results if r["citation_ok"])
    escalated_count = sum(1 for r in results if r["escalated"])
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

    lines = [
        "# AI-HAS Evaluation Results",
        "",
        f"- **Run Timestamp**: {timestamp}",
        f"- **Target**: `{target_label}`",
        f"- **Total Test Cases**: {total}",
        f"- **Outcome Accuracy**: {accuracy}% ({passed_count}/{total})",
        f"- **Citation Correctness**: {citation_accuracy}% ({citation_ok_count}/{total})",
        f"- **Average Latency**: {avg_latency_ms} ms (p50={p50_latency_ms} ms, p95={p95_latency_ms} ms)",
        f"- **Deflection Rate**: {deflection_rate}% ({total - escalated_count}/{total} non-escalated)",
        "",
        "## Accuracy & Citations by Category",
        "",
        "| Category | Passed | Citations OK | Total | Accuracy | Citation Acc |",
        "| --- | ---: | ---: | ---: | ---: | ---: |",
    ]

    categories: List[str] = list(dict.fromkeys(r["category"] for r in results))
    for cat in categories:
        cat_rows = [r for r in results if r["category"] == cat]
        cat_passed = sum(1 for r in cat_rows if r["passed"])
        cat_cit = sum(1 for r in cat_rows if r["citation_ok"])
        cat_acc = round((cat_passed / len(cat_rows)) * 100, 1)
        cat_cit_acc = round((cat_cit / len(cat_rows)) * 100, 1)
        lines.append(
            f"| {cat} | {cat_passed} | {cat_cit} | {len(cat_rows)} | {cat_acc}% | {cat_cit_acc}% |"
        )

    lines.extend(
        [
            "",
            "## Case-by-Case Results",
            "",
            "| ID | Category | Question | Expected | Actual | Citation OK | Pass | Latency (ms) | Sources |",
            "| ---: | --- | --- | --- | --- | --- | --- | ---: | --- |",
        ]
    )

    for r in results:
        status = "PASS" if r["passed"] else "FAIL"
        cit_mark = "YES" if r["citation_ok"] else "NO"
        sources = ", ".join(r["sources"]) if r["sources"] else "-"
        lines.append(
            f"| {r['id']} | {r['category']} | {_md_cell(r['question'])} | "
            f"`{r['expected']}` | `{r['actual']}` | {cit_mark} | {status} | "
            f"{r['latency_ms']:.2f} | {_md_cell(sources, 50)} |"
        )

    lines.append("")
    return "\n".join(lines)


def _http_server_alive(url: str) -> bool:
    try:
        resp = requests.get(f"{url}/health", timeout=2)
        return resp.ok
    except requests.RequestException:
        return False


def _run_against_client(post_chat_fn, questions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    results: List[Dict[str, Any]] = []
    for case in questions:
        case_id = case["id"]
        category = case["category"]
        question = case["question"]
        expected = case["expected"]
        expected_source = case.get("expected_source")

        try:
            data = post_chat_fn(case_id, question)
            actual = classify_outcome(data, expected)
            escalated = bool(data.get("escalated"))
            latency_ms = float(data.get("latency_ms", 0.0))
            raw_citations = data.get("citations", []) or []
            citation_ok = check_citation_correctness(raw_citations, expected_source)
            sources = [c.get("source") or c.get("title", "") for c in raw_citations if c.get("source") or c.get("title")]
            error_msg = None
        except Exception as exc:
            actual = "error"
            escalated = False
            latency_ms = 0.0
            citation_ok = False
            sources = []
            error_msg = str(exc)

        passed = actual == expected
        results.append(
            {
                "id": case_id,
                "category": category,
                "question": question,
                "expected": expected,
                "expected_source": expected_source,
                "actual": actual,
                "passed": passed,
                "citation_ok": citation_ok,
                "escalated": escalated,
                "latency_ms": latency_ms,
                "sources": sources,
                "error": error_msg,
            }
        )
        mark = "PASS" if (passed and citation_ok) else ("WARN" if passed else "FAIL")
        print(
            f"[{mark}] #{case_id:02d} ({category:12s}) "
            f"expected={expected:28s} actual={actual:28s} cit={citation_ok} latency={latency_ms:.1f}ms"
        )
    return results


def run_evaluation(
    questions_path: Path = QUESTIONS_PATH,
    results_path: Path = RESULTS_PATH,
    backend_url: str = DEFAULT_BACKEND_URL,
    ci_mode: bool = False,
    local_mode: bool = False,
) -> Dict[str, Any]:
    """Execute all questions against POST /chat (live server or TestClient), print KPIs & save results."""
    reset_rate_limiter()
    questions = json.loads(questions_path.read_text(encoding="utf-8"))

    use_in_process = ci_mode or local_mode or not _http_server_alive(backend_url)
    if not use_in_process:
        login_res = requests.post(
            f"{backend_url}/auth/login",
            json={"username": "marcus.vance@company.com", "password": "demo123", "role": "customer"},
            timeout=10,
        )
        login_res.raise_for_status()
        headers = {"Authorization": f"Bearer {login_res.json()['token']}"}

        def post_live(case_id: int, question: str) -> Dict[str, Any]:
            r = requests.post(
                f"{backend_url}/chat",
                headers=headers,
                json={"session_id": f"eval-live-{case_id}", "message": question, "role": "user"},
                timeout=30,
            )
            r.raise_for_status()
            return r.json()

        results = _run_against_client(post_live, questions)
        target_label = backend_url
    else:
        from fastapi.testclient import TestClient
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker

        from backend import llm as backend_llm
        from backend.db import Base, DEFAULT_USERS, get_db
        from backend.main import app
        from backend.models import User

        tmpdir = tempfile.TemporaryDirectory()
        db_path = Path(tmpdir.name) / "eval_ci.db"
        engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
        SessionEval = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        Base.metadata.create_all(bind=engine)
        seed_db = SessionEval()
        for uname, name, role in DEFAULT_USERS:
            seed_db.add(User(username=uname, name=name, role=role))
        seed_db.commit()
        seed_db.close()

        def _override_db():
            db = SessionEval()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = _override_db
        try:
            client = TestClient(app)
            token = client.post(
                "/auth/login",
                json={"username": "marcus.vance@company.com", "password": "demo123", "role": "customer"},
            ).json()["token"]
            headers = {"Authorization": f"Bearer {token}"}

            def post_local(case_id: int, question: str) -> Dict[str, Any]:
                r = client.post(
                    "/chat",
                    headers=headers,
                    json={"session_id": f"eval-ci-{case_id}", "message": question, "role": "user"},
                )
                r.raise_for_status()
                return r.json()

            use_ci_stub = ci_mode or not os.getenv("OPENAI_API_KEY")
            if use_ci_stub:
                with patch("backend.llm.OpenAI", _CIStubClient), patch.object(
                    backend_llm.config, "OPENAI_API_KEY", "ci-dummy-key"
                ), patch("backend.tools.requests.post") as mock_hook:
                    mock_hook.return_value = SimpleNamespace(ok=True, status_code=200)
                    results = _run_against_client(post_local, questions)
                target_label = "in-process TestClient (CI mode)"
            else:
                results = _run_against_client(post_local, questions)
                target_label = "in-process TestClient (live LLM)"
        finally:
            app.dependency_overrides.clear()
            engine.dispose()
            tmpdir.cleanup()

    reset_rate_limiter()
    total = len(results)
    passed_count = sum(1 for r in results if r["passed"])
    citation_ok_count = sum(1 for r in results if r["citation_ok"])
    escalated_count = sum(1 for r in results if r["escalated"])
    latencies = [r["latency_ms"] for r in results]

    accuracy = round((passed_count / total) * 100, 1) if total else 0.0
    citation_accuracy = round((citation_ok_count / total) * 100, 1) if total else 0.0
    avg_latency_ms = round(statistics.mean(latencies), 2) if latencies else 0.0
    p50_latency_ms = round(statistics.median(latencies), 2) if latencies else 0.0
    p95_latency_ms = _percentile(latencies, 0.95)
    deflection_rate = round(((total - escalated_count) / total) * 100, 1) if total else 0.0

    markdown = build_results_markdown(
        results=results,
        accuracy=accuracy,
        citation_accuracy=citation_accuracy,
        avg_latency_ms=avg_latency_ms,
        p50_latency_ms=p50_latency_ms,
        p95_latency_ms=p95_latency_ms,
        deflection_rate=deflection_rate,
        target_label=target_label,
    )
    results_path.write_text(markdown, encoding="utf-8")

    print("\n=== Evaluation Summary ===")
    print(f"Target              : {target_label}")
    print(f"Total Cases         : {total}")
    print(f"Outcome Accuracy    : {accuracy}% ({passed_count}/{total})")
    print(f"Citation Correctness: {citation_accuracy}% ({citation_ok_count}/{total})")
    print(f"Avg Latency         : {avg_latency_ms} ms (p50={p50_latency_ms} ms, p95={p95_latency_ms} ms)")
    print(f"Deflection Rate     : {deflection_rate}%")
    print(f"Results saved       : {results_path}")

    return {
        "total": total,
        "passed": passed_count,
        "accuracy": accuracy,
        "citation_accuracy": citation_accuracy,
        "avg_latency_ms": avg_latency_ms,
        "p50_latency_ms": p50_latency_ms,
        "p95_latency_ms": p95_latency_ms,
        "deflection_rate": deflection_rate,
        "results_path": str(results_path),
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run AI-HAS evaluation suite.")
    parser.add_argument("--ci", action="store_true", help="Run in-process offline CI evaluation.")
    parser.add_argument("--local", action="store_true", help="Run against in-process TestClient.")
    parser.add_argument("--url", default=DEFAULT_BACKEND_URL, help="Live backend base URL.")
    parser.add_argument("--min-accuracy", type=float, default=85.0, help="Fail exit code below threshold.")
    args = parser.parse_args()

    summary = run_evaluation(
        backend_url=args.url,
        ci_mode=args.ci,
        local_mode=args.local,
    )
    if args.ci and (summary["accuracy"] < args.min_accuracy or summary["citation_accuracy"] < args.min_accuracy):
        sys.exit(1)
