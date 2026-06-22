"use client";

import type { HotspotMeta } from "@/lib/floorPlanHotspots";
import { hotspotMapLabel } from "@/lib/floorPlanHotspots";
import { getMonitorZoneContent } from "@/lib/monitorZoneContent";

type Props = {
  spot: HotspotMeta | null;
  onDismiss: () => void;
};

/** 태블릿 — 핫스pot 선택 후 HDMI 모니터를 보도록 안내 */
export function FloorMonitorHandoffOverlay({ spot, onDismiss }: Props) {
  if (!spot) return null;

  const zone = getMonitorZoneContent(spot.id);
  const label = hotspotMapLabel(spot.id);
  const hint = zone?.leadKo ?? "선택한 장소의 설명이 모니터에 표시됩니다.";

  return (
    <button
      type="button"
      className="xfloor-monitor-handoff"
      aria-label={`${label} — 큰 화면 안내 닫기`}
      onPointerDown={(e) => {
        e.stopPropagation();
        onDismiss();
      }}
    >
      <div className="xfloor-monitor-handoff-card">
        <p className="xfloor-monitor-handoff-kicker">{label}</p>
        <p className="xfloor-monitor-handoff-title">큰 화면을 바라봐 주세요</p>
        <p className="xfloor-monitor-handoff-body">{hint}</p>
        <p className="xfloor-monitor-handoff-en">Please look at the main display.</p>
        <p className="xfloor-monitor-handoff-dismiss">탭하여 닫기</p>
      </div>
      <p className="xfloor-monitor-handoff-reset" aria-hidden="true">
        <span className="xfloor-monitor-handoff-reset-kicker">Live view로 돌아가기</span>
        <span className="xfloor-monitor-handoff-reset-action">
          우하단 <strong>초기화</strong> 버튼
        </span>
        <span className="xfloor-monitor-handoff-reset-en">Tap Reset (bottom right)</span>
      </p>
    </button>
  );
}
