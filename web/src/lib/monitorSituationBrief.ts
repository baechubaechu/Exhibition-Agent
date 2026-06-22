import type { AgentSensor } from "@/hooks/useExhibitSignageFeed";
import type { PresenceMode } from "@/lib/exhibitPresence";

export type MonitorSituationBrief = {
  situationKo: string;
  goalKo: string;
};

type BuildInput = {
  presenceMode: PresenceMode;
  sensor?: AgentSensor | null;
  exploreHotspotLabel?: string | null;
  isExplore: boolean;
  captureLive: boolean;
};

function peopleLine(n: number): string {
  if (n <= 0) return "사람 없음";
  if (n === 1) return "사람 1명";
  if (n === 2) return "사람 2명";
  return `사람 ${n}명`;
}

function noiseLine(db: number, mode: PresenceMode): string {
  if (mode === "loud_active" || db >= 65) return `소음 높음 · ${Math.round(db)} dB`;
  if (db >= 58) return `소음 보통 · ${Math.round(db)} dB`;
  return `소음 낮음 · ${Math.round(db)} dB`;
}

function activityLine(mode: PresenceMode, isExplore: boolean, exploreLabel: string | null): string {
  if (isExplore && exploreLabel) return `태블릿에서 「${exploreLabel}」 선택`;
  switch (mode) {
    case "quiet_waiting":
      return "관람객 없음 · 대기";
    case "approaching":
      return "사람이 다가오는 중";
    case "leaving":
      return "퇴장 중";
    case "dwelling":
      return "한곳에 머무는 중";
    case "cooldown":
      return "자동 모드로 복귀 중";
    case "loud_active":
      return "주변 소음이 큼";
    case "solo":
      return "1명 관람";
    case "pair":
      return "2명 관람";
    case "group":
      return "여러 명 관람";
    case "explore":
      return "구역 탐색 중";
    default:
      return "관람 중";
  }
}

const MODE_GOAL_KO: Record<PresenceMode, string> = {
  quiet_waiting: "조명·사운드를 낮게 유지합니다.",
  approaching: "들어오는 사람에게 짧게 눈길을 줍니다.",
  leaving: "조용한 대기 상태로 되돌립니다.",
  solo: "한 명이 보기 편한 밝기로 맞춥니다.",
  pair: "두 명이 함께 보기 편한 톤을 유지합니다.",
  group: "사람 수에 맞게 밝기와 밀도를 올립니다.",
  dwelling: "머무는 동안 설명·조명을 집중합니다.",
  explore: "선택한 구역 영상과 설명을 보여 줍니다.",
  cooldown: "태블릿 조작 후 자동 연동으로 돌아갑니다.",
  loud_active: "소리는 줄이고 화면·조명을 강조합니다.",
};

export function buildMonitorSituationBrief(input: BuildInput): MonitorSituationBrief {
  const { presenceMode, sensor, exploreHotspotLabel, isExplore, captureLive } = input;

  const people = typeof sensor?.people_count === "number" ? sensor.people_count : 0;
  const db = typeof sensor?.decibel === "number" ? sensor.decibel : 40;
  const exploreLabel = exploreHotspotLabel ?? null;

  let situationKo: string;
  if (!captureLive && people <= 0 && !isExplore) {
    situationKo = "사람 없음 · 센서 대기 중";
  } else {
    situationKo = [
      peopleLine(people),
      noiseLine(db, presenceMode),
      activityLine(presenceMode, isExplore, exploreLabel),
    ].join(" · ");
  }

  return { situationKo, goalKo: MODE_GOAL_KO[presenceMode] };
}
