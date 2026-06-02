import type { PlanViewBox } from "@/lib/floorPlanSvgLoad";

export type FloorHotspot = {
  id: string;
  label: string;
  sceneId: string;
  targetZone: "zoneA" | "zoneB";
  /** viewBox 좌표 (중심) */
  x: number;
  y: number;
};

type HotspotDef = {
  id: string;
  label: string;
  sceneId: string;
  targetZone: "zoneA" | "zoneB";
  topPct: number;
  leftPct: number;
};

/** 도면 viewBox 기준 핀 — 3구역 (환승 · 산책 · X-tra Space) */
const HOTSPOT_DEFS: HotspotDef[] = [
  { id: "transfer", label: "환승동선", sceneId: "floor_pin_1", targetZone: "zoneB", topPct: 53, leftPct: 50 },
  { id: "walk", label: "산책동선", sceneId: "floor_pin_3", targetZone: "zoneB", topPct: 45, leftPct: 72 },
  { id: "xspace", label: "X-tra Space", sceneId: "floor_pin_2", targetZone: "zoneA", topPct: 50, leftPct: 35 },
];

export function hotspotsForViewBox(viewBox: PlanViewBox): FloorHotspot[] {
  return HOTSPOT_DEFS.map(({ topPct, leftPct, ...rest }) => ({
    ...rest,
    x: viewBox.x + (leftPct / 100) * viewBox.width,
    y: viewBox.y + (topPct / 100) * viewBox.height,
  }));
}

export type HotspotMeta = Pick<FloorHotspot, "id" | "label" | "sceneId" | "targetZone">;

export function getHotspotMetaById(id: string | null | undefined): HotspotMeta | null {
  if (!id) return null;
  const d = HOTSPOT_DEFS.find((h) => h.id === id);
  if (!d) return null;
  return { id: d.id, label: d.label, sceneId: d.sceneId, targetZone: d.targetZone };
}

/** 도면 핀 패널 — 씬 선택 목록 (sceneId 중복 제거) */
export const FLOOR_PIN_SCENE_OPTIONS: { id: string; label: string }[] = (() => {
  const seen = new Set<string>();
  const out: { id: string; label: string }[] = [];
  for (const d of HOTSPOT_DEFS) {
    if (seen.has(d.sceneId)) continue;
    seen.add(d.sceneId);
    out.push({ id: d.sceneId, label: `${d.label} · ${d.sceneId}` });
  }
  return out;
})();
