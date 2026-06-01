/** poll = JPEG 폴링(기본), stream = MJPEG multipart 스트림(모니터 지연↓) */
export type ExhibitPreviewMode = "poll" | "stream";

export const EXHIBIT_PREVIEW_MODE: ExhibitPreviewMode =
  process.env.NEXT_PUBLIC_EXHIBIT_PREVIEW_MODE === "stream" ? "stream" : "poll";

export const EXHIBIT_PREVIEW_STREAM_URL = "/api/exhibit/preview-stream";

export const EXHIBIT_PREVIEW_STREAM = EXHIBIT_PREVIEW_MODE === "stream";

const rawStreamW = process.env.NEXT_PUBLIC_EXHIBIT_PREVIEW_STREAM_MAX_WIDTH;
const parsedW = rawStreamW !== undefined && rawStreamW !== "" ? Number(rawStreamW) : 400;

/** 스트림 모드 JPEG 가로 상한 — 낮을수록 Wi‑Fi·인코딩 빠름 */
export const EXHIBIT_PREVIEW_STREAM_MAX_WIDTH =
  EXHIBIT_PREVIEW_STREAM && Number.isFinite(parsedW)
    ? Math.min(640, Math.max(320, Math.round(parsedW)))
    : 640;
