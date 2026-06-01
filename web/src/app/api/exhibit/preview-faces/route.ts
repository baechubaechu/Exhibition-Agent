import { NextResponse } from "next/server";
import { getExhibitPreviewMeta } from "@/lib/exhibitPreviewStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 스트림 모드 — 얼굴 박스만 가볍게 폴링 */
export async function GET() {
  const meta = getExhibitPreviewMeta();
  return NextResponse.json({ ok: true, ...meta });
}
