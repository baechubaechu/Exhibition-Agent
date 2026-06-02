/** 에이전트 `/status` · 모니터 UI 공통 presence 모드 */

export type PresenceMode =
  | "quiet_waiting"
  | "approaching"
  | "leaving"
  | "solo"
  | "pair"
  | "group"
  | "dwelling"
  | "explore"
  | "cooldown"
  | "loud_active";

export const PRESENCE_MODE_LABEL: Record<PresenceMode, { ko: string; en: string }> = {
  quiet_waiting: { ko: "Quiet / Waiting", en: "Quiet / Waiting" },
  approaching: { ko: "Approaching", en: "Approaching" },
  leaving: { ko: "Leaving", en: "Leaving" },
  solo: { ko: "Solo visit", en: "Solo visit" },
  pair: { ko: "Pair visit", en: "Pair visit" },
  group: { ko: "Group", en: "Group" },
  dwelling: { ko: "Staying", en: "Staying" },
  explore: { ko: "Explore", en: "Explore" },
  cooldown: { ko: "Returning to auto", en: "Returning to auto" },
  loud_active: { ko: "Visual Focus", en: "Visual Focus" },
};

export const PRESENCE_MODE_META: Record<
  PresenceMode,
  { ko: string; en: string; descKo: string; descEn: string }
> = {
  quiet_waiting: {
    ko: "Quiet / Waiting",
    en: "Quiet / Waiting",
    descKo: "관람객 없음 · 은은한 조명·낮은 ambient",
    descEn: "No visitors · soft light and low ambient",
  },
  approaching: {
    ko: "Approaching",
    en: "Approaching",
    descKo: "다가옴 · 순차 점등·짧은 초대 연출",
    descEn: "Someone approaching · short invite lighting",
  },
  leaving: {
    ko: "Leaving",
    en: "Leaving",
    descKo: "퇴장 · 조용한 대기 상태로 복귀",
    descEn: "Leaving · returning to quiet waiting",
  },
  solo: {
    ko: "Solo visit",
    en: "Solo visit",
    descKo: "1명 관람 · 동선 Passing",
    descEn: "Single visitor · passing flow",
  },
  pair: {
    ko: "Pair visit",
    en: "Pair visit",
    descKo: "2명 관람 · 짧은 대화/동행 동선",
    descEn: "Two visitors · shared passing flow",
  },
  group: {
    ko: "Group",
    en: "Group",
    descKo: "3명 이상 · 혼잡·에너지 쪽",
    descEn: "Three or more · group energy",
  },
  dwelling: {
    ko: "Staying",
    en: "Staying",
    descKo: "8초 이상 머무름 · Focus·Attention High",
    descEn: "Dwelling 8s+ · focus atmosphere",
  },
  explore: {
    ko: "Explore",
    en: "Explore",
    descKo: "태블릿 구역 선택 · 동선 영상·설명",
    descEn: "Tablet zone pick · walkthrough video",
  },
  cooldown: {
    ko: "Returning to auto",
    en: "Returning to auto",
    descKo: "탐색 종료 · 자동 연동으로 부드럽게 복귀",
    descEn: "Explore ended · soft return to auto",
  },
  loud_active: {
    ko: "Visual Focus",
    en: "Visual Focus",
    descKo: "소음 큼 · 시각 강조·스피커 줄임",
    descEn: "Loud hall · visual focus, lower sound",
  },
};

export const CROWD_TIER_LABEL: Record<string, { ko: string; en: string }> = {
  none: { ko: "없음", en: "None" },
  solo: { ko: "1명", en: "Solo" },
  pair: { ko: "2명", en: "Pair" },
  group: { ko: "3명+", en: "Group" },
};

export function parsePresenceMode(raw: unknown): PresenceMode {
  const v = typeof raw === "string" ? raw : "";
  if (v in PRESENCE_MODE_LABEL) return v as PresenceMode;
  return "quiet_waiting";
}

/** 에이전트 폴링 전 — /monitor 로컬 비전·웹캠 기준 즉시 표시 */
export function derivePresenceFromSensor(people: number, decibel: number): PresenceMode {
  if (people <= 0) return "quiet_waiting";
  if (decibel >= 65) return "loud_active";
  if (people >= 3) return "group";
  if (people === 2) return "pair";
  if (people >= 1) return "solo";
  return "quiet_waiting";
}

export function hotspotIdFromReason(reason: string | null | undefined): string | null {
  if (!reason || !reason.includes("floor_hotspot:")) return null;
  const id = reason.split("floor_hotspot:")[1]?.trim();
  return id && id.length > 0 ? id : null;
}
