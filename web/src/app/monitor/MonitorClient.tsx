"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MonitorExploreControls } from "@/components/MonitorExploreControls";
import { MonitorExploreDetail } from "@/components/MonitorExploreDetail";
import { MonitorExploreMedia } from "@/components/MonitorExploreMedia";
import { MonitorModeHero } from "@/components/MonitorModeHero";
import { MonitorOutputBoard } from "@/components/MonitorOutputBoard";
import { MonitorPreviewStage } from "@/components/MonitorPreviewStage";
import { MonitorVideoPreload } from "@/components/MonitorVideoPreload";
import { useExhibitSignageFeed } from "@/hooks/useExhibitSignageFeed";
import {
  classifyHallEmotion,
  useHallLiveSensors,
  type ExhibitSensorPublishMeta,
  type HallEmotion,
} from "@/hooks/useHallLiveSensors";
import { EXHIBIT_CAPTURE_SOURCE } from "@/lib/exhibitCaptureConfig";
import { EXHIBIT_POLL_INTERVAL_MS } from "@/lib/exhibitEventBusConstants";
import { publishExhibitSensor } from "@/lib/publishExhibitSensor";
import { buildMonitorOutputs } from "@/lib/monitorOutputs";
import { buildMonitorStateSummary } from "@/lib/monitorStateSummary";
import { getMonitorZoneContent } from "@/lib/monitorZoneContent";

const CAPTURE_FROM_HOST = EXHIBIT_CAPTURE_SOURCE === "host";

export default function MonitorClient() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [busFallback, setBusFallback] = useState(0);

  const publishSensor = useCallback(
    async (people: number, decibel: number, emotion?: HallEmotion, meta?: ExhibitSensorPublishMeta) => {
      const derived = classifyHallEmotion(people, decibel);
      await publishExhibitSensor("monitor-host-live", people, decibel, emotion ?? derived, meta);
    },
    [],
  );

  const {
    videoLive,
    captureError,
    faceBoxes,
    localPeopleCount,
    avgDecibel,
    visionRuntimeEnabled,
    visionBackendOff,
    visionAnalyzeError,
  } = useHallLiveSensors({
    enabled: CAPTURE_FROM_HOST,
    busPeopleFallback: busFallback,
    publishSensor,
    videoRef,
    captureProfile: "host",
    wantVideo: true,
    livePanelVisible: true,
  });

  const {
    captureFromHost,
    agentErr,
    sensor,
    decision,
    sceneId,
    manualLock,
    presenceMode,
    exploreHotspotId,
    crowdTier,
    manualRemainingSec,
  } = useExhibitSignageFeed({
    hostLive: CAPTURE_FROM_HOST
      ? { videoLive, peopleCount: localPeopleCount, decibel: avgDecibel }
      : null,
    fastAgentPoll: true,
  });

  const exploreZone = getMonitorZoneContent(exploreHotspotId);
  const isExplore =
    exploreZone !== null && (presenceMode === "explore" || manualLock || Boolean(exploreHotspotId));
  const hideFooterCta = isExplore;

  useEffect(() => {
    if (!CAPTURE_FROM_HOST) return;
    let mounted = true;
    const poll = async () => {
      try {
        const res = await fetch("/api/events/state", { cache: "no-store" });
        if (!res.ok || !mounted) return;
        const j = (await res.json()) as {
          latest?: Partial<Record<string, { payload: Record<string, unknown> }>>;
        };
        const p = j.latest?.["sensor.state"]?.payload;
        const n = p?.peopleCount;
        if (typeof n === "number") setBusFallback(Math.min(300, Math.max(0, n)));
      } catch {
        /* ignore */
      }
    };
    void poll();
    const id = window.setInterval(() => void poll(), EXHIBIT_POLL_INTERVAL_MS);
    return () => {
      mounted = false;
      window.clearInterval(id);
    };
  }, []);

  const states = buildMonitorStateSummary({
    presenceMode,
    sensor,
    crowdTier,
    manualLock,
    exploreHotspotId,
  });

  const visionHint =
    captureFromHost && visionAnalyzeError
      ? `비전 분석 실패: ${visionAnalyzeError} — FastAPI(8000) 로그·GOOGLE_APPLICATION_CREDENTIALS·웹캠 준비 상태를 확인하세요.`
      : captureFromHost && visionRuntimeEnabled && visionBackendOff
        ? "브라우저 비전은 켜져 있으나 FastAPI USE_VISION_API=false — 인원·Crowd가 0으로 나옵니다. 루트 .env 에 USE_VISION_API=true 후 uvicorn 재시작."
        : captureFromHost && !visionRuntimeEnabled
          ? "NEXT_PUBLIC_ENABLE_VISION_RUNTIME=true 로 켜면 얼굴·Crowd가 연동됩니다."
          : null;

  const outputs = buildMonitorOutputs({ presenceMode, sceneId, decision });

  return (
    <div className="xfloor-page monitor-page" data-surface="exhibition-monitor" data-presence-mode={presenceMode}>
      <MonitorVideoPreload />
      <div className="xfloor-linear xfloor-linear--tl" aria-hidden="true" />
      <div className="xfloor-linear xfloor-linear--br" aria-hidden="true" />

      <div className="xfloor-inner monitor-inner">
        <header className="monitor-brand-header">
          <p className="monitor-brand">X-tra Space</p>
          <h1 className="monitor-headline">환경 연동 상태</h1>
          {visionHint ? (
            <p className="monitor-capture-hint" role="status">
              {visionHint}
            </p>
          ) : null}
        </header>

        <MonitorModeHero mode={presenceMode} states={states} />

        <main className={`monitor-main${isExplore ? " monitor-main--explore" : ""}`}>
          {captureFromHost ? (
            <div
              className={isExplore ? "monitor-live-persist monitor-live-persist--hidden" : "monitor-live-persist"}
              aria-hidden={isExplore}
            >
              <MonitorPreviewStage
                localVideoRef={videoRef}
                localVideoLive={videoLive}
                localVideoError={captureError}
                faceBoxes={faceBoxes}
              />
            </div>
          ) : null}

          {isExplore && exploreZone ? (
            <>
              <MonitorExploreMedia zone={exploreZone} />
              <MonitorExploreDetail zone={exploreZone} />
            </>
          ) : (
            <section className="monitor-panel monitor-panel--signals" aria-label="출력 연출">
              <h2 className="monitor-panel-title">Space response</h2>
              <p className="monitor-panel-lead">조명·모형 LED·ambient·모니터에 지금 적용 중인 연출입니다.</p>
              <div className="xfloor-status monitor-signals-card">
                <MonitorOutputBoard rows={outputs} />
              </div>
              <MonitorExploreControls
                hotspotId={exploreHotspotId}
                manualRemainingSec={manualLock ? manualRemainingSec : null}
                agentErr={agentErr}
              />
            </section>
          )}
        </main>

        {!hideFooterCta ? (
          <footer className="monitor-cta">
            <div className="monitor-cta-inner monitor-cta-blink">
              <span className="monitor-cta-arrow" aria-hidden="true">
                ↓
              </span>
              <div className="monitor-cta-text">
                <p className="monitor-cta-ko">태블릿을 터치하면 공간을 탐색할 수 있습니다</p>
                <p className="monitor-cta-en">Touch the tablet to explore the space.</p>
              </div>
            </div>
          </footer>
        ) : null}
      </div>
    </div>
  );
}
