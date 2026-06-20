import type { AgentDecision } from "@/hooks/useExhibitSignageFeed";
import type { PresenceMode } from "@/lib/exhibitPresence";

export type MonitorOutputRow = {
  id: string;
  label: string;
  options: readonly string[];
  activeIndex: number;
  hint?: string;
};

type SceneOutputProfile = {
  light: readonly [string, string, string];
  lightIdx: number;
  zone: readonly [string, string, string];
  zoneIdx: number;
  model: readonly [string, string, string];
  modelIdx: number;
  ambient: readonly [string, string, string, string];
  ambientIdx: number;
  sound: readonly [string, string, string];
  soundIdx: number;
  hint: string;
};

const PROFILES: Record<string, SceneOutputProfile> = {
  calm_gallery: {
    light: ["Soft", "Pulse", "Line"],
    lightIdx: 0,
    zone: ["Full", "Zone A", "Zone B"],
    zoneIdx: 0,
    model: ["Dim", "Sequential", "X-Cross"],
    modelIdx: 0,
    ambient: ["Mute", "Low", "Medium", "Filtered"],
    ambientIdx: 1,
    sound: ["Ambient", "Filtered", "Invite"],
    soundIdx: 0,
    hint: "은은한 전체 조명 · 낮은 ambient",
  },
  approaching_invite: {
    light: ["Soft", "Pulse", "Line"],
    lightIdx: 1,
    zone: ["Full", "Zone A", "Zone B"],
    zoneIdx: 0,
    model: ["Dim", "Sequential", "X-Cross"],
    modelIdx: 1,
    ambient: ["Mute", "Low", "Medium", "Filtered"],
    ambientIdx: 1,
    sound: ["Ambient", "Filtered", "Invite"],
    soundIdx: 2,
    hint: "12구간 빠른 순차 점등 · 짧은 초대음",
  },
  dense_flux: {
    light: ["Soft", "Pulse", "Line"],
    lightIdx: 2,
    zone: ["Full", "Zone A", "Zone B"],
    zoneIdx: 0,
    model: ["Dim", "Sequential", "X-Cross"],
    modelIdx: 2,
    ambient: ["Mute", "Low", "Medium", "Filtered"],
    ambientIdx: 3,
    sound: ["Ambient", "Filtered", "Invite"],
    soundIdx: 1,
    hint: "X-Cross·단면 라인 강조 · filtered",
  },
  critical_focus: {
    light: ["Soft", "Pulse", "Line"],
    lightIdx: 2,
    zone: ["Full", "Zone A", "Zone B"],
    zoneIdx: 0,
    model: ["Dim", "Sequential", "X-Cross"],
    modelIdx: 2,
    ambient: ["Mute", "Low", "Medium", "Filtered"],
    ambientIdx: 1,
    sound: ["Ambient", "Filtered", "Invite"],
    soundIdx: 0,
    hint: "집중광 · walking layer",
  },
  night_reflect: {
    light: ["Soft", "Pulse", "Line"],
    lightIdx: 0,
    zone: ["Full", "Zone A", "Zone B"],
    zoneIdx: 0,
    model: ["Dim", "Sequential", "X-Cross"],
    modelIdx: 0,
    ambient: ["Mute", "Low", "Medium", "Filtered"],
    ambientIdx: 1,
    sound: ["Ambient", "Filtered", "Invite"],
    soundIdx: 0,
    hint: "저조도 완충",
  },
  presence_cooldown: {
    light: ["Soft", "Pulse", "Line"],
    lightIdx: 0,
    zone: ["Full", "Zone A", "Zone B"],
    zoneIdx: 0,
    model: ["Dim", "Sequential", "X-Cross"],
    modelIdx: 0,
    ambient: ["Mute", "Low", "Medium", "Filtered"],
    ambientIdx: 1,
    sound: ["Ambient", "Filtered", "Invite"],
    soundIdx: 0,
    hint: "자동 복귀 · 천천히 fade",
  },
  safe_neutral: {
    light: ["Soft", "Pulse", "Line"],
    lightIdx: 0,
    zone: ["Full", "Zone A", "Zone B"],
    zoneIdx: 0,
    model: ["Dim", "Sequential", "X-Cross"],
    modelIdx: 0,
    ambient: ["Mute", "Low", "Medium", "Filtered"],
    ambientIdx: 0,
    sound: ["Ambient", "Filtered", "Invite"],
    soundIdx: 0,
    hint: "안전 기본 · 무음",
  },
};

function pinProfile(zone: "zoneA" | "zoneB" | "all"): SceneOutputProfile {
  return {
    light: ["Soft", "Pulse", "Line"],
    lightIdx: 1,
    zone: ["Full", "Zone A", "Zone B"],
    zoneIdx: zone === "zoneA" ? 1 : zone === "zoneB" ? 2 : 0,
    model: ["Dim", "Sequential", "X-Cross"],
    modelIdx: 1,
    ambient: ["Mute", "Low", "Medium", "Filtered"],
    ambientIdx: 1,
    sound: ["Ambient", "Filtered", "Invite"],
    soundIdx: 0,
    hint: "선택 구역 하이라이트",
  };
}

function resolveProfile(sceneId: string, targetZone?: string): SceneOutputProfile {
  if (sceneId.startsWith("floor_pin_")) {
    const z = targetZone === "zoneA" || targetZone === "zoneB" ? targetZone : "all";
    return pinProfile(z);
  }
  return PROFILES[sceneId] ?? PROFILES.calm_gallery;
}

/** 아웃풋(조명·LED·ambient·사운드) 현재 연출 */
export function buildMonitorOutputs(input: {
  presenceMode: PresenceMode;
  sceneId: string;
  decision?: AgentDecision | null;
}): MonitorOutputRow[] {
  const { presenceMode, sceneId, decision } = input;
  const zone = decision?.target_zone;
  let profile = resolveProfile(sceneId, zone);

  if (presenceMode === "loud_active") {
    profile = {
      ...profile,
      lightIdx: 2,
      modelIdx: 2,
      ambientIdx: 0,
      soundIdx: 1,
      hint: "소음 큼 · 시각만 강조 · 스피커 줄임",
    };
  }

  if (presenceMode === "explore") {
    profile = {
      ...profile,
      ambientIdx: 1,
      hint: "태블릿 선택 구역 · 모니터 동선 영상",
    };
  }

  if (presenceMode === "quiet_waiting") {
    profile = {
      ...PROFILES.calm_gallery,
      modelIdx: 0,
      ambientIdx: 1,
      hint: "대기 · X-Cross 약한 pulse",
    };
  }

  if (presenceMode === "solo" || presenceMode === "pair" || presenceMode === "dwelling") {
    profile = {
      ...PROFILES.critical_focus,
      lightIdx: 1,
      zoneIdx: presenceMode === "pair" ? 0 : 1,
      hint:
        presenceMode === "pair"
          ? "2명 · 구역 조명 + 단면 집중"
          : presenceMode === "dwelling"
            ? "머무름 · 집중광·walking layer"
            : "1명 · 한 구역 집중 조명",
    };
  }

  if (presenceMode === "approaching") {
    profile = {
      ...PROFILES.approaching_invite,
      hint: "다가옴 · 입구 쪽 순차 점등",
    };
  }

  if (presenceMode === "group") {
    profile = {
      ...PROFILES.dense_flux,
      hint: "3명+ · 전체 조도·채광 상승",
    };
  }

  const displayIdx = presenceMode === "explore" ? 1 : 0;

  return [
    outputRow("light", "Lighting", profile.light, profile.lightIdx, profile.hint),
    outputRow("zone", "Light zone", profile.zone, profile.zoneIdx),
    outputRow("model", "Model LEDs", profile.model, profile.modelIdx),
    outputRow("ambient", "Ambient volume", profile.ambient, profile.ambientIdx),
    outputRow("sound", "Sound scene", profile.sound, profile.soundIdx),
    {
      id: "display",
      label: "Monitor",
      options: ["Live view", "Walkthrough"],
      activeIndex: displayIdx,
      hint: presenceMode === "explore" ? "구역 동선 MP4" : "웹캠 + 얼굴 테두리",
    },
  ];
}

function outputRow(
  id: string,
  label: string,
  options: readonly string[],
  activeIndex: number,
  hint?: string,
): MonitorOutputRow {
  return {
    id,
    label,
    options,
    activeIndex: Math.min(options.length - 1, Math.max(0, activeIndex)),
    hint,
  };
}
