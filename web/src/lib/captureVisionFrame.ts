import { getCoverVisibleSourceRect, type CoverSourceRect } from "@/lib/faceBoxMapping";

export type VisionCropFrame = {
  width: number;
  height: number;
  crop: CoverSourceRect;
};

function renderSize(video: HTMLVideoElement): { width: number; height: number } {
  const rw = video.clientWidth > 0 ? video.clientWidth : video.videoWidth;
  const rh = video.clientHeight > 0 ? video.clientHeight : video.videoHeight;
  return { width: rw, height: rh };
}

/** 모니터 cover 와 동일한 소스 크롭 — Vision 이 화면 밖 옆사람을 보지 않게 */
export function getCoverCropVisionFrame(
  video: HTMLVideoElement,
  maxEdge = 1280,
): VisionCropFrame | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (vw <= 0 || vh <= 0) return null;
  const { width: rw, height: rh } = renderSize(video);
  const crop = getCoverVisibleSourceRect(vw, vh, rw, rh);
  if (crop.width <= 0 || crop.height <= 0) return null;
  const scale = Math.min(1, maxEdge / Math.max(crop.width, crop.height));
  return {
    width: Math.max(1, Math.round(crop.width * scale)),
    height: Math.max(1, Math.round(crop.height * scale)),
    crop,
  };
}

export async function captureVisionFrameCoverCropBlob(
  video: HTMLVideoElement,
  maxEdge = 1280,
  quality = 0.82,
): Promise<{ blob: Blob; frame: VisionCropFrame } | null> {
  const frame = getCoverCropVisionFrame(video, maxEdge);
  if (!frame) return null;
  const { crop } = frame;
  const canvas = document.createElement("canvas");
  canvas.width = frame.width;
  canvas.height = frame.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, crop.x, crop.y, crop.width, crop.height, 0, 0, frame.width, frame.height);
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/jpeg", quality);
  });
  if (!blob || blob.size < 512) return null;
  return { blob, frame };
}

/** Vision 응답(크롭 JPEG 좌표) → 원본 video 픽셀 좌표 */
export function mapVisionCropBoxesToFullVideo(
  faces: Array<{ box: [number, number, number, number] | number[] }> | undefined,
  frame: VisionCropFrame,
): Array<[number, number, number, number]> {
  if (!faces?.length) return [];
  const scaleX = frame.crop.width / frame.width;
  const scaleY = frame.crop.height / frame.height;
  const out: Array<[number, number, number, number]> = [];
  for (const f of faces) {
    const box = f.box;
    if (!box || box.length < 4) continue;
    out.push([
      frame.crop.x + box[0] * scaleX,
      frame.crop.y + box[1] * scaleY,
      frame.crop.x + box[2] * scaleX,
      frame.crop.y + box[3] * scaleY,
    ]);
  }
  return out;
}

/** 웹캠/비디오에서 Vision API용 JPEG Blob (긴 변 최대 maxEdge px). */
export function getVisionFrameSize(
  video: HTMLVideoElement,
  maxEdge = 1280,
): { width: number; height: number } | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (vw <= 0 || vh <= 0) return null;
  const scale = Math.min(1, maxEdge / Math.max(vw, vh));
  return {
    width: Math.max(1, Math.round(vw * scale)),
    height: Math.max(1, Math.round(vh * scale)),
  };
}

export async function captureVisionFrameBlob(
  video: HTMLVideoElement,
  maxEdge = 1280,
  quality = 0.82,
): Promise<Blob | null> {
  const size = getVisionFrameSize(video, maxEdge);
  if (!size) return null;
  const { width: w, height: h } = size;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, w, h);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/jpeg", quality);
  });
  if (!blob || blob.size < 512) return null;
  return blob;
}

export function parseVisionApiErrorBody(text: string): string {
  try {
    const j = JSON.parse(text) as { error?: string };
    if (typeof j.error === "string" && j.error.trim()) return j.error.trim();
  } catch {
    /* plain text */
  }
  const trimmed = text.trim();
  return trimmed.length > 0 && trimmed.length < 400 ? trimmed : "Vision API 오류";
}
