/** 브라우저 로컬 얼굴 검출 — 전시장 오탐(타인 패널·화면) 줄이기용 튜닝 */

function envRatio(name: string, fallback: number, min: number, max: number): number {
  const raw = typeof process !== "undefined" ? process.env[name] : undefined;
  if (!raw?.trim()) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * 프레임 대비 최소 얼굴 면적 (0~1).
 * 0.012 ≈ 화면의 1.2% — 멀리 있는 작은 얼굴·화면 속 인물 제외.
 */
export const FACE_MIN_AREA_RATIO = envRatio("NEXT_PUBLIC_FACE_MIN_AREA_RATIO", 0.012, 0.002, 0.08);

/** MediaPipe BlazeFace minDetectionConfidence (0~1). 높을수록 보수적. */
export const FACE_MIN_DETECTION_CONF = envRatio("NEXT_PUBLIC_FACE_MIN_DETECTION_CONF", 0.62, 0.2, 0.95);

/**
 * 프레임 대비 최대 얼굴 면적 (0~1).
 * 패널 여러 장이 한 덩어리로 큰 얼굴처럼 잡히는 오탐 차단.
 */
export const FACE_MAX_AREA_RATIO = envRatio("NEXT_PUBLIC_FACE_MAX_AREA_RATIO", 0.22, 0.08, 0.55);

/** 박스 가로÷세로 — 실제 얼굴은 대체로 0.65~1.35, 가로로 긴 패널 벽은 1.6+ */
export const FACE_ASPECT_MIN = envRatio("NEXT_PUBLIC_FACE_ASPECT_MIN", 0.62, 0.4, 1);
export const FACE_ASPECT_MAX = envRatio("NEXT_PUBLIC_FACE_ASPECT_MAX", 1.38, 1, 2.5);

/** 이 면적 이상이면 BlazeFace 키포인트(눈·코·입) 배치까지 검사 */
export const FACE_KEYPOINT_CHECK_MIN_AREA = envRatio(
  "NEXT_PUBLIC_FACE_KEYPOINT_CHECK_MIN_AREA",
  0.06,
  0.02,
  0.2,
);

/** cover 화면 기준 인원 집계 — 가운데 밴드(0~1, 작을수록 좁음) */
export const FACE_CENTER_FOCUS_WIDTH = envRatio("NEXT_PUBLIC_FACE_CENTER_FOCUS_WIDTH", 0.62, 0.35, 1);
export const FACE_CENTER_FOCUS_HEIGHT = envRatio("NEXT_PUBLIC_FACE_CENTER_FOCUS_HEIGHT", 0.72, 0.35, 1);
