"""Hybrid RAG (vector cosine + lexical keyword), section chunking, and SOP matching."""

import logging
from pathlib import Path
import re
import sys
import threading
import time
from typing import Any, Dict, List, Optional

import chromadb
from openai import OpenAI

# Ensure project root is importable when invoked as `python -m backend.rag`
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.config import (  # noqa: E402
    CHROMA_DIR,
    KB_DIR,
    OPENAI_API_KEY,
    OPENAI_BASE_URL,
    OPENAI_EMBEDDING_MODEL,
    RETRIEVAL_TOP_K,
)

logger = logging.getLogger("ai_has.rag")

COLLECTION_NAME = "kb_sops"

STOPWORDS = {
    "the", "a", "an", "and", "or", "for", "of", "to", "in", "on", "at", "by",
    "is", "are", "was", "were", "be", "been", "with", "from", "as", "it",
    "this", "that", "how", "do", "does", "did", "can", "could", "should",
    "would", "what", "why", "when", "where", "my", "me", "i", "you", "your",
    "we", "our", "not", "no", "hi", "hello", "please", "help", "need",
    "today", "much", "menu", "bar", "give", "many",
    "something", "anything", "someone", "anyone", "about", "ticket",
    "description", "question", "details", "requester", "redacted", "email", "phone",
}

_QUERY_EMBED_CACHE: Dict[str, List[float]] = {}
_STEPS_CACHE: Dict[str, str] = {}
_EMBED_LOCK = threading.Lock()
_CHROMA_CLIENT = None
_CHROMA_LOCK = threading.Lock()


def extract_title(markdown_text: str, fallback: str) -> str:
    """Return the first top-level markdown heading or fall back to filename."""
    for line in markdown_text.splitlines():
        stripped = line.strip()
        if stripped.startswith("# "):
            return stripped[2:].strip()
    return fallback


def extract_resolution_steps(markdown_text: str) -> str:
    """Extract the Resolution Steps section from an SOP markdown file."""
    lines = markdown_text.replace("\r\n", "\n").splitlines()
    capturing = False
    collected: List[str] = []

    for line in lines:
        stripped = line.strip()
        if stripped.startswith("## "):
            heading = stripped[3:].strip().lower()
            if "resolution steps" in heading or heading == "steps":
                capturing = True
                continue
            elif capturing:
                break
        elif capturing:
            collected.append(line)

    result = "\n".join(collected).strip()
    if result:
        return result

    # Fallback: strip top-level heading and return remaining body
    body_lines = [l for l in lines if not l.strip().startswith("# ")]
    return "\n".join(body_lines).strip()


def _get_steps_for_source(source_filename: str, kb_dir: Path = KB_DIR) -> str:
    """Load cached Resolution Steps text for a given KB filename."""
    if not source_filename:
        return ""
    if source_filename in _STEPS_CACHE:
        return _STEPS_CACHE[source_filename]
    path = kb_dir / Path(source_filename).name
    if not path.exists():
        return ""
    try:
        steps = extract_resolution_steps(path.read_text(encoding="utf-8"))
        _STEPS_CACHE[source_filename] = steps
        return steps
    except Exception:
        return ""


def chunk_markdown_with_sections(
    markdown_text: str,
    title: str,
    chunk_size: int = 800,
    overlap: int = 150,
) -> List[Dict[str, str]]:
    """Split markdown into section-aware chunks tagged with their ## heading."""
    text = markdown_text.replace("\r\n", "\n").strip()
    if not text:
        return []

    # Parse into (section_name, body_text) pairs
    sections: List[tuple[str, str]] = []
    current_section = "Overview"
    current_lines: List[str] = []

    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("# "):
            continue
        if stripped.startswith("## "):
            body = "\n".join(current_lines).strip()
            if body:
                sections.append((current_section, body))
            current_section = stripped[3:].strip() or "Overview"
            current_lines = []
        else:
            current_lines.append(line)

    tail = "\n".join(current_lines).strip()
    if tail:
        sections.append((current_section, tail))

    if not sections:
        sections = [("Overview", text)]

    chunk_items: List[Dict[str, str]] = []
    for sec_name, sec_body in sections:
        prefix = f"{title} — {sec_name}"
        if len(sec_body) + len(prefix) + 2 <= chunk_size:
            chunk_items.append({"section": sec_name, "text": f"{prefix}\n\n{sec_body}"})
            continue

        effective_size = max(200, chunk_size - len(prefix) - 4)
        start = 0
        body_len = len(sec_body)
        while start < body_len:
            end = min(start + effective_size, body_len)
            if end < body_len:
                min_split = start + effective_size // 2
                split_at = -1
                for sep in ("\n\n", "\n", " "):
                    pos = sec_body.rfind(sep, min_split, end)
                    if pos > start:
                        split_at = pos + len(sep) if sep != " " else pos
                        break
                if split_at > start:
                    end = split_at
            piece = sec_body[start:end].strip()
            if piece:
                chunk_items.append({"section": sec_name, "text": f"{prefix}\n\n{piece}"})
            if end >= body_len:
                break
            start = max(start + 1, end - overlap)

    return chunk_items


def chunk_markdown(
    markdown_text: str,
    title: str,
    chunk_size: int = 800,
    overlap: int = 150,
) -> List[str]:
    """Split markdown text into overlapping chunks prefixed with title and section."""
    return [
        item["text"]
        for item in chunk_markdown_with_sections(
            markdown_text,
            title=title,
            chunk_size=chunk_size,
            overlap=overlap,
        )
    ]


def _tokenize_keywords(text: str) -> List[str]:
    tokens = re.findall(r"[a-z0-9]+", (text or "").lower())
    return [t for t in tokens if len(t) >= 2 and t not in STOPWORDS]


def _keyword_score(query: str, doc_text: str, title: str = "", section: str = "") -> float:
    """Compute lexical keyword overlap score in [0.0, 1.0]."""
    q_tokens = list(dict.fromkeys(_tokenize_keywords(query)))
    if not q_tokens:
        return 0.0

    doc_tokens = set(_tokenize_keywords(doc_text))
    header_tokens = set(_tokenize_keywords(f"{title} {section}"))

    doc_hits = sum(1 for tok in q_tokens if tok in doc_tokens)
    header_hits = sum(1 for tok in q_tokens if tok in header_tokens)

    base_ratio = doc_hits / len(q_tokens)
    header_bonus = 0.15 * (header_hits / len(q_tokens))
    return round(min(1.0, base_ratio + header_bonus), 4)


def embed_texts(texts: List[str], max_retries: int = 5) -> List[List[float]]:
    """Generate embeddings with automatic retry on rate limit."""
    if not texts:
        return []
    if not OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY is not set. Add it to your .env file.")

    client = OpenAI(api_key=OPENAI_API_KEY, base_url=OPENAI_BASE_URL, timeout=15.0)
    embeddings: List[List[float]] = []

    batch_size = 10
    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        for attempt in range(max_retries):
            try:
                response = client.embeddings.create(
                    model=OPENAI_EMBEDDING_MODEL,
                    input=batch,
                )
                embeddings.extend(item.embedding for item in response.data)
                break
            except Exception as e:
                err_str = str(e)
                if ("429" in err_str or "RateLimit" in type(e).__name__) and attempt + 1 < max_retries:
                    wait_s = 10 * (attempt + 1)
                    logger.warning("[embed_texts] Rate limited (429). Retrying in %ss...", wait_s)
                    time.sleep(wait_s)
                else:
                    raise
        else:
            raise RuntimeError("Failed to generate embeddings after retries due to rate limits.")

    return embeddings


def _get_query_embedding(query: str) -> List[float]:
    key = query.strip()
    if key in _QUERY_EMBED_CACHE:
        return _QUERY_EMBED_CACHE[key]
    with _EMBED_LOCK:
        if key in _QUERY_EMBED_CACHE:
            return _QUERY_EMBED_CACHE[key]
        emb = embed_texts([key], max_retries=1)[0]
        _QUERY_EMBED_CACHE[key] = emb
        return emb


def warm_query_embeddings(queries: List[str]) -> None:
    """Batch-embed unseen queries under a single-flight lock so ticket SOP matching stays fast."""
    if not OPENAI_API_KEY:
        return
    with _EMBED_LOCK:
        unseen = [
            q.strip()
            for q in queries
            if q and q.strip() and q.strip() not in _QUERY_EMBED_CACHE
        ]
        unseen = list(dict.fromkeys(unseen))
        if not unseen:
            return
        try:
            vectors = embed_texts(unseen, max_retries=1)
            for q, vec in zip(unseen, vectors):
                _QUERY_EMBED_CACHE[q] = vec
        except Exception as exc:
            logger.warning("Batch query embedding warmup skipped: %s", exc)


def get_chroma_collection(reset: bool = False):
    """Return the persistent ChromaDB collection using a thread-safe client singleton."""
    global _CHROMA_CLIENT
    CHROMA_DIR.mkdir(parents=True, exist_ok=True)
    with _CHROMA_LOCK:
        if _CHROMA_CLIENT is None:
            _CHROMA_CLIENT = chromadb.PersistentClient(path=str(CHROMA_DIR))
        client = _CHROMA_CLIENT

        if reset:
            try:
                client.delete_collection(name=COLLECTION_NAME)
            except Exception as exc:
                logger.debug("Ignoring Chroma delete_collection(%s): %s", COLLECTION_NAME, exc)

        return client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )


def _iter_kb_files(kb_dir: Path = KB_DIR) -> List[Path]:
    """Return sorted markdown and text SOP files in kb_dir."""
    if not kb_dir.exists():
        return []
    return sorted(list(kb_dir.glob("*.md")) + list(kb_dir.glob("*.txt")))


def list_kb_documents(kb_dir: Path = KB_DIR) -> List[Dict[str, Any]]:
    """Return metadata and chunk counts for all SOP files in kb_dir."""
    docs: List[Dict[str, Any]] = []
    for kb_file in _iter_kb_files(kb_dir):
        content = kb_file.read_text(encoding="utf-8")
        title = extract_title(content, fallback=kb_file.stem)
        chunks = chunk_markdown_with_sections(content, title=title)
        docs.append(
            {
                "filename": kb_file.name,
                "title": title,
                "chunks": len(chunks),
                "size_bytes": kb_file.stat().st_size,
            }
        )
    return docs


def _load_markdown_corpus(
    kb_dir: Path = KB_DIR,
) -> tuple[List[str], List[str], List[Dict[str, Any]]]:
    """Read and chunk /kb markdown files directly when ChromaDB is unindexed."""
    ids: List[str] = []
    documents: List[str] = []
    metadatas: List[Dict[str, Any]] = []
    for kb_file in _iter_kb_files(kb_dir):
        content = kb_file.read_text(encoding="utf-8")
        title = extract_title(content, fallback=kb_file.stem)
        chunk_items = chunk_markdown_with_sections(content, title=title)
        for idx, item in enumerate(chunk_items):
            ids.append(f"{kb_file.name}__chunk_{idx}")
            documents.append(item["text"])
            metadatas.append(
                {
                    "title": title,
                    "source": kb_file.name,
                    "section": item["section"],
                    "chunk_index": idx,
                }
            )
    return ids, documents, metadatas


def index_kb(kb_dir: Path = KB_DIR) -> Dict[str, int]:
    """Chunk, embed, and store all markdown/text SOP files with section metadata in ChromaDB."""
    kb_files = _iter_kb_files(kb_dir)
    ids, documents, metadatas = _load_markdown_corpus(kb_dir)

    _QUERY_EMBED_CACHE.clear()
    _STEPS_CACHE.clear()

    collection = get_chroma_collection(reset=True)
    if not documents:
        return {"files_indexed": 0, "chunks_indexed": 0}

    embeddings = embed_texts(documents)
    collection.add(
        ids=ids,
        documents=documents,
        embeddings=embeddings,
        metadatas=metadatas,
    )

    return {"files_indexed": len(kb_files), "chunks_indexed": len(documents)}


def retrieve(
    query: str,
    top_k: int = RETRIEVAL_TOP_K,
    use_vectors: bool = True,
) -> List[Dict[str, Any]]:
    """Hybrid search (ChromaDB vector cosine + lexical keyword overlap) across indexed SOPs."""
    clean_query = (query or "").strip()
    if not clean_query:
        return []

    collection = get_chroma_collection(reset=False)
    with _CHROMA_LOCK:
        total = collection.count()
        if total == 0:
            ids, docs, metas = _load_markdown_corpus()
            if not ids:
                return []
        else:
            # Read full local chunk corpus under lock so concurrent threads never race Chroma bindings
            corpus = collection.get(include=["documents", "metadatas"])
            ids = corpus.get("ids") or []
            docs = corpus.get("documents") or []
            metas = corpus.get("metadatas") or []

    vector_scores_by_id: Dict[str, float] = {}
    vectors_used = False
    if total > 0 and use_vectors and OPENAI_API_KEY:
        try:
            q_emb = _get_query_embedding(clean_query)
            with _CHROMA_LOCK:
                vec_res = collection.query(
                    query_embeddings=[q_emb],
                    n_results=total,
                    include=["distances"],
                )
            vec_ids = (vec_res.get("ids") or [[]])[0]
            vec_dists = (vec_res.get("distances") or [[]])[0]
            for cid, dist in zip(vec_ids, vec_dists):
                vector_scores_by_id[cid] = max(0.0, 1.0 - float(dist))
            vectors_used = True
        except Exception as exc:
            logger.warning("Vector embedding lookup failed; falling back to keyword search: %s", exc)

    scored_chunks: List[Dict[str, Any]] = []
    for cid, doc, meta in zip(ids, docs, metas):
        meta = meta or {}
        title = str(meta.get("title", "Unknown SOP"))
        source = str(meta.get("source", ""))
        section = str(meta.get("section", "Overview"))

        v_score = round(vector_scores_by_id.get(cid, 0.0), 4)
        k_score = _keyword_score(clean_query, doc, title=title, section=section)

        if vectors_used:
            # Blend cosine semantic similarity with lexical keyword precision
            hybrid = round(min(1.0, 0.45 * v_score + 0.55 * k_score), 4)
        else:
            hybrid = round(k_score, 4)

        scored_chunks.append(
            {
                "title": title,
                "source": source,
                "section": section,
                "snippet": doc,
                "steps": _get_steps_for_source(source),
                "score": hybrid,
                "vector_score": v_score,
                "keyword_score": k_score,
            }
        )

    scored_chunks.sort(key=lambda item: item["score"], reverse=True)
    return scored_chunks[:top_k]


def _clean_ticket_query(title: str, description: str) -> str:
    body = re.sub(r"^Requester:\s*.*\n?", "", (description or ""), flags=re.MULTILINE).strip()
    return f"{title} {body}".strip()


def match_sop_for_ticket(title: str, description: str) -> Optional[Dict[str, Any]]:
    """Return the highest-scoring hybrid RAG SOP match and its real steps for a ticket."""
    query = _clean_ticket_query(title, description)
    if not query:
        return None

    hits = retrieve(query, top_k=1, use_vectors=True)
    if not hits:
        return None

    top = hits[0]
    if top["score"] <= 0.0:
        return None

    return {
        "title": top["title"],
        "source": top["source"],
        "section": top["section"],
        "score": top["score"],
        "confidence_pct": round(top["score"] * 100),
        "snippet": top["snippet"],
        "steps": top["steps"] or top["snippet"],
    }


if __name__ == "__main__":
    summary = index_kb()
    print(
        f"Indexed {summary['files_indexed']} KB files "
        f"({summary['chunks_indexed']} chunks) into {CHROMA_DIR}"
    )
