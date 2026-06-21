export type FaceBox = { x: number; y: number; w: number; h: number };

/**
 * 프레임마다 target 쪽으로 보간 — 작은 흔들림은 완화, 큰 이동은 즉시 스냅(추적 지연 제거).
 * snapDist: 정규화 좌표(0~1) 기준 이 값 이상 움직이면 보간 없이 바로 target 으로 점프.
 */
export function lerpFaceBoxes(
  current: FaceBox[],
  target: FaceBox[],
  alpha: number,
  snapDist = 0.1,
): FaceBox[] {
  if (target.length === 0) return [];
  if (current.length !== target.length) return target;
  return target.map((t, i) => {
    const c = current[i] ?? t;
    const dx = t.x - c.x;
    const dy = t.y - c.y;
    if (
      Math.hypot(dx, dy) > snapDist ||
      Math.abs(t.w - c.w) > snapDist ||
      Math.abs(t.h - c.h) > snapDist
    ) {
      return t;
    }
    return {
      x: c.x + dx * alpha,
      y: c.y + dy * alpha,
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
