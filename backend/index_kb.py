"""CLI script to index all /kb markdown SOPs into ChromaDB."""

from pathlib import Path
import sys

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.config import CHROMA_DIR, KB_DIR  # noqa: E402
from backend.rag import index_kb  # noqa: E402


def main() -> None:
    """Run KB indexing and print summary."""
    summary = index_kb(KB_DIR)
    print(
        f"Indexed {summary['files_indexed']} KB files "
        f"({summary['chunks_indexed']} chunks) from {KB_DIR} into {CHROMA_DIR}"
    )


if __name__ == "__main__":
    main()
