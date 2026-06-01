"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EXHIBIT_CAPTURE_SOURCE } from "@/lib/exhibitCaptureConfig";
import {
  EXHIBIT_PREVIEW_STREAM,
  EXHIBIT_PREVIEW_STREAM_URL,
} from "@/lib/exhibitPreviewConfig";
import { EXHIBIT_PREVIEW_PUSH_MS } from "@/lib/exhibitPreviewTiming";
import type { ExhibitFaceBox } from "@/lib/exhibitPreviewStore";
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

const PREVIEW_FROM_HOST = EXHIBIT_CAPTURE_SOURCE === "host";
const PREVIEW_POLL_MS = EXHIBIT_PREVIEW_STREAM ? 80 : EXHIBIT_PREVIEW_PUSH_MS;
const AGENT_POLL_MS = 1000;
const PREVIEW_STALE_MS = 15_000;
const CAPTURE_LIVE_MS = 2_500;
const FACES_POLL_MS = 80;

/** `/monitor`·`/signage` 공통 — 프리뷰·에이전트 상태 폴링 */
export function useExhibitSignageFeed() {
  const [pollPreviewUrl, setPollPreviewUrl] = useState<string | null>(null);
  const [streamEpoch, setStreamEpoch] = useState(0);
  const previewUrl = useMemo(() => {
    if (EXHIBIT_PREVIEW_STREAM) {
      const q = streamEpoch > 0 ? `?e=${streamEpoch}` : "";
      return `${EXHIBIT_PREVIEW_STREAM_URL}${q}`;
    }
    return pollPreviewUrl;
  }, [streamEpoch, pollPreviewUrl]);
  const [previewFaces, setPreviewFaces] = useState<ExhibitFaceBox[]>([]);
  const [previewAt, setPreviewAt] = useState<number | null>(null);
  const [agent, setAgent] = useState<AgentPayload | null>(null);
  const [staleTick, setStaleTick] = useState(0);
  const [agentErr, setAgentErr] = useState<string | null>(null);

  const pullPreview = useCallback(async () => {
    try {
      if (EXHIBIT_PREVIEW_STREAM) {
        const res = await fetch("/api/exhibit/preview-faces", { cache: "no-store" });
        const j = (await res.json()) as {
          ok?: boolean;
          updatedAt?: number | null;
          faces?: ExhibitFaceBox[];
        };
        setPreviewFaces(Array.isArray(j.faces) ? j.faces : []);
        if (typeof j.updatedAt === "number") setPreviewAt(j.updatedAt);
        else setPreviewAt(null);
        return;
      }
      const res = await fetch("/api/exhibit/preview", { cache: "no-store" });
      const j = (await res.json()) as {
        ok?: boolean;
        dataUrl?: string | null;
        updatedAt?: number | null;
        faces?: ExhibitFaceBox[];
      };
      if (j.dataUrl) {
        setPollPreviewUrl(j.dataUrl);
        setPreviewFaces(Array.isArray(j.faces) ? j.faces : []);
        setPreviewAt(typeof j.updatedAt === "number" ? j.updatedAt : Date.now());
      }
    } catch {
      /* ignore */
    }
  }, []);

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
    void pullPreview();
    const ms = EXHIBIT_PREVIEW_STREAM ? FACES_POLL_MS : PREVIEW_POLL_MS;
    const i = window.setInterval(() => void pullPreview(), ms);
    return () => clearInterval(i);
  }, [pullPreview]);

  /** 브라우저 MJPEG 디코더 버퍼가 쌓이면 지연이 커짐 — 주기적으로 스트림 재연결 */
  useEffect(() => {
    if (!EXHIBIT_PREVIEW_STREAM) return;
    const id = window.setInterval(() => setStreamEpoch((e) => e + 1), 45_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    void pullAgent();
    const i = window.setInterval(() => void pullAgent(), AGENT_POLL_MS);
    return () => clearInterval(i);
  }, [pullAgent]);

  useEffect(() => {
    const id = window.setInterval(() => setStaleTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const previewStale = useMemo(() => {
    if (previewAt === null) return true;
    return Date.now() - previewAt > PREVIEW_STALE_MS;
  }, [previewAt, staleTick]);

  const sensor = agent?.last_sensor;
  const decision = agent?.last_decision;

  const captureLive = useMemo(() => {
    if (sensor?.capture_live === false) return false;
    if (previewAt === null) return false;
    return Date.now() - previewAt < CAPTURE_LIVE_MS;
  }, [sensor?.capture_live, previewAt, staleTick]);

  const presenceModeRaw: PresenceMode = parsePresenceMode(agent?.presence_mode);
  const presenceMode: PresenceMode = captureLive ? presenceModeRaw : "quiet_waiting";
  const sceneIdRaw = decision?.scene_id ?? "safe_neutral";
  const sceneId = captureLive ? sceneIdRaw : "calm_gallery";
  const detail = SCENE_DETAIL[sceneId] ?? SCENE_DETAIL.safe_neutral;

  const emotionKo = sensor?.emotion_state ? (EMOTION_KO[sensor.emotion_state] ?? sensor.emotion_state) : "—";

  const modeLine = agent?.visitor_manual_lock
    ? `태블릿에서 구역을 선택하는 중 · 약 ${Math.ceil(agent.visitor_manual_lock_remaining_sec ?? 0)}초 뒤 자동 연동으로 돌아갈 수 있습니다`
    : PREVIEW_FROM_HOST
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
    previewUrl,
    previewFaces,
    previewStale,
    previewFromHost: PREVIEW_FROM_HOST,
    previewStream: EXHIBIT_PREVIEW_STREAM,
    captureLive,
    previewPollMs: PREVIEW_POLL_MS,
    agent,
    agentErr,
    sensor,
    decision,
    sceneId,
    detail,
    emotionKo,
    modeLine,
    reasonText,
    manualLock: Boolean(agent?.visitor_manual_lock),
    manualRemainingSec: agent?.visitor_manual_lock_remaining_sec,
    presenceMode,
    exploreHotspotId,
    presenceDwellSec,
    crowdTier,
  };
}
