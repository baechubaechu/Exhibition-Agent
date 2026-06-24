"""
조명 제어 — push: 로컬망 ESP 에 HTTP POST / pull: VPS 큐에 쌓고 ESP 가 HTTPS 로 폴링.

핵심: 조명 POST 는 **씬 파이프라인을 절대 막지 않는다.**
- push 모드에서는 백그라운드 task 로 fire-and-forget (await 하지 않음).
- 짧은 타임아웃 + 공유 AsyncClient 로 미연결 ESP 가 있어도 지연·소켓 누수 없음.
- EXHIBITION_LIGHT_HTTP_URL / EXHIBITION_LIGHT_MATRIX_HTTP_URL 이 모두 비면 호출 없음.
"""
from __future__ import annotations

import asyncio
import logging
import os
import time
from typing import Literal, Optional

import httpx

log = logging.getLogger(__name__)

from app.device.light_pull_queue import enqueue_light_command

Zone = Literal["zoneA", "zoneB", "all"]


class LightDriver:
    def __init__(self) -> None:
        self.last_command: dict | None = None
        self._mode = os.getenv("EXHIBITION_LIGHT_MODE", "push").strip().lower()
        self._base_url = os.getenv("EXHIBITION_LIGHT_HTTP_URL", "").rstrip("/")
        self._matrix_url = os.getenv("EXHIBITION_LIGHT_MATRIX_HTTP_URL", "").rstrip("/")
        self._token = os.getenv("EXHIBITION_LIGHT_HTTP_TOKEN", "")
        self._client: Optional[httpx.AsyncClient] = None
        self._tasks: set[asyncio.Task] = set()
        self.last_post_results: dict[str, str] = {}

    def _get_client(self) -> httpx.AsyncClient:
        # 공유 클라이언트 — 매 호출 새로 만들면 실패 소켓이 쌓여(TIME_WAIT) 시간이 갈수록 느려짐.
        if self._client is None:
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(2.0, connect=1.0),
                limits=httpx.Limits(max_connections=8, max_keepalive_connections=8),
            )
        return self._client

    async def apply_scene(
        self,
        *,
        zone: Zone,
        scene_id: str,
        brightness: int,
        color_temp: int,
        transition_ms: int,
    ) -> None:
        b = min(max(int(brightness), 0), 100)
        body = {
            "scene_id": scene_id,
            "zone": zone,
            "brightness": b,
            "color_temp": int(color_temp),
            "transition_ms": int(transition_ms),
        }
        self.last_command = body

        if self._mode == "pull":
            await enqueue_light_command(body)
            return

        urls = [u for u in (self._base_url, self._matrix_url) if u]
        if not urls:
            return

        # 조명 HTTP 는 씬 결정/상태 갱신을 막지 않도록 백그라운드로 던지고 즉시 반환.
        task = asyncio.create_task(self._post_all(urls, body))
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)

    async def _post_all(self, urls: list[str], body: dict) -> None:
        headers: dict[str, str] = {}
        if self._token:
            headers["Authorization"] = f"Bearer {self._token}"
        client = self._get_client()

        async def post_one(url: str) -> None:
            try:
                r = await client.post(f"{url}/light/scene", json=body, headers=headers)
                r.raise_for_status()
                self.last_post_results[url] = f"ok {int(time.time())}"
            except Exception as err:
                msg = f"{type(err).__name__}: {err}"
                self.last_post_results[url] = msg
                log.warning("light POST failed %s — %s", url, msg)

        await asyncio.gather(*(post_one(url) for url in urls))

    def diagnostics(self) -> dict:
        return {
            "mode": self._mode,
            "urls": [u for u in (self._base_url, self._matrix_url) if u],
            "last_command": self.last_command,
            "last_post_results": dict(self.last_post_results),
        }
