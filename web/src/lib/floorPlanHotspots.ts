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

/** 도면 viewBox 기준 핀 위치 — SVG 교체 시 숫자만 조정 */
const HOTSPOT_DEFS: HotspotDef[] = [
  { id: "h1", label: "전실", sceneId: "floor_pin_1", targetZone: "zoneA", topPct: 14, leftPct: 78 },
  { id: "h2", label: "코어", sceneId: "floor_pin_2", targetZone: "zoneA", topPct: 38, leftPct: 52 },
  { id: "h3", label: "동선", sceneId: "floor_pin_3", targetZone: "zoneB", topPct: 22, leftPct: 28 },
  { id: "h4", label: "후면", sceneId: "floor_pin_4", targetZone: "zoneB", topPct: 58, leftPct: 72 },
  { id: "h5", label: "코너", sceneId: "floor_pin_5", targetZone: "zoneA", topPct: 62, leftPct: 22 },
  { id: "h6", label: "여백", sceneId: "floor_pin_6", targetZone: "zoneB", topPct: 78, leftPct: 48 },
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
