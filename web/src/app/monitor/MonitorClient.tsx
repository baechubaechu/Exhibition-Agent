"use client";

import { useRef } from "react";
import { MonitorExploreControls } from "@/components/MonitorExploreControls";
import { MonitorExploreDetail } from "@/components/MonitorExploreDetail";
import { MonitorExploreMedia } from "@/components/MonitorExploreMedia";
import { MonitorModeHero } from "@/components/MonitorModeHero";
import { MonitorOutputBoard } from "@/components/MonitorOutputBoard";
import { MonitorPreviewStage } from "@/components/MonitorPreviewStage";
import { MonitorVideoPreload } from "@/components/MonitorVideoPreload";
import { useExhibitSignageFeed } from "@/hooks/useExhibitSignageFeed";
import { useHostMonitorVideo } from "@/hooks/useHostMonitorVideo";
import { buildMonitorOutputs } from "@/lib/monitorOutputs";
import { buildMonitorStateSummary } from "@/lib/monitorStateSummary";
import { getMonitorZoneContent } from "@/lib/monitorZoneContent";

export default function MonitorClient() {
  const {
    previewUrl,
    previewFaces,
    previewVisible,
    previewFromHost,
    captureLive,
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
  /** 태블릿 핀 → 에이전트 explore — host 웹캠 captureLive 와 무관 */
  const isExplore = presenceMode === "explore" && exploreZone !== null;

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  /** host 캡처 탭 JPEG가 없을 때만 /monitor 에서 웹캠 직접 (충돌 방지) */
  const useLocalWebcam = previewFromHost && !isExplore && !previewVisible;
  const { live: localVideoLive } = useHostMonitorVideo(localVideoRef, useLocalWebcam);

  const states = buildMonitorStateSummary({
    presenceMode,
    sensor,
    crowdTier,
    manualLock,
    exploreHotspotId,
  });

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
              <MonitorPreviewStage
                previewUrl={useLocalWebcam ? null : previewUrl}
                previewVisible={useLocalWebcam ? localVideoLive : previewVisible}
                previewFromHost={previewFromHost}
                localVideoRef={useLocalWebcam ? localVideoRef : undefined}
                localVideoLive={localVideoLive}
                faceBoxes={previewFaces}
              />

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
