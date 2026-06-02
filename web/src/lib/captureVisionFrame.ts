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
