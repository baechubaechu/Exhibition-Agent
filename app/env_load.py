"""Load `.env.local` / `.env` from repo root and `web/` so FastAPI shares config with Next.js."""
from __future__ import annotations

import os
from pathlib import Path

AGENT_ROOT = Path(__file__).resolve().parent.parent


def resolve_credentials_path(raw: str, *, base: Path | None = None) -> Path:
    """`.env` 경로를 절대 경로로 — 상대 경로는 레포 루트 기준."""
    text = raw.strip().strip('"').strip("'")
    if not text:
        raise ValueError("GOOGLE_APPLICATION_CREDENTIALS is empty")
    path = Path(text).expanduser()
    if not path.is_absolute():
        path = (base or AGENT_ROOT) / path
    return path.resolve()


def normalize_google_credentials(*, base: Path | None = None) -> Path | None:
    """GOOGLE_APPLICATION_CREDENTIALS 를 절대 경로로 고정. 파일 없으면 None."""
    raw = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "").strip()
    if not raw:
        return None
    try:
        resolved = resolve_credentials_path(raw, base=base or AGENT_ROOT)
    except ValueError:
        return None
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(resolved)
    return resolved


def load_repo_env() -> None:
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    for folder in (AGENT_ROOT / "web", AGENT_ROOT):
        load_dotenv(folder / ".env.local", override=True)
        load_dotenv(folder / ".env", override=True)
    normalize_google_credentials()
