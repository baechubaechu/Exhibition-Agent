import { NextRequest, NextResponse } from "next/server";
import { type ExhibitFaceBox, getExhibitPreview, setExhibitPreview } from "@/lib/exhibitPreviewStore";

export const runtime = "nodejs";

function parseFacesField(raw: FormDataEntryValue | null): ExhibitFaceBox[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: ExhibitFaceBox[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, number>;
      if ([o.x, o.y, o.w, o.h].every((n) => typeof n === "number" && Number.isFinite(n))) {
        out.push({
          x: Math.max(0, Math.min(1, o.x)),
          y: Math.max(0, Math.min(1, o.y)),
          w: Math.max(0, Math.min(1, o.w)),
          h: Math.max(0, Math.min(1, o.h)),
        });
      }
    }
    return out.slice(0, 12);
  } catch {
    return [];
  }
}

/** 태블릿·호스트에서 넘어오는 카메라 미리보기 (multipart `frame`, 선택 `faces` JSON) */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("frame");
    if (!(file instanceof Blob)) {
      return NextResponse.json({ ok: false, error: "frame 필드 필요" }, { status: 400 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length > 900_000) {
      return NextResponse.json({ ok: false, error: "이미지 너무 큼" }, { status: 413 });
    }
    const mime = file.type || "image/jpeg";
    const facesEntry = form.get("faces");
    const faces =
      facesEntry !== null ? parseFacesField(facesEntry) : (getExhibitPreview()?.faces ?? []);
    const seqRaw = form.get("seq");
    const seq =
      typeof seqRaw === "string" && seqRaw.trim() ? Number(seqRaw) : undefined;
    const accepted = setExhibitPreview(
      mime,
      buf.toString("base64"),
      faces,
      Number.isFinite(seq) ? seq : undefined,
    );
    return NextResponse.json({ ok: true, accepted });
  } catch {
    return NextResponse.json({ ok: false, error: "처리 실패" }, { status: 400 });
  }
}
