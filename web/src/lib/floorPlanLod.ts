export const LOD_LAYER_IDS = ["lod-0", "lod-1", "lod-2", "lod-3"] as const;

export type LodLayerId = (typeof LOD_LAYER_IDS)[number];

/** displayZoom = currentScale / fitScale (reset 시 ≈ 1.0) — 벡터 SVG는 줌과 무관하게 전 레이어 표시 */
export function maxVisibleLodIndex(_displayZoom: number): number {
  return LOD_LAYER_IDS.length - 1;
}

export function hotspotsVisibleAtDisplayZoom(_displayZoom: number): boolean {
  return true;
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
