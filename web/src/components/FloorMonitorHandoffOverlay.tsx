"use client";

import type { HotspotMeta } from "@/lib/floorPlanHotspots";
import { getMonitorZoneContent } from "@/lib/monitorZoneContent";

type Props = {
  spot: HotspotMeta | null;
  onDismiss: () => void;
};

/** 태블릿 — 핫스pot 선택 후 HDMI 모니터를 보도록 안내 */
export function FloorMonitorHandoffOverlay({ spot, onDismiss }: Props) {
  if (!spot) return null;

  const zone = getMonitorZoneContent(spot.id);
  const hint = zone?.handoffHintKo ?? "선택한 장소의 설명이 모니터에 표시됩니다.";

  return (
    <button
      type="button"
      className="xfloor-monitor-handoff"
      aria-label={`${spot.label} — 큰 화면 안내 닫기`}
      onClick={onDismiss}
    >
      <div className="xfloor-monitor-handoff-card">
        <p className="xfloor-monitor-handoff-kicker">{spot.label}</p>
        <p className="xfloor-monitor-handoff-title">큰 화면을 바라봐 주세요</p>
        <p className="xfloor-monitor-handoff-body">{hint}</p>
        <p className="xfloor-monitor-handoff-en">Please look at the main display.</p>
        <p className="xfloor-monitor-handoff-dismiss">우하단 초기화를 누르면 Live view로 돌아갑니다</p>
      </div>
    </button>
  );
}
