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

/** 태블릿 평면도 핀 — UI 표시용 (영문) */
export const HOTSPOT_MAP_LABELS = {
  transfer: "Transfer Route",
  walk: "Walking Route",
  xspace: "X-tra Space",
} as const;

export type HotspotMapId = keyof typeof HOTSPOT_MAP_LABELS;

export function hotspotMapLabel(id: string): string {
  return HOTSPOT_MAP_LABELS[id as HotspotMapId] ?? id;
}

/** 도면 viewBox 기준 핀 — 3구역 (Transfer · Walking · X-tra Space) */
const HOTSPOT_DEFS: HotspotDef[] = [
  {
    id: "transfer",
    label: HOTSPOT_MAP_LABELS.transfer,
    sceneId: "floor_pin_1",
    targetZone: "zoneB",
    topPct: 53,
    leftPct: 50,
  },
  {
    id: "walk",
    label: HOTSPOT_MAP_LABELS.walk,
    sceneId: "floor_pin_3",
    targetZone: "zoneB",
    topPct: 45,
    leftPct: 72,
  },
  {
    id: "xspace",
    label: HOTSPOT_MAP_LABELS.xspace,
    sceneId: "floor_pin_2",
    targetZone: "zoneA",
    topPct: 50,
    leftPct: 35,
  },
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
