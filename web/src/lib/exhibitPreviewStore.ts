/** 태블릿→호스트 TV 프리뷰 (메모리, 단일 최신 프레임). */

export type ExhibitFaceBox = {
  /** 0–1, 프리뷰 JPEG 기준 정규화 좌표 */
  x: number;
  y: number;
  w: number;
  h: number;
};

export type ExhibitPreviewSlot = {
  mime: string;
  base64: string;
  updatedAt: number;
  /** 태블릿 캡처 순번 — 늦게 도착한 POST가 최신을 덮어쓰지 않게 */
  seq?: number;
  faces: ExhibitFaceBox[];
};

type PreviewGlobal = {
  __exhibitPreviewSlot?: ExhibitPreviewSlot | null;
  __exhibitPreviewListeners?: Set<(slot: ExhibitPreviewSlot) => void>;
};

const globalRef = globalThis as unknown as PreviewGlobal;

function listeners(): Set<(slot: ExhibitPreviewSlot) => void> {
  if (!globalRef.__exhibitPreviewListeners) {
    globalRef.__exhibitPreviewListeners = new Set();
  }
  return globalRef.__exhibitPreviewListeners;
}

function getSlot(): ExhibitPreviewSlot | null {
  return globalRef.__exhibitPreviewSlot ?? null;
}

function setSlot(next: ExhibitPreviewSlot | null): void {
  globalRef.__exhibitPreviewSlot = next;
}

/** MJPEG 스트림 등 — 새 프레임마다 알림 */
export function subscribeExhibitPreview(cb: (slot: ExhibitPreviewSlot) => void): () => void {
  const set = listeners();
  set.add(cb);
  return () => set.delete(cb);
}

export function setExhibitPreview(
  mime: string,
  base64: string,
  faces: ExhibitFaceBox[] = [],
  seq?: number,
): boolean {
  const prev = getSlot();
  if (seq !== undefined && prev?.seq !== undefined && seq <= prev.seq) {
    return false;
  }
  const slot: ExhibitPreviewSlot = { mime, base64, updatedAt: Date.now(), faces, seq };
  setSlot(slot);
  for (const cb of listeners()) {
    try {
      cb(slot);
    } catch {
      /* ignore */
    }
  }
  return true;
}

export function getExhibitPreview(): ExhibitPreviewSlot | null {
  return getSlot();
}

export function getExhibitPreviewMeta(): { updatedAt: number | null; faces: ExhibitFaceBox[] } {
  const slot = getSlot();
  if (!slot) return { updatedAt: null, faces: [] };
  return { updatedAt: slot.updatedAt, faces: slot.faces };
}

/** 캠 꺼짐·탭 종료 — 모니터가 바로 “대기” UI로 전환 */
export function clearExhibitPreview(): void {
  setSlot(null);
}
