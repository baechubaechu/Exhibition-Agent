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

/** 전시장 배경소음 기준 — 말소리·웃음이 잡히면 밝은 렌더로 */
const ACTIVE_DB = 54;
const LOUD_DB = 62;

type PeopleTier = 0 | 1 | 2 | 3;

/** Vision 0·히스테리시스 구간에도 presence 모드가 인원 바닥을 잡아 줌 */
function peopleTier(people: number, mode: PresenceMode): PeopleTier {
  const count = Math.max(0, Math.floor(people));
  const modeFloor =
    mode === "group" || mode === "loud_active"
      ? 3
      : mode === "pair"
        ? 2
        : mode === "solo" || mode === "dwelling" || mode === "approaching"
          ? 1
          : 0;
  const tier = Math.max(count, modeFloor);
  if (tier >= 3) return 3;
  if (tier === 2) return 2;
  if (tier >= 1) return 1;
  return 0;
}

/** presence · 씬 · 센서 → 투시 렌더 1장 (인원 티어 우선, 10종 PNG 골고루) */
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
  const tier = peopleTier(people, presenceMode);

  if (presenceMode === "leaving" || presenceMode === "cooldown") {
    return "lo-n-p0-w10";
  }

  if (presenceMode === "approaching" || sceneId === "approaching_invite") {
    return "hi-n-p1-w10";
  }

  if (presenceMode === "loud_active" || db >= LOUD_DB) {
    if (tier >= 3) return "hi-c-p2-w80";
    if (tier >= 1) return "hi-n-p1-w80";
    return "lo-n-p0-w10";
  }

  if (tier >= 3 || presenceMode === "group" || sceneId === "dense_flux") {
    if (emotion === "calm" || sceneId === "calm_gallery") return "hi-w-p2-w80";
    return "hi-n-p2-w80";
  }

  if (tier === 2 || presenceMode === "pair") {
    if (db >= ACTIVE_DB) return "hi-n-p1-w80";
    if (emotion === "stressed" || sceneId === "night_reflect") return "lo-w-p1-w10";
    if (emotion === "active" || sceneId === "critical_focus") return "lo-c-p1-w10";
    return "lo-w-p1-w10";
  }

  if (tier === 1 || presenceMode === "solo" || presenceMode === "dwelling") {
    if (db >= ACTIVE_DB) return "hi-n-p1-w80";
    if (emotion === "stressed" || sceneId === "night_reflect") return "lo-w-p1-w10";
    if (emotion === "active" || sceneId === "critical_focus") return "lo-c-p1-w10";
    if (emotion === "calm") return "lo-w-p1-w10";
    return "lo-n-p1-w10";
  }

  if (sceneId === "night_reflect" || emotion === "stressed") {
    return "lo-w-p0-w10";
  }

  return "lo-n-p0-w10";
}

function captionFor(_id: SpaceRenderId, mode: PresenceMode): string {
  return PRESENCE_MODE_META[mode]?.ko ?? "";
}

export const SPACE_RENDER_SRCS = SPACE_RENDER_IDS.map(spaceRenderSrc);
