import type { PlanViewBox } from "@/lib/floorPlanSvgLoad";

export type LoadedPlanPdf = {
  viewBox: PlanViewBox;
  pageWidth: number;
  pageHeight: number;
};

export type PlanPdfRenderOpts = {
  maxPx?: number;
  intent?: "display" | "print";
  /** 렌더 타임아웃(ms). 초과 시 낮은 해상도로 재시도 */
  timeoutMs?: number;
};

type PdfJsModule = typeof import("pdfjs-dist");
type PdfDocument = Awaited<ReturnType<PdfJsModule["getDocument"]>["promise"]>;

/** 태블릿·Chrome canvas 상한 (초과 시 getContext/render 실패) */
export const PDF_MAX_CANVAS_AREA = 8_000_000;

let pdfJsModule: PdfJsModule | null = null;
const docByUrl = new Map<string, Promise<PdfDocument>>();

async function pdfJs(): Promise<PdfJsModule> {
  if (!pdfJsModule) {
    pdfJsModule = await import("pdfjs-dist");
    if (typeof window !== "undefined") {
      pdfJsModule.GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdf.worker.min.mjs`;
    } else {
      pdfJsModule.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    }
  }
  return pdfJsModule;
}

function pdfUrl(src: string): string {
  return typeof window !== "undefined" ? new URL(src, window.location.origin).href : src;
}

async function loadPdfDocument(src: string): Promise<PdfDocument> {
  const url = pdfUrl(src);
  let pending = docByUrl.get(url);
  if (!pending) {
    pending = pdfJs().then(({ getDocument }) =>
      getDocument({ url, disableAutoFetch: false, disableStream: false }).promise,
    );
    docByUrl.set(url, pending);
  }
  return pending;
}

export function resolvePdfRenderScale(
  pageW: number,
  pageH: number,
  pixelScale: number,
  maxPx: number,
): number {
  let scale = pixelScale;
  const longSide = Math.max(pageW, pageH);
  if (longSide * scale > maxPx) {
    scale = maxPx / longSide;
  }
  while (pageW * scale * (pageH * scale) > PDF_MAX_CANVAS_AREA && scale > 0.4) {
    scale *= 0.85;
  }
  return scale;
}

async function renderPdfPage(
  page: Awaited<ReturnType<PdfDocument["getPage"]>>,
  canvas: HTMLCanvasElement,
  pixelScale: number,
  maxPx: number,
  intent: "display" | "print",
  timeoutMs: number,
): Promise<LoadedPlanPdf> {
  const baseVp = page.getViewport({ scale: 1 });
  const scale = resolvePdfRenderScale(baseVp.width, baseVp.height, pixelScale, maxPx);
  const viewport = page.getViewport({ scale });

  canvas.width = viewport.width;
  canvas.height = viewport.height;
  canvas.style.width = `${baseVp.width}px`;
  canvas.style.height = `${baseVp.height}px`;

  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) {
    throw new Error(`canvas 2d 실패 (${viewport.width}×${viewport.height})`);
  }

  ctx.fillStyle = "#f5f3ef";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await Promise.race([
    page.render({ canvasContext: ctx, viewport, intent }).promise,
    new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error(`PDF 렌더 타임아웃 (${timeoutMs}ms)`)), timeoutMs);
    }),
  ]);

  return {
    viewBox: { x: 0, y: 0, width: baseVp.width, height: baseVp.height },
    pageWidth: baseVp.width,
    pageHeight: baseVp.height,
  };
}

/** PDF 1회 로드 + 캔버스 렌더. 실패·타임아웃 시 해상도를 낮춰 재시도 */
export async function loadAndRenderPlanPdf(
  src: string,
  canvas: HTMLCanvasElement,
  pixelScale: number,
  opts: PlanPdfRenderOpts = {},
): Promise<LoadedPlanPdf> {
  const { intent = "display", timeoutMs = 25_000 } = opts;
  let maxPx = opts.maxPx ?? 2800;
  const pdf = await loadPdfDocument(src);
  const page = await pdf.getPage(1);

  let lastError: unknown;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const shrink = 0.82 ** attempt;
    const tryScale = pixelScale * shrink;
    const tryMaxPx = Math.max(1200, Math.floor(maxPx * shrink));
    try {
      return await renderPdfPage(page, canvas, tryScale, tryMaxPx, intent, timeoutMs);
    } catch (e) {
      lastError = e;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/** 화면 canvas — 비트맵 상한 적용 */
export function blitPlanToDisplayCanvas(
  source: HTMLCanvasElement,
  target: HTMLCanvasElement | null,
  maxDisplayPx = 2800,
): void {
  if (!target) return;

  let dw = source.width;
  let dh = source.height;
  const longSide = Math.max(dw, dh);
  if (longSide > maxDisplayPx) {
    const ratio = maxDisplayPx / longSide;
    dw = Math.max(1, Math.floor(source.width * ratio));
    dh = Math.max(1, Math.floor(source.height * ratio));
  }

  target.width = dw;
  target.height = dh;
  target.style.width = "100%";
  target.style.height = "100%";

  const ctx = target.getContext("2d");
  if (!ctx) {
    throw new Error(`display canvas 2d 실패 (${dw}×${dh})`);
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#f5f3ef";
  ctx.fillRect(0, 0, dw, dh);
  ctx.drawImage(source, 0, 0, dw, dh);
}
