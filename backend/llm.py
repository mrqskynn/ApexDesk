"""OpenAI RAG answer generation with 3-round tool-calling loop."""

import json
import logging
from typing import Any, Dict, List, Optional

from openai import OpenAI
from sqlalchemy.orm import Session

from backend import config
from backend.guardrails import HARDENED_SYSTEM_PROMPT, redact_pii
from backend.tools import TOOLS_SCHEMA, escalate_to_human, execute_tool

logger = logging.getLogger("ai_has.llm")

MAX_TOOL_ROUNDS = 3
SYSTEM_PROMPT = HARDENED_SYSTEM_PROMPT


def _summarize_chunks(chunks: List[Dict]) -> List[Dict[str, Any]]:
    """Return compact chunk metadata for observability logging."""
    return [
        {
            "title": chunk.get("title", ""),
            "source": chunk.get("source", ""),
            "section": chunk.get("section", "Overview"),
            "score": round(float(chunk.get("score", 0.0)), 4),
        }
        for chunk in chunks
    ]


def _extract_token_usage(
    completion: Any,
    fallback_prompt_chars: int = 0,
    fallback_completion_chars: int = 0,
) -> tuple[int, int]:
    """Read token usage from OpenAI/Gemini response or estimate from char counts."""
    usage = getattr(completion, "usage", None)
    if usage is not None:
        p = int(getattr(usage, "prompt_tokens", 0) or 0)
        c = int(getattr(usage, "completion_tokens", 0) or 0)
        if p > 0 or c > 0:
            return p, c
    est_p = max(1, fallback_prompt_chars // 4) if fallback_prompt_chars else 0
    est_c = max(1, fallback_completion_chars // 4) if fallback_completion_chars else 0
    return est_p, est_c


def _compute_cost_usd(prompt_tokens: int, completion_tokens: int) -> float:
    """Estimate USD cost using compact model rates ($0.15/1M input, $0.60/1M output)."""
    return round((prompt_tokens * 0.15 + completion_tokens * 0.60) / 1_000_000, 6)


def _fallback_escalation(
    reason: str,
    chunks: List[Dict],
    db: Optional[Session],
    reply: str,
    prompt_tokens: int = 0,
    completion_tokens: int = 0,
) -> Dict[str, Any]:
    """Create a human escalation ticket (best effort) and return fallback response."""
    try:
        escalate_to_human(reason=reason, db=db)
    except Exception:
        logger.exception("Failed to record escalation ticket during fallback")
    top_score = round(float(chunks[0]["score"]), 4) if chunks else 0.0
    return {
        "reply": reply,
        "citations": _build_citations(chunks),
        "action_taken": "escalate_to_human",
        "escalated": True,
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "total_tokens": prompt_tokens + completion_tokens,
        "cost_usd": _compute_cost_usd(prompt_tokens, completion_tokens),
        "top_rag_score": top_score,
        "retrieved_chunks": _summarize_chunks(chunks),
        "outcome": "escalated",
    }


def _serialize_assistant_message(msg: Any) -> Dict[str, Any]:
    """Convert an OpenAI completion message into a serializable message dict."""
    payload: Dict[str, Any] = {
        "role": "assistant",
        "content": msg.content,
    }
    if msg.tool_calls:
        payload["tool_calls"] = [
            {
                "id": tc.id,
                "type": "function",
                "function": {
                    "name": tc.function.name,
                    "arguments": tc.function.arguments,
                },
            }
            for tc in msg.tool_calls
        ]
    return payload


def _build_citations(chunks: List[Dict]) -> List[Dict[str, Any]]:
    """Extract deduplicated citations (file name, section, title, score) above threshold."""
    citations: List[Dict[str, Any]] = []
    seen = set()
    for chunk in chunks:
        if chunk.get("score", 0.0) < config.RETRIEVAL_MIN_SCORE:
            continue
        title = chunk.get("title", "Unknown SOP")
        source = chunk.get("source", "")
        section = chunk.get("section", "Overview")
        snippet = chunk.get("snippet", "")
        key = (title, source, section, snippet)
        if key not in seen:
            seen.add(key)
            citations.append(
                {
                    "title": title,
                    "source": source,
                    "section": section,
                    "score": chunk.get("score"),
                    "snippet": snippet,
                }
            )
    return citations


def answer_with_rag(
    message: str,
    chunks: List[Dict],
    db: Optional[Session] = None,
) -> Dict[str, Any]:
    """Generate a grounded RAG response with up to 3 rounds of tool calling."""
    safe_message = redact_pii(message)
    best_score = chunks[0]["score"] if chunks else 0.0
    top_rag_score = round(float(best_score), 4) if chunks else 0.0
    chunk_summary = _summarize_chunks(chunks)

    if not chunks or best_score < config.RETRIEVAL_MIN_SCORE:
        reason = (
            f"Low retrieval confidence (best_score={best_score:.2f} "
            f"< {config.RETRIEVAL_MIN_SCORE}) for query: {safe_message}"
        )
        escalate_to_human(reason=reason, db=db)
        return {
            "reply": (
                "I'm not sure how to resolve this based on our current IT knowledge base. "
                "I have escalated your request to a human IT support specialist who will assist you shortly."
            ),
            "citations": [],
            "action_taken": "escalate_to_human",
            "escalated": True,
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0,
            "cost_usd": 0.0,
            "top_rag_score": top_rag_score,
            "retrieved_chunks": chunk_summary,
            "outcome": "escalated",
        }

    if not config.OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY is not set. Add it to your .env file.")

    context_blocks = [
        (
            f"[SOP Title: {chunk['title']} | File: {chunk.get('source', '')} | "
            f"Section: {chunk.get('section', 'Overview')} | Score: {chunk['score']}]\n"
            f"{chunk['snippet']}"
        )
        for chunk in chunks
    ]
    context_text = "\n\n---\n\n".join(context_blocks)

    user_prompt = (
        f"IT Knowledge Base Context:\n{context_text}\n\n"
        f"User Question:\n{safe_message}"
    )

    client = OpenAI(api_key=config.OPENAI_API_KEY, base_url=config.OPENAI_BASE_URL)
    messages: List[Dict[str, Any]] = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt},
    ]

    actions_taken: List[str] = []
    escalated = False
    reply_text = ""
    total_prompt_tokens = 0
    total_completion_tokens = 0

    # Tool-calling loop strictly capped at MAX_TOOL_ROUNDS (3)
    for _round in range(MAX_TOOL_ROUNDS):
        try:
            completion = client.chat.completions.create(
                model=config.OPENAI_CHAT_MODEL,
                temperature=0.2,
                messages=messages,
                tools=TOOLS_SCHEMA,
                tool_choice="auto",
            )
        except Exception as exc:
            logger.exception("Chat completion failed on tool round %s", _round)
            return _fallback_escalation(
                reason=f"LLM completion failed on round {_round}: {exc}",
                chunks=chunks,
                db=db,
                reply="I'm having trouble processing this request through our LLM provider. I have escalated this issue to our human IT team.",
                prompt_tokens=total_prompt_tokens,
                completion_tokens=total_completion_tokens,
            )

        assistant_msg = completion.choices[0].message
        p_tok, c_tok = _extract_token_usage(
            completion,
            fallback_prompt_chars=sum(len(str(m.get("content") or "")) for m in messages),
            fallback_completion_chars=len(assistant_msg.content or ""),
        )
        total_prompt_tokens += p_tok
        total_completion_tokens += c_tok
        messages.append(_serialize_assistant_message(assistant_msg))

        if not assistant_msg.tool_calls:
            reply_text = (assistant_msg.content or "").strip()
            break

        for tool_call in assistant_msg.tool_calls:
            fn_name = tool_call.function.name
            try:
                fn_args = json.loads(tool_call.function.arguments or "{}")
                if not isinstance(fn_args, dict):
                    fn_args = {}
            except json.JSONDecodeError as exc:
                logger.warning("Invalid JSON arguments for tool %s: %s", fn_name, exc)
                tool_output = {
                    "status": "error",
                    "message": "Invalid JSON tool arguments.",
                }
            else:
                try:
                    tool_output = execute_tool(
                        fn_name,
                        fn_args,
                        db=db,
                        require_approval_for_sensitive=True,
                    )
                    actions_taken.append(fn_name)
                    if fn_name == "escalate_to_human":
                        escalated = True
                except Exception as exc:
                    logger.exception("Tool execution failed for %s", fn_name)
                    tool_output = {
                        "status": "error",
                        "message": f"Tool execution error: {exc}",
                    }

            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": json.dumps(tool_output),
                }
            )

    # If all 3 rounds returned tool calls without a final text response, request one
    if not reply_text:
        try:
            final_completion = client.chat.completions.create(
                model=config.OPENAI_CHAT_MODEL,
                temperature=0.2,
                messages=messages,
            )
            reply_text = (final_completion.choices[0].message.content or "").strip()
            p_tok, c_tok = _extract_token_usage(
                final_completion,
                fallback_prompt_chars=sum(len(str(m.get("content") or "")) for m in messages),
                fallback_completion_chars=len(reply_text),
            )
            total_prompt_tokens += p_tok
            total_completion_tokens += c_tok
        except Exception as exc:
            logger.exception("Final chat completion failed after tool calls")
            return _fallback_escalation(
                reason=f"Final LLM completion failed: {exc}",
                chunks=chunks,
                db=db,
                reply="An action was processed, but I could not generate a summary reply due to an LLM provider error. I have escalated this issue to our human IT team.",
                prompt_tokens=total_prompt_tokens,
                completion_tokens=total_completion_tokens,
            )

    action_taken = ", ".join(dict.fromkeys(actions_taken)) if actions_taken else None
    outcome = "escalated" if escalated else ("action" if action_taken else "answered")

    return {
        "reply": reply_text,
        "citations": _build_citations(chunks),
        "action_taken": action_taken,
        "escalated": escalated,
        "prompt_tokens": total_prompt_tokens,
        "completion_tokens": total_completion_tokens,
        "total_tokens": total_prompt_tokens + total_completion_tokens,
        "cost_usd": _compute_cost_usd(total_prompt_tokens, total_completion_tokens),
        "top_rag_score": top_rag_score,
        "retrieved_chunks": chunk_summary,
        "outcome": outcome,
    }
