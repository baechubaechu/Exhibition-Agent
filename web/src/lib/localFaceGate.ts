/** 브라우저 로컬 얼굴 검출 — Google Vision 호출 전 게이트·오버레이용 */

import { FACE_MIN_AREA_RATIO, FACE_MIN_DETECTION_CONF } from "@/lib/exhibitFaceDetectionConfig";
import { acceptFaceBoundingBox, faceBoxAreaRatio } from "@/lib/faceBoxFilter";

export type LocalFaceHit = {
  areaRatio: number;
  /** video 프레임 픽셀 좌표 [x1,y1,x2,y2] */
  boxPx: [number, number, number, number];
};

export type LocalFaceGateResult = {
  faces: LocalFaceHit[];
  maxAreaRatio: number;
};

type FaceDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ boundingBox: DOMRectReadOnly }>>;
};

const GATE_MIN_AREA = FACE_MIN_AREA_RATIO;
/** 핫스팟 오프라인 — public/mediapipe (npm run copy:mediapipe) */
const MEDIAPIPE_WASM = "/mediapipe/wasm";
const MEDIAPIPE_MODEL = "/mediapipe/models/blaze_face_short_range.tflite";

/** MediaPipe WASM — Next dev overlay에 INFO 로그가 에러로 뜨는 것 방지 */
const WASM_NOISE_RE = /TensorFlow Lite|XNNPACK|Created .* delegate|inference/i;

let mpDetector: { detectForVideo: (video: HTMLVideoElement, ts: number) => { detections: Array<{ boundingBox?: { width: number; height: number } }> } } | null =
  null;
let chromeDetector: FaceDetectorLike | null = null;
let initPromise: Promise<"mediapipe" | "chrome" | "none"> | null = null;
let lastMode: "mediapipe" | "chrome" | "none" = "none";

function boxAreaRatio(w: number, h: number, frameW: number, frameH: number): number {
  return faceBoxAreaRatio(w, h, frameW, frameH);
}

type MpDetection = {
  boundingBox?: { width: number; height: number; originX?: number; originY?: number };
  categories?: Array<{ score?: number }>;
  keypoints?: Array<{ x: number; y: number }>;
};

function pushDetectionHit(
  hits: LocalFaceHit[],
  bb: { width: number; height: number; originX?: number; originY?: number },
  detection: MpDetection,
  vw: number,
  vh: number,
) {
  const score = detection.categories?.[0]?.score;
  if (typeof score === "number" && score < FACE_MIN_DETECTION_CONF) return;

  const kps = detection.keypoints?.filter((k) => Number.isFinite(k.x) && Number.isFinite(k.y));
  const ox = bb.originX != null ? Number(bb.originX) : 0;
  const oy = bb.originY != null ? Number(bb.originY) : 0;
  if (!acceptFaceBoundingBox(bb.width, bb.height, vw, vh, kps, ox, oy)) return;

  const areaRatio = boxAreaRatio(bb.width, bb.height, vw, vh);
  if (areaRatio < GATE_MIN_AREA) return;

  hits.push({
    areaRatio,
    boxPx: [ox, oy, ox + bb.width, oy + bb.height],
  });
}

function isWasmNoise(args: unknown[]): boolean {
  return WASM_NOISE_RE.test(args.map(String).join(" "));
}

function withSuppressedWasmLogs<T>(fn: () => T): T {
  const prevError = console.error;
  const prevWarn = console.warn;
  const prevInfo = console.info;
  console.error = (...args: unknown[]) => {
    if (!isWasmNoise(args)) prevError.apply(console, args);
  };
  console.warn = (...args: unknown[]) => {
    if (!isWasmNoise(args)) prevWarn.apply(console, args);
  };
  console.info = (...args: unknown[]) => {
    if (!isWasmNoise(args)) prevInfo.apply(console, args);
  };
  try {
    return fn();
  } finally {
    console.error = prevError;
    console.warn = prevWarn;
    console.info = prevInfo;
  }
}

async function withSuppressedWasmLogsAsync<T>(fn: () => Promise<T>): Promise<T> {
  const prevError = console.error;
  const prevWarn = console.warn;
  const prevInfo = console.info;
  console.error = (...args: unknown[]) => {
    if (!isWasmNoise(args)) prevError.apply(console, args);
  };
  console.warn = (...args: unknown[]) => {
    if (!isWasmNoise(args)) prevWarn.apply(console, args);
  };
  console.info = (...args: unknown[]) => {
    if (!isWasmNoise(args)) prevInfo.apply(console, args);
  };
  try {
    return await fn();
  } finally {
    console.error = prevError;
    console.warn = prevWarn;
    console.info = prevInfo;
  }
}

async function tryChromeFaceDetector(): Promise<FaceDetectorLike | null> {
  if (typeof window === "undefined") return null;
  const Det = (window as Window & { FaceDetector?: new (opts?: { maxDetectedFaces?: number; fastMode?: boolean }) => FaceDetectorLike }).FaceDetector;
  if (!Det) return null;
  try {
    const det = new Det({ maxDetectedFaces: 8, fastMode: false });
    await det.detect(document.createElement("canvas"));
    return det;
  } catch {
    return null;
  }
}

async function tryMediaPipeFaceDetector(): Promise<typeof mpDetector> {
  return withSuppressedWasmLogsAsync(async () => {
    try {
      const { FaceDetector, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM);
      return await FaceDetector.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MEDIAPIPE_MODEL },
        runningMode: "VIDEO",
        minDetectionConfidence: FACE_MIN_DETECTION_CONF,
      });
    } catch {
      return null;
    }
  });
}

/** lazy init — Chrome FaceDetector 우선(데스크톱), 없으면 MediaPipe */
export async function initLocalFaceGate(): Promise<"mediapipe" | "chrome" | "none"> {
  if (lastMode !== "none") return lastMode;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    // MediaPipe 를 우선 사용한다. (동기·오프라인 번들·안정)
    // Chrome FaceDetector 는 deprecated 이고 detect() 가 멈추면 스캔 루프가 영구 잠기는
    // 사례가 있어, MediaPipe 로딩 실패 시의 폴백으로만 둔다.
    mpDetector = await tryMediaPipeFaceDetector();
    if (mpDetector) {
      lastMode = "mediapipe";
      return lastMode;
    }
    chromeDetector = await tryChromeFaceDetector();
    if (chromeDetector) {
      lastMode = "chrome";
      return lastMode;
    }
    lastMode = "none";
    return lastMode;
  })();

  return initPromise;
}

export function localFaceGateMode(): "mediapipe" | "chrome" | "none" {
  return lastMode;
}

export function scanLocalFaces(video: HTMLVideoElement, timestampMs: number): LocalFaceGateResult {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (vw <= 0 || vh <= 0) return { faces: [], maxAreaRatio: 0 };

  const hits: LocalFaceHit[] = [];

  if (mpDetector) {
    const out = withSuppressedWasmLogs(() => mpDetector!.detectForVideo(video, timestampMs));
    for (const d of out.detections) {
      const bb = d.boundingBox;
      if (!bb) continue;
      pushDetectionHit(hits, bb, d as MpDetection, vw, vh);
    }
  } else if (chromeDetector) {
    /* Chrome FaceDetector.detect 는 async — 동기 scan 에서는 스킵; 별도 async 경로 사용 */
    return { faces: [], maxAreaRatio: 0 };
  }

  let maxAreaRatio = 0;
  for (const f of hits) {
    if (f.areaRatio > maxAreaRatio) maxAreaRatio = f.areaRatio;
  }
  return { faces: hits, maxAreaRatio };
}

/** Chrome FaceDetector 전용 (async) */
export async function scanLocalFacesAsync(video: HTMLVideoElement): Promise<LocalFaceGateResult> {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (vw <= 0 || vh <= 0) return { faces: [], maxAreaRatio: 0 };

  if (mpDetector) {
    return scanLocalFaces(video, performance.now());
  }

  if (!chromeDetector) return { faces: [], maxAreaRatio: 0 };

  try {
    const raw = await chromeDetector.detect(video);
    const hits: LocalFaceHit[] = [];
    for (const f of raw) {
      const bb = f.boundingBox;
      if (!acceptFaceBoundingBox(bb.width, bb.height, vw, vh)) continue;
      const areaRatio = boxAreaRatio(bb.width, bb.height, vw, vh);
      if (areaRatio >= GATE_MIN_AREA) {
        hits.push({
          areaRatio,
          boxPx: [bb.x, bb.y, bb.x + bb.width, bb.y + bb.height],
        });
      }
    }
    let maxAreaRatio = 0;
    for (const h of hits) {
      if (h.areaRatio > maxAreaRatio) maxAreaRatio = h.areaRatio;
    }
    return { faces: hits, maxAreaRatio };
  } catch {
    return { faces: [], maxAreaRatio: 0 };
  }
}

export function localFaceGateThreshold(): number {
  return GATE_MIN_AREA;
}
