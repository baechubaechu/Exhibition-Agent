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
import { EXHIBIT_POLL_INTERVAL_MS } from "@/lib/exhibitEventBusConstants";
import { publishExhibitSensor } from "@/lib/publishExhibitSensor";
import { buildMonitorOutputs } from "@/lib/monitorOutputs";
import { buildMonitorStateSummary } from "@/lib/monitorStateSummary";
import { getMonitorZoneContent } from "@/lib/monitorZoneContent";

export default function MonitorClient() {
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
  } = useExhibitSignageFeed();

  const exploreZone = getMonitorZoneContent(exploreHotspotId);
  const isExplore = presenceMode === "explore" && exploreZone !== null;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [busFallback, setBusFallback] = useState(0);

  useEffect(() => {
    if (!captureFromHost) return;
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
  }, [captureFromHost]);

  const publishSensor = useCallback(
    async (people: number, decibel: number, emotion?: HallEmotion, meta?: ExhibitSensorPublishMeta) => {
      const derived = classifyHallEmotion(people, decibel);
      await publishExhibitSensor("monitor-host-live", people, decibel, emotion ?? derived, meta);
    },
    [],
  );

  const { videoLive, captureError, lineHint } = useHallLiveSensors({
    enabled: captureFromHost,
    busPeopleFallback: busFallback,
    publishSensor,
    videoRef,
    captureProfile: "host",
    wantVideo: true,
  });

  const states = buildMonitorStateSummary({
    presenceMode,
    sensor,
    crowdTier,
    manualLock,
    exploreHotspotId,
  });

  const outputs = buildMonitorOutputs({ presenceMode, sceneId, decision });

  const showLivePanel = captureFromHost && !isExplore;

  return (
    <div className="xfloor-page monitor-page" data-surface="exhibition-monitor" data-presence-mode={presenceMode}>
      <MonitorVideoPreload />
      <div className="xfloor-linear xfloor-linear--tl" aria-hidden="true" />
      <div className="xfloor-linear xfloor-linear--br" aria-hidden="true" />

      <div className="xfloor-inner monitor-inner">
        <header className="monitor-brand-header">
          <p className="monitor-brand">X-tra Space</p>
          <h1 className="monitor-headline">환경 연동 상태</h1>
          {captureFromHost && lineHint ? (
            <p className="monitor-capture-hint" aria-live="polite">
              {lineHint}
            </p>
          ) : null}
        </header>

        <MonitorModeHero mode={presenceMode} states={states} />

        <main className={`monitor-main${isExplore ? " monitor-main--explore" : ""}`}>
          {isExplore && exploreZone ? (
            <>
              <MonitorExploreMedia zone={exploreZone} />
              <MonitorExploreDetail zone={exploreZone} />
            </>
          ) : (
            <>
              {showLivePanel ? (
                <MonitorPreviewStage
                  captureFromHost={captureFromHost}
                  localVideoRef={videoRef}
                  localVideoLive={videoLive}
                  localVideoError={captureError}
                />
              ) : null}

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
            </>
          )}
        </main>

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
      </div>
    </div>
  );
}
