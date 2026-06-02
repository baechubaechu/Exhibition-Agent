#!/usr/bin/env python3
"""Vision / Google 서비스 계정 경로 진단 — exhibition-agent 루트에서 실행."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
from app.env_load import credentials_diagnostics, format_credentials_help, load_repo_env
from app.vision_google import get_vision_client


def main() -> int:
    load_repo_env()
    d = credentials_diagnostics()
    print("=== Vision env ===")
    for k, v in d.items():
        print(f"  {k}: {v}")

    resolved = d.get("resolved_path")
    if resolved:
        try:
            with open(resolved, encoding="utf-8-sig") as f:
                data = json.load(f)
            print(f"  json_type: {data.get('type')}")
            print(f"  client_email: {data.get('client_email', '(없음)')}")
        except Exception as e:
            print(f"  json_read_error: {e}")

    print()
    if not d.get("file_exists"):
        print(format_credentials_help())
        return 1

    try:
        get_vision_client()
        print("OK: ImageAnnotatorClient 생성 성공")
        return 0
    except Exception as e:
        print(f"FAIL: {e}")
        print()
        print(format_credentials_help())
        return 1


if __name__ == "__main__":
    sys.exit(main())
