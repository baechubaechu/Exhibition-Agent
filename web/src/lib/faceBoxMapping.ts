export type FaceBoxNorm = { x: number; y: number; w: number; h: number };

/** Vision·로컬 검출 공통 — object-fit:cover 기준 소스 좌표 → 화면 0~1 */
export function mapSourceFaceBoxesToCoverDisplay(
  boxes: Array<[number, number, number, number]>,
  sourceWidth: number,
  sourceHeight: number,
  renderWidth: number,
  renderHeight: number,
): FaceBoxNorm[] {
  if (!boxes.length || sourceWidth <= 0 || sourceHeight <= 0 || renderWidth <= 0 || renderHeight <= 0) {
    return [];
  }
  const coverScale = Math.max(renderWidth / sourceWidth, renderHeight / sourceHeight);
  const coveredWidth = sourceWidth * coverScale;
  const coveredHeight = sourceHeight * coverScale;
  const offsetX = (renderWidth - coveredWidth) / 2;
  const offsetY = (renderHeight - coveredHeight) / 2;

  return boxes
    .map(([x1, y1, x2, y2]) => {
      const sx1 = x1 * coverScale + offsetX;
      const sy1 = y1 * coverScale + offsetY;
      const sx2 = x2 * coverScale + offsetX;
      const sy2 = y2 * coverScale + offsetY;
      const w = (sx2 - sx1) / renderWidth;
      const h = (sy2 - sy1) / renderHeight;
      if (w <= 0 || h <= 0) return null;
      return {
        x: sx1 / renderWidth,
        y: sy1 / renderHeight,
        w,
        h,
      };
    })
    .filter((b): b is FaceBoxNorm => b !== null);
}

export function mapVisionFacesToCoverDisplay(
  faces: Array<{ box: [number, number, number, number] | number[] }> | undefined,
  sourceWidth: number,
  sourceHeight: number,
  renderWidth: number,
  renderHeight: number,
): FaceBoxNorm[] {
  if (!faces?.length) return [];
  const pixelBoxes: Array<[number, number, number, number]> = [];
  for (const f of faces) {
    const box = f.box;
    if (!box || box.length < 4) continue;
    pixelBoxes.push([box[0], box[1], box[2], box[3]]);
  }
  return mapSourceFaceBoxesToCoverDisplay(pixelBoxes, sourceWidth, sourceHeight, renderWidth, renderHeight);
}
