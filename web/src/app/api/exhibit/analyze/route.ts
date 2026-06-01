import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const AGENT_BASE = (process.env.EXHIBITION_AGENT_BASE_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

/** 태블릿 HTTPS → FastAPI HTTP 혼합 콘텐츠 회피. multipart 그대로 uvicorn /analyze 로 전달 */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const frame = form.get("frame");
    if (!(frame instanceof Blob)) {
      return NextResponse.json({ ok: false, error: "frame 필드 필요" }, { status: 400 });
    }

    const out = new FormData();
    out.append("frame", frame, "frame.jpg");
    const noise = form.get("noise_level");
    out.append("noise_level", typeof noise === "string" ? noise : "0");

    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 25_000);
    try {
      const r = await fetch(`${AGENT_BASE}/analyze`, {
        method: "POST",
        body: out,
        signal: ctrl.signal,
      });
      const text = await r.text();
      let body: unknown;
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        return NextResponse.json({ ok: false, error: text || `agent ${r.status}` }, { status: 502 });
      }
      return NextResponse.json(body, { status: r.status });
    } finally {
      clearTimeout(to);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 503 });
  }
}
