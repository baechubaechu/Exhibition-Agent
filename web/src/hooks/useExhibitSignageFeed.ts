"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EXHIBIT_CAPTURE_SOURCE } from "@/lib/exhibitCaptureConfig";
import { hotspotIdFromReason, parsePresenceMode, type PresenceMode } from "@/lib/exhibitPresence";
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

const CAPTURE_FROM_HOST = EXHIBIT_CAPTURE_SOURCE === "host";
const AGENT_POLL_MS = 1000;

/** `/monitor`·`/signage` 공통 — 에이전트 상태 폴링 */
export function useExhibitSignageFeed() {
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
    const i = window.setInterval(() => void pullAgent(), AGENT_POLL_MS);
    return () => clearInterval(i);
  }, [pullAgent]);

  const sensor = agent?.last_sensor;
  const decision = agent?.last_decision;
  const manualLock = Boolean(agent?.visitor_manual_lock);

  const captureLive = sensor?.capture_live === true;

  const presenceModeRaw: PresenceMode = parsePresenceMode(agent?.presence_mode);

  /** 태블릿 핀(Explore)은 에이전트 manual_lock 기준 — host 웹캠 captureLive 와 분리 */
  const presenceMode: PresenceMode = useMemo(() => {
    if (manualLock) return presenceModeRaw;
    if (captureLive) return presenceModeRaw;
    if ((sensor?.people_count ?? 0) > 0) return presenceModeRaw;
    return "quiet_waiting";
  }, [manualLock, captureLive, presenceModeRaw, sensor?.people_count]);

  const sceneIdRaw = decision?.scene_id ?? "safe_neutral";
  const sceneId = manualLock || captureLive ? sceneIdRaw : "calm_gallery";
  const detail = SCENE_DETAIL[sceneId] ?? SCENE_DETAIL.safe_neutral;

  const emotionKo = sensor?.emotion_state ? (EMOTION_KO[sensor.emotion_state] ?? sensor.emotion_state) : "—";

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
    sensor,
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
