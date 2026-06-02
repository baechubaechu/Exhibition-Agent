export type FaceBox = { x: number; y: number; w: number; h: number };

/** 프레임마다 target 쪽으로 보간 — 박스 점프 완화 */
export function lerpFaceBoxes(current: FaceBox[], target: FaceBox[], alpha: number): FaceBox[] {
  if (target.length === 0) return [];
  if (current.length !== target.length) return target;
  return target.map((t, i) => {
    const c = current[i] ?? t;
    return {
      x: c.x + (t.x - c.x) * alpha,
      y: c.y + (t.y - c.y) * alpha,
      w: c.w + (t.w - c.w) * alpha,
      h: c.h + (t.h - c.h) * alpha,
    };
  });
}

export function faceBoxesNearlyEqual(a: FaceBox[], b: FaceBox[], eps = 0.0025): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (
      Math.abs(x.x - y.x) > eps ||
      Math.abs(x.y - y.y) > eps ||
      Math.abs(x.w - y.w) > eps ||
      Math.abs(x.h - y.h) > eps
    ) {
      return false;
    }
  }
  return true;
}
