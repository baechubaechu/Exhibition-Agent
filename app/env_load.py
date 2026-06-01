"""Load `.env.local` / `.env` from repo root and `web/` so FastAPI shares config with Next.js."""
from __future__ import annotations

from pathlib import Path


def load_repo_env() -> None:
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    # app/ -> repo root (exhibition-agent)
    agent_root = Path(__file__).resolve().parent.parent
    for folder in (agent_root / "web", agent_root):
        load_dotenv(folder / ".env.local", override=True)
        load_dotenv(folder / ".env", override=True)
