"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FloorPlanDualPdfViewer } from "@/components/FloorPlanDualPdfViewer";
import { FloorPlanSvgViewer } from "@/components/FloorPlanSvgViewer";
import { FloorPlanLabelIslands } from "@/components/FloorPlanLabelIslands";
import { FloorMonitorHandoffOverlay } from "@/components/FloorMonitorHandoffOverlay";
import { FloorQrChatbotHintOverlay } from "@/components/FloorQrChatbotHintOverlay";
import type { FloorPlanViewerHandle } from "@/lib/floorPlanViewerHandle";
import {
  initialTabletPlanMode,
  tabletFloorPdfSrc,
  tabletPlanSvgSrc,
  tabletSitePdfSrc,
  type TabletPlanMode,
} from "@/lib/tabletPlanConfig";
import {
  classifyHallEmotion,
  useHallLiveSensors,
  type ExhibitSensorPublishMeta,
  type HallEmotion,
} from "@/hooks/useHallLiveSensors";
import { publishExhibitSensor } from "@/lib/publishExhibitSensor";
import type { FloorHotspot, HotspotMeta } from "@/lib/floorPlanHotspots";
import { EXHIBIT_CAPTURE_SOURCE } from "@/lib/exhibitCaptureConfig";
import { EXHIBIT_POLL_INTERVAL_MS } from "@/lib/exhibitEventBusConstants";

const HOST_REMOTE_SENSORS = EXHIBIT_CAPTURE_SOURCE === "host";
const TABLET_CAPTURE = EXHIBIT_CAPTURE_SOURCE === "tablet";

const TABLET_PLAN_SVG = tabletPlanSvgSrc();
const TABLET_SITE_PDF = tabletSitePdfSrc();
const TABLET_FLOOR_PDF = tabletFloorPdfSrc();

/** Explore 씬 최대 유지(초) — holdSec·에이전트 manual lock·Explore idle 과 맞춤 */
const MANUAL_RESUME_SEC = 60;
/** 미터치 시 도면·Explore·씬 전부 초기화 (일반) */
const TABLET_IDLE_RESET_MS = 30 * 1000;
/** Explore 씬 재생 중 미터치 초기화 — 씬 유지 시간과 동일 */
const TABLET_IDLE_RESET_EXPLORE_MS = MANUAL_RESUME_SEC * 1000;
/** QR 챗봇 안내 — 자동 닫힘 */
const QR_HINT_AUTO_DISMISS_MS = 8 * 1000;

type EventStateResponse = {
  seq: number;
  queueSize: number;
  services: Array<{
    service: string;
    status: "ok" | "degraded" | "down";
    effectiveStatus: "ok" | "degraded" | "down";
    detail?: string;
    at: string;
    ageMs: number;
    stale: boolean;
  }>;
  latest: Partial<Record<string, { payload: Record<string, unknown>; envelope: { timestamp: string } }>>;
};

export default function ExhibitFloorClient() {
  const [state, setState] = useState<EventStateResponse | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [lastHotspotId, setLastHotspotId] = useState<string | null>(null);
  const [handoffSpot, setHandoffSpot] = useState<HotspotMeta | null>(null);
  const [qrHintOpen, setQrHintOpen] = useState(false);
  const [mapLodIndex, setMapLodIndex] = useState(0);
  const [planMode] = useState<TabletPlanMode>(() => initialTabletPlanMode());
  const [hallSource, setHallSource] = useState<"live" | "manual">("live");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qrHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qrHintDismissedRef = useRef(false);
  const mapViewerRef = useRef<FloorPlanViewerHandle | null>(null);
  const lastTouchAtRef = useRef(Date.now());
  const resetFloorViewRef = useRef<() => Promise<void>>(async () => {});
  const exploreSceneActiveRef = useRef(false);

  const exploreSceneActive = hallSource === "manual" && lastHotspotId !== null;
  exploreSceneActiveRef.current = exploreSceneActive;

  const bumpTouchActivity = useCallback(() => {
    lastTouchAtRef.current = Date.now();
  }, []);

  const handleMapLodChange = useCallback((lodIndex: number) => {
    setMapLodIndex(lodIndex);
  }, []);

  const clearResumeTimer = useCallback(() => {
    if (resumeTimerRef.current !== null) {
      clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
  }, []);

  const clearQrHintTimer = useCallback(() => {
    if (qrHintTimerRef.current !== null) {
      clearTimeout(qrHintTimerRef.current);
      qrHintTimerRef.current = null;
    }
  }, []);

  const dismissQrHint = useCallback(() => {
    qrHintDismissedRef.current = true;
    clearQrHintTimer();
    setQrHintOpen(false);
  }, [clearQrHintTimer]);

  const openQrHint = useCallback(() => {
    if (qrHintDismissedRef.current) return;
    clearQrHintTimer();
    setQrHintOpen(true);
    qrHintTimerRef.current = setTimeout(() => {
      qrHintTimerRef.current = null;
      qrHintDismissedRef.current = true;
      setQrHintOpen(false);
    }, QR_HINT_AUTO_DISMISS_MS);
  }, [clearQrHintTimer]);

  const startManualTimer = useCallback(
    (holdSec: number) => {
      clearResumeTimer();
      setHallSource("manual");
      resumeTimerRef.current = setTimeout(() => {
        resumeTimerRef.current = null;
        lastTouchAtRef.current = Date.now();
        mapViewerRef.current?.resetView();
      }, holdSec * 1000);
    },
    [clearResumeTimer],
  );

  useEffect(() => {
    let mounted = true;
    const tickPoll = async () => {
      try {
        const res = await fetch("/api/events/state", { cache: "no-store" });
        if (!res.ok || !mounted) return;
        setState((await res.json()) as EventStateResponse);
      } catch {
        /* ignore */
      }
    };
    void tickPoll();
    const id = setInterval(() => void tickPoll(), EXHIBIT_POLL_INTERVAL_MS);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  const envSvc = useMemo(() => state?.services.find((s) => s.service === "exhibition-agent"), [state]);

  const envSummary = useMemo(() => {
    if (!envSvc) {
      return { pill: "unknown" as const, line: "에이전트 하트비트 없음(이벤트 브리지·에이전트 기동 확인)." };
    }
    const sec = Math.max(0, Math.round(envSvc.ageMs / 1000));
    const staleNote = envSvc.stale ? " · 신호 지연" : "";
    const detail = envSvc.detail ? ` · ${envSvc.detail}` : "";
    return {
      pill: envSvc.effectiveStatus,
      line: `마지막 보고 ${sec}초 전${staleNote}${detail}`,
    };
  }, [envSvc]);

  const busPeopleFallback = useMemo(() => {
    const s = state?.latest?.["sensor.state"]?.payload;
    if (s && typeof s.peopleCount === "number") return Math.min(300, Math.max(0, s.peopleCount));
    return 0;
  }, [state]);

  const sensorSnap = useMemo(() => {
    const p = state?.latest?.["sensor.state"]?.payload;
    if (!p) return null;
    return {
      decibel: typeof p.decibel === "number" ? p.decibel : null,
      peopleCount: typeof p.peopleCount === "number" ? p.peopleCount : null,
    };
  }, [state]);

  const publishSensor = useCallback(
    async (people: number, decibel: number, emotion?: HallEmotion, meta?: ExhibitSensorPublishMeta) => {
      const derived = classifyHallEmotion(people, decibel);
      await publishExhibitSensor("control-exhibit-live", people, decibel, emotion ?? derived, meta);
    },
    [],
  );

  const { avgDecibel } = useHallLiveSensors({
    /** 태블릿 캡처: 핫스pot(수동) 중에도 센서 유지 */
    enabled: TABLET_CAPTURE || (hallSource === "live" && !HOST_REMOTE_SENSORS),
    busPeopleFallback,
    publishSensor,
    videoRef,
    captureProfile: "tablet",
  });

  const displayDecibel =
    HOST_REMOTE_SENSORS && hallSource === "live"
      ? sensorSnap?.decibel
      : avgDecibel;

  const resetFloorView = useCallback(async () => {
    bumpTouchActivity();
    const wasExplore = hallSource === "manual" || lastHotspotId !== null;
    if (wasExplore) {
      try {
        await fetch("/api/events/recover", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetZone: "all", reason: "visitor:reset" }),
        });
      } catch {
        /* ignore */
      }
    }
    setQrHintOpen(false);
    clearQrHintTimer();
    qrHintDismissedRef.current = false;
    setHandoffSpot(null);
    setLastHotspotId(null);
    clearResumeTimer();
    setHallSource("live");
  }, [bumpTouchActivity, clearQrHintTimer, clearResumeTimer, hallSource, lastHotspotId]);

  resetFloorViewRef.current = resetFloorView;

  const selectHotspot = useCallback(
    async (spot: FloorHotspot) => {
      bumpTouchActivity();
      const meta: HotspotMeta = {
        id: spot.id,
        label: spot.label,
        sceneId: spot.sceneId,
        targetZone: spot.targetZone,
      };
      clearQrHintTimer();
      qrHintDismissedRef.current = false;
      setQrHintOpen(false);
      setLastHotspotId(spot.id);
      setHandoffSpot(meta);
      startManualTimer(MANUAL_RESUME_SEC);
      setBusyId(spot.id);

      try {
        const res = await fetch("/api/events/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic: "scene.execute",
            source: "control-exhibit-floor-map",
            payload: {
              sceneId: spot.sceneId,
              reason: `floor_hotspot:${spot.id}`,
              holdSec: MANUAL_RESUME_SEC,
              targetZone: spot.targetZone,
            },
          }),
        });
        if (!res.ok) {
          clearResumeTimer();
          setHallSource("live");
          setHandoffSpot(null);
          setLastHotspotId(null);
        }
      } catch {
        clearResumeTimer();
        setHallSource("live");
        setHandoffSpot(null);
        setLastHotspotId(null);
      } finally {
        setBusyId(null);
      }
    },
    [bumpTouchActivity, clearQrHintTimer, clearResumeTimer, startManualTimer],
  );

  const dismissHandoff = useCallback(() => {
    bumpTouchActivity();
    setHandoffSpot(null);
    if (!qrHintDismissedRef.current) {
      openQrHint();
    }
  }, [bumpTouchActivity, openQrHint]);

  useEffect(() => {
    const tick = () => {
      const idleMs = exploreSceneActiveRef.current
        ? TABLET_IDLE_RESET_EXPLORE_MS
        : TABLET_IDLE_RESET_MS;
      if (Date.now() - lastTouchAtRef.current < idleMs) return;
      lastTouchAtRef.current = Date.now();
      if (mapViewerRef.current) {
        mapViewerRef.current.resetView();
      } else {
        void resetFloorViewRef.current();
      }
    };
    tick();
    const id = window.setInterval(tick, 2000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => () => {
    clearResumeTimer();
    clearQrHintTimer();
  }, [clearQrHintTimer, clearResumeTimer]);

  useEffect(() => {
    document.documentElement.classList.add("xfloor-fullscreen");
    document.body.classList.add("xfloor-fullscreen");
    return () => {
      document.documentElement.classList.remove("xfloor-fullscreen");
      document.body.classList.remove("xfloor-fullscreen");
    };
  }, []);

  return (
    <div className="xfloor-page xfloor-page--fill">
      <video ref={videoRef} className="xfloor-hidden-video" playsInline muted autoPlay />

      <div
        className="xfloor-map-wrap xfloor-map-wrap--fill"
        onPointerDownCapture={bumpTouchActivity}
      >
        {planMode === "dual-pdf" ? (
          <FloorPlanDualPdfViewer
            ref={mapViewerRef}
            siteSrc={TABLET_SITE_PDF}
            floorSrc={TABLET_FLOOR_PDF}
            activeHotspotId={lastHotspotId}
            exploreActive={hallSource === "manual" && lastHotspotId !== null}
            busy={busyId !== null}
            onHotspotClick={(spot) => void selectHotspot(spot)}
            onReset={resetFloorView}
            onMapInteract={bumpTouchActivity}
            onLodChange={handleMapLodChange}
          />
        ) : (
          <FloorPlanSvgViewer
            ref={mapViewerRef}
            src={TABLET_PLAN_SVG}
            activeHotspotId={lastHotspotId}
            exploreActive={hallSource === "manual" && lastHotspotId !== null}
            busy={busyId !== null}
            onHotspotClick={(spot) => void selectHotspot(spot)}
            onReset={resetFloorView}
            onMapInteract={bumpTouchActivity}
            onLodChange={handleMapLodChange}
          />
        )}

        <FloorPlanLabelIslands floorActive={mapLodIndex >= 1} />

        <p
          className={`xfloor-zoom-hint${mapLodIndex < 2 ? " is-intro" : ""}`}
          role="status"
          aria-live="polite"
        >
          {mapLodIndex >= 2 ? "버튼을 눌러보세요" : "확대해 보세요"}
        </p>

        <FloorMonitorHandoffOverlay spot={handoffSpot} onDismiss={dismissHandoff} />
        <FloorQrChatbotHintOverlay open={qrHintOpen} onDismiss={dismissQrHint} />
      </div>

      <p className="xfloor-sr-only" aria-live="polite">
        환경 연동 {envSummary.pill}. {envSummary.line}
        {hallSource === "live" && typeof displayDecibel === "number" ? ` 약 ${displayDecibel.toFixed(0)} dB.` : ""}
      </p>
    </div>
  );
}
