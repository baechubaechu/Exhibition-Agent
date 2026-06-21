"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EXHIBIT_CAPTURE_SOURCE } from "@/lib/exhibitCaptureConfig";
import { derivePresenceFromSensor, hotspotIdFromReason, parsePresenceMode, type PresenceMode } from "@/lib/exhibitPresence";
import { EMOTION_KO, SCENE_DETAIL } from "@/lib/signageCopy";

export type AgentSensor = {
  people_count?: number;
  decibel?: number;
  emotion_state?: string;
  occupancy_zone?: string;
  capture_live?: boolean;
};

export type AgentDecision = {
  scene_id?: string;
  hold_sec?: number;
  target_zone?: string;
  reason?: string;
};

export type AgentPayload = {
  last_sensor?: AgentSensor | null;
  last_decision?: AgentDecision | null;
  visitor_manual_lock?: boolean;
  visitor_manual_lock_remaining_sec?: number;
  last_updated?: string | null;
  presence_mode?: string;
  explore_hotspot_id?: string | null;
  presence_dwell_sec?: number;
  crowd_tier?: string;
};

export type HostLiveFeed = {
  videoLive: boolean;
  peopleCount: number;
  decibel: number;
};

const CAPTURE_FROM_HOST = EXHIBIT_CAPTURE_SOURCE === "host";
const AGENT_POLL_MS = 1000;
const MONITOR_AGENT_POLL_MS = 250;

/** `/monitor`·`/signage` 공통 — 에이전트 상태 폴링 */
export function useExhibitSignageFeed(options?: { hostLive?: HostLiveFeed | null; fastAgentPoll?: boolean }) {
  const hostLive = options?.hostLive;
  const pollMs = options?.fastAgentPoll ? MONITOR_AGENT_POLL_MS : AGENT_POLL_MS;

  const [agent, setAgent] = useState<AgentPayload | null>(null);
  const [agentErr, setAgentErr] = useState<string | null>(null);

  const pullAgent = useCallback(async () => {
    try {
      const res = await fetch("/api/exhibit/agent-status", { cache: "no-store" });
      const j = (await res.json()) as { ok?: boolean; agent?: AgentPayload; error?: string };
      if (j.ok && j.agent) {
        setAgent(j.agent);
        setAgentErr(null);
      } else {
        setAgentErr(j.error ?? "에이전트 응답 없음");
      }
    } catch (e) {
      setAgentErr(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void pullAgent();
    const i = window.setInterval(() => void pullAgent(), pollMs);
    return () => clearInterval(i);
  }, [pullAgent, pollMs]);

  const sensor = agent?.last_sensor;
  const decision = agent?.last_decision;
  const manualLock = Boolean(agent?.visitor_manual_lock);

  const hostLiveActive = hostLive?.videoLive === true;
  const captureLive = sensor?.capture_live === true || hostLiveActive;

  const effectivePeople = Math.max(sensor?.people_count ?? 0, hostLive?.peopleCount ?? 0);
  const effectiveDecibel =
    typeof hostLive?.decibel === "number"
      ? hostLive.decibel
      : typeof sensor?.decibel === "number"
        ? sensor.decibel
        : undefined;

  const presenceModeRaw: PresenceMode = parsePresenceMode(agent?.presence_mode);

  const presenceMode: PresenceMode = useMemo(() => {
    if (manualLock) return presenceModeRaw;
    if (captureLive && presenceModeRaw !== "quiet_waiting") return presenceModeRaw;
    if (hostLiveActive) {
      if (presenceModeRaw !== "quiet_waiting") return presenceModeRaw;
      return derivePresenceFromSensor(effectivePeople, effectiveDecibel ?? 40);
    }
    if (effectivePeople > 0) {
      if (presenceModeRaw !== "quiet_waiting") return presenceModeRaw;
      return derivePresenceFromSensor(effectivePeople, effectiveDecibel ?? 40);
    }
    return "quiet_waiting";
  }, [
    manualLock,
    captureLive,
    presenceModeRaw,
    hostLiveActive,
    effectivePeople,
    effectiveDecibel,
  ]);

  const sceneIdRaw = decision?.scene_id ?? "safe_neutral";
  const sceneId = manualLock || captureLive || hostLiveActive ? sceneIdRaw : "calm_gallery";
  const detail = SCENE_DETAIL[sceneId] ?? SCENE_DETAIL.safe_neutral;

  const mergedSensor: AgentSensor | null = useMemo(() => {
    const base = sensor ?? {};
    return {
      ...base,
      people_count: effectivePeople,
      decibel: effectiveDecibel ?? base.decibel,
      capture_live: captureLive,
    };
  }, [sensor, effectivePeople, effectiveDecibel, captureLive]);

  const emotionKo = mergedSensor?.emotion_state
    ? (EMOTION_KO[mergedSensor.emotion_state] ?? mergedSensor.emotion_state)
    : "—";

  const modeLine = agent?.visitor_manual_lock
    ? `태블릿에서 구역을 선택하는 중 · 약 ${Math.ceil(agent.visitor_manual_lock_remaining_sec ?? 0)}초 뒤 자동 연동으로 돌아갈 수 있습니다`
    : CAPTURE_FROM_HOST
      ? "전시장 웹캠·마이크 입력으로 공간이 자동으로 맞춰지고 있습니다"
      : "전시장 마이크·카메라 입력으로 공간이 자동으로 맞춰지고 있습니다";

  const reasonText = decision?.reason ? decision.reason : null;

  const exploreHotspotId =
    (typeof agent?.explore_hotspot_id === "string" && agent.explore_hotspot_id) ||
    hotspotIdFromReason(reasonText) ||
    null;
  const presenceDwellSec = typeof agent?.presence_dwell_sec === "number" ? agent.presence_dwell_sec : 0;
  const crowdTier = typeof agent?.crowd_tier === "string" ? agent.crowd_tier : "none";

  return {
    captureFromHost: CAPTURE_FROM_HOST,
    captureLive,
    agent,
    agentErr,
    sensor: mergedSensor,
    decision,
    sceneId,
    detail,
    emotionKo,
    modeLine,
    reasonText,
    manualLock,
    manualRemainingSec: agent?.visitor_manual_lock_remaining_sec,
    presenceMode,
    exploreHotspotId,
    presenceDwellSec,
    crowdTier,
  };
}
