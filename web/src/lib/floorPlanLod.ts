export const LOD_LAYER_IDS = ["lod-0", "lod-1", "lod-2", "lod-3"] as const;

export type LodLayerId = (typeof LOD_LAYER_IDS)[number];

/** displayZoom = currentScale / fitScale (reset 시 ≈ 1.0) */
export function displayLodIndex(displayZoom: number): number {
  if (displayZoom < 1.5) return 0;
  if (displayZoom < 3) return 1;
  if (displayZoom < 6) return 2;
  return 3;
}

/** SVG 벡터 레이어 — 일체형 CAD export 는 줌과 무관하게 전부 표시 */
export function maxVisibleLodIndex(_displayZoom: number): number {
  return LOD_LAYER_IDS.length - 1;
}

/** 핫스팟 — LOD 2 (displayZoom ≥ 3×) 에서부터 */
export const HOTSPOT_MIN_LOD_INDEX = 2;

export function hotspotsVisibleAtDisplayZoom(displayZoom: number): boolean {
  return displayLodIndex(displayZoom) >= HOTSPOT_MIN_LOD_INDEX;
}

export function lodStatusLabel(maxIndex: number): string {
  return `LOD 0–${maxIndex}`;
}

export function applyLodVisibility(
  layers: Partial<Record<LodLayerId, SVGGElement>>,
  displayZoom: number,
): number {
  const maxIndex = maxVisibleLodIndex(displayZoom);
  for (let i = 0; i < LOD_LAYER_IDS.length; i += 1) {
    const id = LOD_LAYER_IDS[i];
    const el = layers[id];
    if (!el) continue;
    el.style.display = i <= maxIndex ? "" : "none";
  }
  return maxIndex;
}
