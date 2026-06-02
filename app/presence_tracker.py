"""전시장 presence 모드 — sensor 엣지·체류·Explore·쿨다운 (모니터 /status 와 조명 트리거)."""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any, Literal, Optional

PresenceMode = Literal[
    "quiet_waiting",
    "approaching",
    "leaving",
    "solo",
    "group",
    "dwelling",
    "explore",
    "cooldown",
    "loud_active",
]

DWELL_SEC = 8.0
APPROACHING_HOLD_SEC = 6.0
COOLDOWN_SEC = 12.0
GROUP_PEOPLE_MIN = 3
LOUD_DB_MIN = 65.0


@dataclass
class PresenceAction:
    force_scene_id: Optional[str] = None
    reason: str = ""


@dataclass
class PresenceTracker:
    prev_people: int = 0
    stable_people: int = 0
    stable_since: float = field(default_factory=time.monotonic)
    mode: PresenceMode = "quiet_waiting"
    approaching_until: float = 0.0
    cooldown_until: float = 0.0
    explore_hotspot_id: Optional[str] = None
    dwell_sec: float = 0.0

    def snapshot(self, *, db: float, manual_lock: bool) -> dict[str, Any]:
        now = time.monotonic()
        self._refresh_mode(now, db=db, manual_lock=manual_lock)
        tier = self._crowd_tier(self.stable_people)
        return {
            "presence_mode": self.mode,
            "presence_dwell_sec": round(self.dwell_sec, 1),
            "explore_hotspot_id": self.explore_hotspot_id,
            "crowd_tier": tier,
        }

    def on_scene_execute(self, reason: str) -> None:
        hid = _hotspot_from_reason(reason)
        if hid:
            self.explore_hotspot_id = hid
            self.mode = "explore"

    def on_explore_end(self) -> None:
        self.explore_hotspot_id = None

    def begin_cooldown(self, now: Optional[float] = None) -> PresenceAction:
        t = now if now is not None else time.monotonic()
        self.cooldown_until = t + COOLDOWN_SEC
        self.explore_hotspot_id = None
        self.mode = "cooldown"
        return PresenceAction(force_scene_id="presence_cooldown", reason="visitor idle → cooldown")

    def on_sensor_update(self, people: int, db: float, *, manual_lock: bool) -> Optional[PresenceAction]:
        now = time.monotonic()
        if manual_lock:
            self.prev_people = people
            return None

        if self.cooldown_until > now:
            self.prev_people = people
            return None

        if self.cooldown_until > 0 and now >= self.cooldown_until:
            self.cooldown_until = 0.0

        action: Optional[PresenceAction] = None

        if self.approaching_until > now:
            self.mode = "approaching"
        elif people == 0 and self.prev_people >= 1:
            self.mode = "leaving"
            action = PresenceAction(force_scene_id="calm_gallery", reason="presence:leaving")
        elif self.prev_people == 0 and people >= 1:
            self.mode = "approaching"
            self.approaching_until = now + APPROACHING_HOLD_SEC
            self.stable_people = people
            self.stable_since = now
            action = PresenceAction(force_scene_id="approaching_invite", reason="presence:approaching")
        elif people != self.stable_people:
            self.stable_people = people
            self.stable_since = now
        else:
            self.dwell_sec = now - self.stable_since

        self.prev_people = people
        self._refresh_mode(now, db=db, manual_lock=False)

        if action is not None:
            return action

        if self.cooldown_until == 0 and self.approaching_until <= now:
            return None
        return None

    def cooldown_expired(self) -> bool:
        if self.cooldown_until <= 0:
            return False
        return time.monotonic() >= self.cooldown_until

    def end_cooldown(self) -> None:
        self.cooldown_until = 0.0
        self.mode = "quiet_waiting"

    def on_capture_lost(self) -> Optional[PresenceAction]:
        """웹캠·태블릿 영상이 끊기거나 sensor 발행이 멈췄을 때 — 즉시 대기."""
        was_waiting = self.mode == "quiet_waiting" and self.stable_people == 0 and self.prev_people == 0
        self.prev_people = 0
        self.stable_people = 0
        self.stable_since = time.monotonic()
        self.approaching_until = 0.0
        self.explore_hotspot_id = None
        self.dwell_sec = 0.0
        if self.cooldown_until > time.monotonic():
            return None
        self.cooldown_until = 0.0
        self.mode = "quiet_waiting"
        if was_waiting:
            return None
        return PresenceAction(force_scene_id="calm_gallery", reason="capture:offline")

    def _refresh_mode(self, now: float, *, db: float, manual_lock: bool) -> None:
        if manual_lock and self.explore_hotspot_id:
            self.mode = "explore"
            return
        if self.cooldown_until > now:
            self.mode = "cooldown"
            return
        if self.approaching_until > now:
            self.mode = "approaching"
            return

        people = self.stable_people
        self.dwell_sec = now - self.stable_since if people > 0 else 0.0

        if people == 0:
            self.mode = "quiet_waiting"
        elif db >= LOUD_DB_MIN:
            self.mode = "loud_active"
        elif self.dwell_sec >= DWELL_SEC and people >= 1:
            self.mode = "dwelling"
        elif people >= GROUP_PEOPLE_MIN:
            self.mode = "group"
        elif people == 1:
            self.mode = "solo"
        else:
            self.mode = "quiet_waiting"

    @staticmethod
    def _crowd_tier(people: int) -> str:
        if people == 0:
            return "none"
        if people == 1:
            return "solo"
        if people >= GROUP_PEOPLE_MIN:
            return "group"
        return "pair"


def _hotspot_from_reason(reason: str) -> Optional[str]:
    if "floor_hotspot:" not in reason:
        return None
    return reason.split("floor_hotspot:", 1)[-1].strip() or None
