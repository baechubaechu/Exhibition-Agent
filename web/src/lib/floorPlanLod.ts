/** SVG 도면 레이어 — lod-0·lod-1만 사용 (lod-2·3은 구 export 호환용, 항상 숨김) */
export const LOD_LAYER_IDS = ["lod-0", "lod-1", "lod-2", "lod-3"] as const;

export type LodLayerId = (typeof LOD_LAYER_IDS)[number];

/** UI·핫스팟 기준 3단계 (0=배치, 1=평면, 2=평면+핀) */
export const DISPLAY_LOD_MAX = 2;

/**
 * displayZoom = currentScale / fitScale (초기·초기화 ≈ TABLET_INITIAL_DISPLAY_ZOOM, 기본 1.5×)
 *
 * 0 — 배치도 (lod-0)
 * 1 — 평면도 (lod-1, lod-0 끔)
 * 2 — 평면도 유지 + 구역 핫스팟
 */
/** SVG — 배치→평면 (초기 1.5×는 배치, 2.5×부터 평면) */
export const SVG_SITE_FLOOR_ENTER = 2.5;

export function displayLodIndex(displayZoom: number): number {
  if (displayZoom < SVG_SITE_FLOOR_ENTER) return 0;
  if (displayZoom < 3) return 1;
  return 2;
}

export function maxVisibleLodIndex(displayZoom: number): number {
  return displayLodIndex(displayZoom);
}

export function isLodLayerVisible(layerIndex: number, activeLevel: number): boolean {
  if (layerIndex === 0) return activeLevel === 0;
  if (layerIndex === 1) return activeLevel >= 1;
  return false;
}

/** 핫스팟 — 단계 2 (displayZoom ≥ 3×) */
export const HOTSPOT_MIN_LOD_INDEX = 2;

/** PDF 2장 — 같은 A3, 1:3000 배치 vs 1:1000 평면 (축척비 3) */
export const DUAL_PDF_SCALE_RATIO = 3;

/** 평면 PDF — stage 중앙에 1/3 크기로 깔아두고 3× 줌과 맞춤 */
export const DUAL_PDF_FLOOR_STAGE_RATIO = 1 / DUAL_PDF_SCALE_RATIO;

/** 배치·평면 전환 — 3× (축척 1:3000→1:1000). 초기 1.5×는 배치도 */
export const DUAL_PDF_SITE_FLOOR_ENTER = 3;
export const DUAL_PDF_SITE_FLOOR_EXIT = 2.85;
export const DUAL_PDF_HOTSPOT_ZOOM = 3;

export function displayLodIndexDualPdf(displayZoom: number, onFloor: boolean): number {
  if (onFloor) {
    if (displayZoom < DUAL_PDF_SITE_FLOOR_EXIT) return 0;
    if (displayZoom >= DUAL_PDF_HOTSPOT_ZOOM) return 2;
    return 1;
  }
  if (displayZoom < DUAL_PDF_SITE_FLOOR_ENTER) return 0;
  if (displayZoom >= DUAL_PDF_HOTSPOT_ZOOM) return 2;
  return 1;
}

export function dualPdfHotspotsVisible(onFloor: boolean, displayZoom: number): boolean {
  return onFloor && displayZoom >= DUAL_PDF_HOTSPOT_ZOOM;
}

export function hotspotsVisibleAtDisplayZoom(displayZoom: number): boolean {
  return displayLodIndex(displayZoom) >= HOTSPOT_MIN_LOD_INDEX;
}

export function lodStatusLabel(level: number): string {
  if (level === 0) return "배치";
  if (level === 1) return "평면";
  return "평면 · 구역";
}

export function applyLodVisibility(
  layers: Partial<Record<LodLayerId, SVGGElement>>,
  displayZoom: number,
): number {
  const activeLevel = displayLodIndex(displayZoom);
  for (let i = 0; i < LOD_LAYER_IDS.length; i += 1) {
    const id = LOD_LAYER_IDS[i];
    const el = layers[id];
    if (!el) continue;
    el.style.display = isLodLayerVisible(i, activeLevel) ? "" : "none";
  }
  return activeLevel;
}
