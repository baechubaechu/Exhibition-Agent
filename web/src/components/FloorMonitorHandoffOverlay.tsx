"use client";

import type { HotspotMeta } from "@/lib/floorPlanHotspots";

type Props = {
  spot: HotspotMeta | null;
  onDismiss: () => void;
};

/** 태블릿 — 핫스pot 선택 후 HDMI 모니터를 보도록 안내 */
export function FloorMonitorHandoffOverlay({ spot, onDismiss }: Props) {
  if (!spot) return null;

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
        <p className="xfloor-monitor-handoff-body">선택한 장소의 설명이 모니터에 표시됩니다.</p>
        <p className="xfloor-monitor-handoff-en">Please look at the main display.</p>
        <p className="xfloor-monitor-handoff-dismiss">화면을 누르면 도면으로 돌아갑니다</p>
      </div>
    </button>
  );
}
