import { NextRequest } from "next/server";
import {
  type ExhibitPreviewSlot,
  getExhibitPreview,
  subscribeExhibitPreview,
} from "@/lib/exhibitPreviewStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BOUNDARY = "exhibitframe";

/** MJPEG — 모니터 `<img src="...">` 로 거의 실시간 표시 (백프레셔 시 중간 프레임 드롭) */
export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();
  let flushPending: () => void = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let lastAt = 0;
      let pending: ExhibitPreviewSlot | null = null;

      const canEnqueue = () => {
        const ds = controller.desiredSize;
        return ds === null || ds > 0;
      };

      const writeSlot = (slot: ExhibitPreviewSlot) => {
        if (closed || slot.updatedAt <= lastAt) return;
        lastAt = slot.updatedAt;
        const buf = Buffer.from(slot.base64, "base64");
        controller.enqueue(
          encoder.encode(
            `--${BOUNDARY}\r\nContent-Type: ${slot.mime || "image/jpeg"}\r\nContent-Length: ${buf.length}\r\n\r\n`,
          ),
        );
        controller.enqueue(buf);
        controller.enqueue(encoder.encode("\r\n"));
      };

      const flush = () => {
        if (closed || !pending) return;
        if (!canEnqueue()) return;
        const slot = pending;
        pending = null;
        writeSlot(slot);
        if (pending) flush();
      };

      flushPending = flush;

      const schedule = (slot: ExhibitPreviewSlot) => {
        if (closed) return;
        if (pending && slot.seq !== undefined && pending.seq !== undefined && slot.seq < pending.seq) {
          return;
        }
        if (!pending || slot.updatedAt >= pending.updatedAt) {
          pending = slot;
        }
        flush();
      };

      const initial = getExhibitPreview();
      if (initial) schedule(initial);

      const unsub = subscribeExhibitPreview((next) => {
        if (closed) return;
        try {
          schedule(next);
        } catch {
          closed = true;
          unsub();
        }
      });

      req.signal.addEventListener("abort", () => {
        closed = true;
        pending = null;
        unsub();
        try {
          controller.close();
        } catch {
          /* ignore */
        }
      });
    },
    pull() {
      flushPending();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": `multipart/x-mixed-replace; boundary=${BOUNDARY}`,
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Connection: "keep-alive",
    },
  });
}
