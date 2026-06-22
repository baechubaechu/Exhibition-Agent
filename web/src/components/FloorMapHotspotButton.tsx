"use client";

import type { FloorHotspot } from "@/lib/floorPlanHotspots";
import { hotspotMapLabel } from "@/lib/floorPlanHotspots";

type Props = {
  spot: FloorHotspot;
  active: boolean;
  busy: boolean;
  onClick: (spot: FloorHotspot) => void;
  onMapInteract?: () => void;
};

/** 평면도 구역 핀 — 색 점 + 영문 라벨 */
export function FloorMapHotspotButton({ spot, active, busy, onClick, onMapInteract }: Props) {
  const label = hotspotMapLabel(spot.id);
  const transferOffset = spot.id === "transfer";

  return (
    <button
      type="button"
      className={`xfloor-hotspot xfloor-hotspot--map xfloor-hotspot--${spot.id}${transferOffset ? " xfloor-hotspot--transfer" : ""}${active ? " is-active" : ""}`}
      data-zone={spot.targetZone}
      style={{ left: spot.x, top: spot.y }}
      disabled={busy}
      aria-label={`${label}, ${spot.targetZone === "zoneA" ? "Zone A" : "Zone B"}`}
      title={`${label} (${spot.targetZone})`}
      onClick={(e) => {
        e.stopPropagation();
        onMapInteract?.();
        if (active) return;
        onClick(spot);
      }}
    >
      <span className="xfloor-hotspot-dot" aria-hidden />
      <span className="xfloor-hotspot-label">{label}</span>
    </button>
  );
}
