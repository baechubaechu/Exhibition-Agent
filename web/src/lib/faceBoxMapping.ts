export type FaceBoxNorm = { x: number; y: number; w: number; h: number };

export type CoverSourceRect = { x: number; y: number; width: number; height: number };

/** object-fit:cover 로 화면에 실제로 보이는 소스 프레임 영역(픽셀) */
export function getCoverVisibleSourceRect(
  sourceWidth: number,
  sourceHeight: number,
  renderWidth: number,
  renderHeight: number,
): CoverSourceRect {
  if (sourceWidth <= 0 || sourceHeight <= 0 || renderWidth <= 0 || renderHeight <= 0) {
    return { x: 0, y: 0, width: sourceWidth, height: sourceHeight };
  }
  const coverScale = Math.max(renderWidth / sourceWidth, renderHeight / sourceHeight);
  const coveredWidth = sourceWidth * coverScale;
  const coveredHeight = sourceHeight * coverScale;
  const offsetX = (renderWidth - coveredWidth) / 2;
  const offsetY = (renderHeight - coveredHeight) / 2;
  const x1 = Math.max(0, (0 - offsetX) / coverScale);
  const y1 = Math.max(0, (0 - offsetY) / coverScale);
  const x2 = Math.min(sourceWidth, (renderWidth - offsetX) / coverScale);
  const y2 = Math.min(sourceHeight, (renderHeight - offsetY) / coverScale);
  return {
    x: x1,
    y: y1,
    width: Math.max(0, x2 - x1),
    height: Math.max(0, y2 - y1),
  };
}

/** 화면에 보이는 영역 안에서 관람객(정면) 위주 — 가운데 밴드 */
export function getCenterFocusRect(
  rect: CoverSourceRect,
  focusWidth = 0.62,
  focusHeight = 0.72,
): CoverSourceRect {
  const mx = rect.width * (1 - focusWidth) / 2;
  const my = rect.height * (1 - focusHeight) / 2;
  return {
    x: rect.x + mx,
    y: rect.y + my,
    width: rect.width * focusWidth,
    height: rect.height * focusHeight,
  };
}

function boxCenter(box: [number, number, number, number]): { cx: number; cy: number } {
  return { cx: (box[0] + box[2]) / 2, cy: (box[1] + box[3]) / 2 };
}

function centerInRect(cx: number, cy: number, rect: CoverSourceRect): boolean {
  return cx >= rect.x && cx <= rect.x + rect.width && cy >= rect.y && cy <= rect.y + rect.height;
}

function overlapRatio(box: [number, number, number, number], rect: CoverSourceRect): number {
  const ix1 = Math.max(box[0], rect.x);
  const iy1 = Math.max(box[1], rect.y);
  const ix2 = Math.min(box[2], rect.x + rect.width);
  const iy2 = Math.min(box[3], rect.y + rect.height);
  const inter = Math.max(0, ix2 - ix1) * Math.max(0, iy2 - iy1);
  const area = Math.max(1, (box[2] - box[0]) * (box[3] - box[1]));
  return inter / area;
}

/** cover 크롭 밖·옆사람 — 화면에 안 보이는 검출 제거 */
export function filterSourceFaceBoxesForCoverDisplay(
  boxes: Array<[number, number, number, number]>,
  sourceWidth: number,
  sourceHeight: number,
  renderWidth: number,
  renderHeight: number,
  opts?: {
    minVisibleOverlap?: number;
    centerFocus?: boolean;
    focusWidth?: number;
    focusHeight?: number;
  },
): Array<[number, number, number, number]> {
  if (!boxes.length) return [];
  const visible = getCoverVisibleSourceRect(sourceWidth, sourceHeight, renderWidth, renderHeight);
  const focus = opts?.centerFocus
    ? getCenterFocusRect(visible, opts.focusWidth, opts.focusHeight)
    : visible;
  const minOverlap = opts?.minVisibleOverlap ?? 0.25;
  return boxes.filter((box) => {
    if (overlapRatio(box, visible) < minOverlap) return false;
    if (opts?.centerFocus) {
      const { cx, cy } = boxCenter(box);
      if (!centerInRect(cx, cy, focus)) return false;
    }
    return true;
  });
}

export function clipNormFaceBox(box: FaceBoxNorm): FaceBoxNorm | null {
  const x2 = box.x + box.w;
  const y2 = box.y + box.h;
  const cx1 = Math.max(0, box.x);
  const cy1 = Math.max(0, box.y);
  const cx2 = Math.min(1, x2);
  const cy2 = Math.min(1, y2);
  const w = cx2 - cx1;
  const h = cy2 - cy1;
  if (w <= 0.01 || h <= 0.01) return null;
  return { x: cx1, y: cy1, w, h };
}

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
