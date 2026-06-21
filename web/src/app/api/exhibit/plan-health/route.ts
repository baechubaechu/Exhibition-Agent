import { existsSync, statSync } from "fs";
import { join } from "path";
import { NextResponse } from "next/server";

/** 태블릿 도면 PDF/SVG 가 서버 디스크에 있는지 — 전시장 디버그용 */
export async function GET() {
  const base = join(process.cwd(), "public", "drawings");
  const drawingNames = ["tablet-site.pdf", "tablet-floor.pdf", "tablet-plan.svg"];
  const workerPath = join(process.cwd(), "public", "pdf.worker.min.mjs");

  const files: Record<string, { exists: boolean; bytes?: number }> = {};
  for (const name of drawingNames) {
    const path = join(base, name);
    if (!existsSync(path)) {
      files[name] = { exists: false };
    } else {
      files[name] = { exists: true, bytes: statSync(path).size };
    }
  }
  files["pdf.worker.min.mjs"] = existsSync(workerPath)
    ? { exists: true, bytes: statSync(workerPath).size }
    : { exists: false };

  const ok = files["tablet-site.pdf"]?.exists && files["tablet-floor.pdf"]?.exists;

  return NextResponse.json({
    ok,
    cwd: process.cwd(),
    drawingsDir: base,
    files,
    hint: ok
      ? "PDF 파일 있음 — 태블릿에서 /drawings/tablet-site.pdf 가 404면 dev:lan:https(0.0.0.0) 실행·방화벽·IP 확인"
      : "PDF 없음 — git pull 후 web/public/drawings 확인, 또는 데탑에서 폴더 복사",
  });
}
