import type { PlanViewBox } from "@/lib/floorPlanSvgLoad";

export type LoadedPlanPdf = {
  viewBox: PlanViewBox;
  pageWidth: number;
  pageHeight: number;
};

type PdfJsModule = typeof import("pdfjs-dist");
type PdfDocument = Awaited<ReturnType<PdfJsModule["getDocument"]>["promise"]>;

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

function capPixelScale(pageW: number, pageH: number, scale: number, maxPx: number): number {
  const side = Math.max(pageW, pageH) * scale;
  if (side <= maxPx) return scale;
  return scale * (maxPx / side);
}

/** PDF 1회 로드 + 캔버스 렌더 (메타·본문 이중 로드 없음) */
export async function loadAndRenderPlanPdf(
  src: string,
  canvas: HTMLCanvasElement,
  pixelScale: number,
): Promise<LoadedPlanPdf> {
  const pdf = await loadPdfDocument(src);
  const page = await pdf.getPage(1);
  const baseVp = page.getViewport({ scale: 1 });
  const scale = capPixelScale(baseVp.width, baseVp.height, pixelScale, 3200);
  const viewport = page.getViewport({ scale });

  canvas.width = viewport.width;
  canvas.height = viewport.height;
  canvas.style.width = `${baseVp.width}px`;
  canvas.style.height = `${baseVp.height}px`;

  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("canvas 2d 컨텍스트를 열 수 없습니다.");

  ctx.fillStyle = "#f5f3ef";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport, intent: "display" }).promise;

  return {
    viewBox: { x: 0, y: 0, width: baseVp.width, height: baseVp.height },
    pageWidth: baseVp.width,
    pageHeight: baseVp.height,
  };
}
