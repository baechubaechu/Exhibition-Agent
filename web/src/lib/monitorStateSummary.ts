import type { AgentSensor } from "@/hooks/useExhibitSignageFeed";
import type { PresenceMode } from "@/lib/exhibitPresence";

export type MonitorStateChip = {
  id: string;
  label: string;
  value: string;
};

/** Current mode 오른쪽 — 인풋 판정 요약(숫자 없음) */
export function buildMonitorStateSummary(input: {
  presenceMode: PresenceMode;
  sensor?: AgentSensor | null;
  crowdTier: string;
  manualLock: boolean;
  exploreHotspotId: string | null;
}): MonitorStateChip[] {
  const { presenceMode, sensor, crowdTier, manualLock, exploreHotspotId } = input;
  const emotion = sensor?.emotion_state ?? "neutral";

  const crowd = crowdValue(presenceMode, crowdTier, sensor?.people_count);
  const noise = noiseValue(presenceMode, sensor?.decibel);
  const mood = moodValue(presenceMode, emotion);
  const flow = flowValue(presenceMode);
  const tablet = tabletValue(manualLock, exploreHotspotId);

  return [
    { id: "crowd", label: "Crowd", value: crowd },
    { id: "noise", label: "Noise", value: noise },
    { id: "mood", label: "Mood", value: mood },
    { id: "flow", label: "Flow", value: flow },
    { id: "tablet", label: "Tablet", value: tablet },
  ];
}

function crowdValue(mode: PresenceMode, tier: string, people?: number): string {
  if (typeof people === "number") {
    if (people === 0) {
      if (mode === "approaching") return "Incoming";
      if (mode === "leaving") return "Exiting";
      if (mode === "explore") return "Active";
      return "Empty";
    }
    if (people === 1) return "Solo";
    if (people === 2) return "Pair";
    if (people >= 3) return "Group";
  }
  if (mode === "quiet_waiting") return "Empty";
  if (mode === "approaching") return "Incoming";
  if (mode === "leaving") return "Exiting";
  if (mode === "explore") return "Active";
  if (mode === "solo" || tier === "solo") return "Solo";
  if (mode === "group" || tier === "group") return "Group";
  if (mode === "dwelling") return "Focused";
  return "Passing";
}

function noiseValue(mode: PresenceMode, db?: number): string {
  if (mode === "loud_active") return "Active · Visual";
  if (typeof db === "number" && db >= 65) return "Active";
  if (typeof db === "number" && db >= 58) return "Moderate";
  return "Calm";
}

function moodValue(mode: PresenceMode, emotion: string): string {
  if (mode === "approaching" || mode === "explore") return "Curious";
  if (emotion === "active") return "Curious";
  if (emotion === "stressed") return "Tense";
  if (emotion === "calm") return "Calm";
  return "Neutral";
}

function flowValue(mode: PresenceMode): string {
  if (mode === "approaching") return "Invite";
  if (mode === "dwelling" || mode === "explore") return "Focus";
  if (mode === "loud_active") return "Visual focus";
  if (mode === "cooldown") return "Cool down";
  return "Slow walk";
}

function tabletValue(manualLock: boolean, hotspotId: string | null): string {
  if (!manualLock) return "Auto";
  if (hotspotId) return "Zone pick";
  return "Manual";
}
