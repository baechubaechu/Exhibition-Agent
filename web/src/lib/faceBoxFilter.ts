import {
  FACE_ASPECT_MAX,
  FACE_ASPECT_MIN,
  FACE_KEYPOINT_CHECK_MIN_AREA,
  FACE_MAX_AREA_RATIO,
  FACE_MIN_AREA_RATIO,
} from "@/lib/exhibitFaceDetectionConfig";

type Keypoint = { x: number; y: number };

function resolveKeypoints(
  kps: Keypoint[],
  originX: number,
  originY: number,
  boxW: number,
  boxH: number,
): Keypoint[] {
  if (kps.length === 0) return kps;
  const maxX = Math.max(...kps.map((k) => k.x));
  const maxY = Math.max(...kps.map((k) => k.y));
  if (maxX <= 1.5 && maxY <= 1.5) {
    return kps.map((k) => ({ x: originX + k.x * boxW, y: originY + k.y * boxH }));
  }
  return kps;
}

/** BlazeFace: 0=오른쪽 눈, 1=왼쪽 눈, 2=코, 3=입, 4=오른쪽 귀, 5=왼쪽 귀 */
function keypointsLookLikeFace(
  kps: Keypoint[],
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): boolean {
  if (kps.length < 4) return false;

  const w = x2 - x1;
  const h = y2 - y1;
  if (w <= 0 || h <= 0) return false;

  const rightEye = kps[0];
  const leftEye = kps[1];
  const nose = kps[2];
  const mouth = kps[3];
  if (!rightEye || !leftEye || !nose || !mouth) return false;

  const eyeDist = Math.hypot(leftEye.x - rightEye.x, leftEye.y - rightEye.y);
  const eyeToWidth = eyeDist / w;
  if (eyeToWidth < 0.2 || eyeToWidth > 0.58) return false;

  const eyeMidY = (rightEye.y + leftEye.y) / 2;
  const eyeMidX = (rightEye.x + leftEye.x) / 2;
  if (nose.y < eyeMidY - h * 0.03) return false;
  if (mouth.y < nose.y - h * 0.03) return false;
  if (Math.abs(nose.x - eyeMidX) > w * 0.24) return false;

  const mouthToNose = mouth.y - nose.y;
  if (mouthToNose < h * 0.04 || mouthToNose > h * 0.45) return false;

  return true;
}

export function acceptFaceBoundingBox(
  width: number,
  height: number,
  frameW: number,
  frameH: number,
  keypoints?: Keypoint[],
  originX = 0,
  originY = 0,
): boolean {
  if (width <= 0 || height <= 0 || frameW <= 0 || frameH <= 0) return false;

  const areaRatio = (width * height) / (frameW * frameH);
  if (areaRatio < FACE_MIN_AREA_RATIO || areaRatio > FACE_MAX_AREA_RATIO) return false;

  const aspect = width / height;
  if (aspect < FACE_ASPECT_MIN || aspect > FACE_ASPECT_MAX) return false;

  const x1 = originX;
  const y1 = originY;
  const x2 = originX + width;
  const y2 = originY + height;

  const resolved = keypoints?.length
    ? resolveKeypoints(keypoints, originX, originY, width, height)
    : undefined;

  if (areaRatio >= FACE_KEYPOINT_CHECK_MIN_AREA) {
    if (resolved && resolved.length >= 4) {
      return keypointsLookLikeFace(resolved, x1, y1, x2, y2);
    }
    return false;
  }

  if (resolved && resolved.length >= 4) {
    return keypointsLookLikeFace(resolved, x1, y1, x2, y2);
  }

  return true;
}

export function faceBoxAreaRatio(width: number, height: number, frameW: number, frameH: number): number {
  if (frameW <= 0 || frameH <= 0) return 0;
  return Math.max(0, Math.min(1, (width * height) / (frameW * frameH)));
}
