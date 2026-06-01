import { NextResponse } from "next/server";
import { clearExhibitPreview } from "@/lib/exhibitPreviewStore";

export const runtime = "nodejs";

export async function POST() {
  clearExhibitPreview();
  return NextResponse.json({ ok: true });
}
