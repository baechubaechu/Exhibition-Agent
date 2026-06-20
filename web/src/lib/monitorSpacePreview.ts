import type { PresenceMode } from "@/lib/exhibitPresence";
import { derivePresenceFromSensor, PRESENCE_MODE_META } from "@/lib/exhibitPresence";

/** `web/public/monitor/space/rsp__{id}.png` */
export type SpaceRenderId =
  | "lo-n-p0-w10"
  | "lo-w-p0-w10"
  | "lo-n-p1-w10"
  | "lo-c-p1-w10"
  | "lo-w-p1-w10"
  | "hi-n-p1-w10"
  | "hi-n-p1-w80"
  | "hi-n-p2-w80"
  | "hi-c-p2-w80"
  | "hi-w-p2-w80";

export const SPACE_RENDER_IDS: readonly SpaceRenderId[] = [
  "lo-n-p0-w10",
  "lo-w-p0-w10",
  "lo-n-p1-w10",
  "lo-c-p1-w10",
  "lo-w-p1-w10",
  "hi-n-p1-w10",
  "hi-n-p1-w80",
  "hi-n-p2-w80",
  "hi-c-p2-w80",
  "hi-w-p2-w80",
] as const;

export function spaceRenderSrc(id: SpaceRenderId): string {
  return `/monitor/space/rsp__${id}.png`;
}

export type SpacePreviewResolved = {
  id: SpaceRenderId;
  src: string;
  captionKo: string;
};

const LOUD_DB = 65;
const PRE_LOUD_DB = 58;

/** presence · 씬 · 센서 → 투시 렌더 1장 (우선순위는 코드 순) */
export function resolveSpacePreview(input: {
  presenceMode: PresenceMode;
  sceneId: string;
  emotion?: string | null;
  decibel?: number | null;
  peopleCount?: number | null;
}): SpacePreviewResolved {
  const people = typeof input.peopleCount === "number" ? input.peopleCount : 0;
  const db = typeof input.decibel === "number" ? input.decibel : 40;
  let mode = input.presenceMode;
  // 에이전트 폴링 전·Vision 히스테리시스 구간 — 인원만 잡혀도 Solo/Pair 렌더로
  if (people > 0 && mode === "quiet_waiting") {
    mode = derivePresenceFromSensor(people, db);
  }
  const id = pickRenderId({ ...input, presenceMode: mode });
  return {
    id,
    src: spaceRenderSrc(id),
    captionKo: captionFor(id, mode),
  };
}

function pickRenderId(input: {
  presenceMode: PresenceMode;
  sceneId: string;
  emotion?: string | null;
  decibel?: number | null;
  peopleCount?: number | null;
}): SpaceRenderId {
  const { presenceMode, sceneId } = input;
  const emotion = input.emotion ?? "neutral";
  const db = typeof input.decibel === "number" ? input.decibel : 40;
  const people = typeof input.peopleCount === "number" ? input.peopleCount : 0;

  if (presenceMode === "approaching" || sceneId === "approaching_invite") {
    return "hi-n-p1-w10";
  }

  if (presenceMode === "loud_active" || db >= LOUD_DB) {
    return "hi-c-p2-w80";
  }

  if (presenceMode === "group" || sceneId === "dense_flux") {
    if (emotion === "calm" || sceneId === "calm_gallery") return "hi-w-p2-w80";
    return "hi-n-p2-w80";
  }

  if (db >= PRE_LOUD_DB && db < LOUD_DB && people > 0) {
    return "hi-n-p1-w80";
  }

  if (sceneId === "night_reflect" || emotion === "stressed") {
    return people > 0 ? "lo-w-p1-w10" : "lo-w-p0-w10";
  }

  if (presenceMode === "solo" || presenceMode === "pair" || presenceMode === "dwelling") {
    return "lo-c-p1-w10";
  }

  if (sceneId === "critical_focus") {
    return "lo-c-p1-w10";
  }

  if (presenceMode === "leaving" || presenceMode === "cooldown") {
    return "lo-n-p0-w10";
  }

  if (presenceMode === "quiet_waiting") {
    return people > 0 ? "lo-n-p1-w10" : "lo-n-p0-w10";
  }

  if (sceneId === "calm_gallery" || sceneId === "presence_cooldown" || sceneId === "safe_neutral") {
    return people > 0 ? "lo-n-p1-w10" : "lo-n-p0-w10";
  }

  return "lo-n-p0-w10";
}

function captionFor(_id: SpaceRenderId, mode: PresenceMode): string {
  return PRESENCE_MODE_META[mode]?.ko ?? "";
}

export const SPACE_RENDER_SRCS = SPACE_RENDER_IDS.map(spaceRenderSrc);
