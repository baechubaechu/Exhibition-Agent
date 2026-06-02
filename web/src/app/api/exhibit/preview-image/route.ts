import { NextResponse } from "next/server";
import { getExhibitPreview } from "@/lib/exhibitPreviewStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 모니터 `<img src="...">` — dataUrl 대신 raw JPEG (src 변경 최소화) */
export async function GET() {
  const slot = getExhibitPreview();
  if (!slot) {
    return new NextResponse(null, { status: 204 });
  }
  const buf = Buffer.from(slot.base64, "base64");
  return new NextResponse(buf, {
    headers: {
      "Content-Type": slot.mime || "image/jpeg",
      "Cache-Control": "no-store, max-age=0",
      "X-Preview-At": String(slot.updatedAt),
    },
  });
}
