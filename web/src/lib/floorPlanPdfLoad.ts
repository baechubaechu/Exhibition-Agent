import type { PlanViewBox } from "@/lib/floorPlanSvgLoad";

export type LoadedPlanPdf = {
  viewBox: PlanViewBox;
  /** PDF.js page — 재렌더 시 사용 */
  pageWidth: number;
  pageHeight: number;
};

/** 태블릿 도면 PDF (CTB 플롯본) — 1페이지 */
export async function fetchPlanPdf(src: string): Promise<LoadedPlanPdf> {
  const pdfUrl = typeof window !== "undefined" ? new URL(src, window.location.origin).href : src;
  let probe = await fetch(pdfUrl, { method: "HEAD", cache: "no-store" });
  if (probe.status === 405 || probe.status === 501) {
    probe = await fetch(pdfUrl, { method: "GET", cache: "no-store", headers: { Range: "bytes=0-0" } });
  }
  if (!probe.ok) {
    throw new Error(
      probe.status === 404
        ? `파일 없음(404): ${src} — web/public/drawings/tablet-plan.pdf 를 넣어 주세요`
        : `PDF 확인 실패 HTTP ${probe.status}`,
    );
  }

  const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
  if (typeof window !== "undefined") {
    GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdf.worker.min.mjs`;
  } else {
    GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  }

  const pdf = await getDocument(pdfUrl).promise;
  const page = await pdf.getPage(1);
  const baseVp = page.getViewport({ scale: 1 });

  return {
    viewBox: { x: 0, y: 0, width: baseVp.width, height: baseVp.height },
    pageWidth: baseVp.width,
    pageHeight: baseVp.height,
  };
}

export async function renderPlanPdfPage(
  src: string,
  canvas: HTMLCanvasElement,
  pixelScale: number,
): Promise<LoadedPlanPdf> {
  const pdfUrl = typeof window !== "undefined" ? new URL(src, window.location.origin).href : src;
  const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
  if (typeof window !== "undefined") {
    GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdf.worker.min.mjs`;
  }

  const pdf = await getDocument(pdfUrl).promise;
  const page = await pdf.getPage(1);
  const baseVp = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: pixelScale });

  canvas.width = viewport.width;
  canvas.height = viewport.height;
  canvas.style.width = `${baseVp.width}px`;
  canvas.style.height = `${baseVp.height}px`;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d 컨텍스트를 열 수 없습니다.");

  ctx.fillStyle = "#f5f3ef";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;

  return {
    viewBox: { x: 0, y: 0, width: baseVp.width, height: baseVp.height },
    pageWidth: baseVp.width,
    pageHeight: baseVp.height,
  };
}
