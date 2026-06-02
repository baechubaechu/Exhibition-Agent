"""Load `.env.local` / `.env` from repo root and `web/` so FastAPI shares config with Next.js."""
from __future__ import annotations

import os
from pathlib import Path

AGENT_ROOT = Path(__file__).resolve().parent.parent

SERVICE_ACCOUNT_GLOBS = ("gen-lang-client-*.json", "norse-retina*.json", "*service*account*.json")
ENV_KEYS_FROM_ROOT = ("GOOGLE_APPLICATION_CREDENTIALS", "USE_VISION_API")


def _strip_env_value(raw: str) -> str:
    """BOM·따옴표·앞뒤 공백 제거."""
    text = raw.strip().strip("\ufeff").strip('"').strip("'").strip()
    return text


def read_env_key_from_file(path: Path, key: str) -> str | None:
    """dotenv 없이도 루트 `.env` 한 줄을 읽음 (Windows 사용자 env 덮어쓰기용)."""
    if not path.is_file():
        return None
    try:
        text = path.read_text(encoding="utf-8-sig")
    except OSError:
        return None
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if stripped.startswith(f"{key}="):
            return _strip_env_value(stripped.split("=", 1)[1])
    return None


def resolve_credentials_path(raw: str, *, base: Path | None = None) -> Path:
    """`.env` 경로를 절대 경로로 — 상대 경로는 base(기본 레포 루트) 기준."""
    text = _strip_env_value(raw)
    if not text:
        raise ValueError("GOOGLE_APPLICATION_CREDENTIALS is empty")
    path = Path(text).expanduser()
    if not path.is_absolute():
        path = (base or AGENT_ROOT) / path
    return path.resolve()


def list_service_account_json_candidates(*, base: Path | None = None) -> list[Path]:
    root = base or AGENT_ROOT
    found: list[Path] = []
    seen: set[Path] = set()
    for pattern in SERVICE_ACCOUNT_GLOBS:
        for p in sorted(root.glob(pattern)):
            if not p.is_file():
                continue
            try:
                head = p.read_text(encoding="utf-8-sig", errors="ignore")[:400]
            except OSError:
                continue
            if '"type"' in head and "service_account" in head:
                if p not in seen:
                    seen.add(p)
                    found.append(p)
    return found


def _match_candidate_by_name(raw: str, candidates: list[Path]) -> Path | None:
    if not raw or not candidates:
        return None
    want = Path(_strip_env_value(raw)).name.lower()
    if not want:
        return None
    for c in candidates:
        if c.name.lower() == want:
            return c
    for c in candidates:
        if want in c.name.lower() or c.name.lower() in want:
            return c
    return None


def resolve_existing_credentials_path(raw: str) -> Path | None:
    """실제 존재하는 JSON 경로 — 레포 루트·cwd·Windows .json.txt·자동 탐색."""
    text = _strip_env_value(raw)

    if text:
        candidates: list[Path] = []
        for base in (AGENT_ROOT, Path.cwd()):
            try:
                candidates.append(resolve_credentials_path(text, base=base))
            except ValueError:
                continue

        for path in candidates:
            if path.is_file():
                return path
            if path.suffix.lower() == ".json":
                alt = path.with_name(path.name + ".txt")
                if alt.is_file():
                    return alt

    repo_candidates = list_service_account_json_candidates()
    matched = _match_candidate_by_name(text, repo_candidates)
    if matched:
        return matched
    if len(repo_candidates) == 1:
        return repo_candidates[0]

    return None


def credentials_diagnostics() -> dict[str, object]:
    raw = _strip_env_value(os.getenv("GOOGLE_APPLICATION_CREDENTIALS", ""))
    resolved = resolve_existing_credentials_path(raw) if raw else resolve_existing_credentials_path("")
    try:
        configured = resolve_credentials_path(raw) if raw else None
    except ValueError:
        configured = None

    root_json = list_service_account_json_candidates()
    root_env = read_env_key_from_file(AGENT_ROOT / ".env", "GOOGLE_APPLICATION_CREDENTIALS")
    return {
        "agent_root": str(AGENT_ROOT),
        "cwd": str(Path.cwd()),
        "raw_env": raw or None,
        "root_dotenv_value": root_env,
        "configured_path": str(configured) if configured else None,
        "resolved_path": str(resolved) if resolved else None,
        "file_exists": resolved is not None and resolved.is_file(),
        "candidates_in_repo_root": [p.name for p in root_json],
        "use_vision_api": os.getenv("USE_VISION_API"),
    }


def format_credentials_help() -> str:
    d = credentials_diagnostics()
    lines = [
        f"레포 루트: {d['agent_root']}",
        f"현재 cwd: {d['cwd']}",
        f"프로세스 env: {d['raw_env'] or '(비어 있음)'}",
        f"루트 .env 파일: {d['root_dotenv_value'] or '(없음)'}",
    ]
    if d["configured_path"]:
        lines.append(f"해석 경로: {d['configured_path']}")
    if d["resolved_path"]:
        lines.append(f"사용 경로: {d['resolved_path']}")
    names = d.get("candidates_in_repo_root") or []
    if names:
        lines.append(f"루트 서비스 계정 JSON: {', '.join(names)}")
    if not d["file_exists"]:
        lines.append(
            "→ exhibition-agent 폴더에서: python scripts/check_vision_env.py"
        )
    return "\n".join(lines)


def normalize_google_credentials(*, base: Path | None = None) -> Path | None:
    """GOOGLE_APPLICATION_CREDENTIALS 를 존재하는 파일의 절대 경로로 고정."""
    raw = _strip_env_value(os.getenv("GOOGLE_APPLICATION_CREDENTIALS", ""))
    resolved = resolve_existing_credentials_path(raw) if raw else resolve_existing_credentials_path("")

    if resolved is None and raw:
        try:
            resolved = resolve_credentials_path(raw, base=base or AGENT_ROOT)
        except ValueError:
            return None

    if resolved is None:
        return None

    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(resolved)
    return resolved if resolved.is_file() else resolved


def apply_root_env_overrides() -> None:
    """루트 `.env` 값이 Windows 사용자 env·web/.env.local 보다 우선."""
    root_env = AGENT_ROOT / ".env"
    for key in ENV_KEYS_FROM_ROOT:
        val = read_env_key_from_file(root_env, key)
        if val:
            os.environ[key] = val


def load_repo_env() -> None:
    try:
        from dotenv import load_dotenv
    except ImportError:
        apply_root_env_overrides()
        normalize_google_credentials()
        return
    for folder in (AGENT_ROOT / "web", AGENT_ROOT):
        load_dotenv(folder / ".env.local", override=True)
        load_dotenv(folder / ".env", override=True)
    apply_root_env_overrides()
    normalize_google_credentials()
