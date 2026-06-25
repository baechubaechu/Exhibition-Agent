"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MonitorExploreDetail } from "@/components/MonitorExploreDetail";
import { MonitorExploreMedia } from "@/components/MonitorExploreMedia";
import { MonitorModeHero } from "@/components/MonitorModeHero";
import { MonitorPreviewStage } from "@/components/MonitorPreviewStage";
import { MonitorSituationBriefPanel } from "@/components/MonitorSituationBrief";
import { MonitorSpacePreview } from "@/components/MonitorSpacePreview";
import { MonitorVideoPreload } from "@/components/MonitorVideoPreload";
import { useExhibitSignageFeed } from "@/hooks/useExhibitSignageFeed";
import { useMonitorExploreBus } from "@/hooks/useMonitorExploreBus";
import {
  classifyHallEmotion,
  useHallLiveSensors,
  type ExhibitSensorPublishMeta,
  type HallEmotion,
} from "@/hooks/useHallLiveSensors";
import { EXHIBIT_CAPTURE_SOURCE } from "@/lib/exhibitCaptureConfig";
import { publishExhibitSensor } from "@/lib/publishExhibitSensor";
import { useStableSpacePreview } from "@/hooks/useStableSpacePreview";
import { buildMonitorSituationBrief } from "@/lib/monitorSituationBrief";
import { buildMonitorStateSummary } from "@/lib/monitorStateSummary";
import { resolveSpacePreview } from "@/lib/monitorSpacePreview";
import { getMonitorZoneContent } from "@/lib/monitorZoneContent";
import { networkErrorMessageKo, visionReachabilityMessageKo } from "@/lib/networkStatus";

const CAPTURE_FROM_HOST = EXHIBIT_CAPTURE_SOURCE === "host";

export default function MonitorClient() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [explorePause, setExplorePause] = useState(false);

  const {
    exploreHotspotId: busExploreHotspotId,
    peopleCountFallback,
    busReady,
  } = useMonitorExploreBus();

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
    networkOffline,
  } = useHallLiveSensors({
    enabled: CAPTURE_FROM_HOST,
    busPeopleFallback: peopleCountFallback,
    publishSensor,
    videoRef,
    captureProfile: "host",
    wantVideo: true,
    livePanelVisible: !explorePause,
    pauseVideoHealthCheck: explorePause,
    pauseSensorPublish: explorePause,
  });

  const {
    captureFromHost,
    captureLive,
    sensor,
    sceneId,
    manualLock: agentManualLock,
    presenceMode,
    exploreHotspotId: agentExploreHotspotId,
    crowdTier,
  } = useExhibitSignageFeed({
    hostLive: CAPTURE_FROM_HOST
      ? { videoLive, peopleCount: localPeopleCount, decibel: avgDecibel }
      : null,
    fastAgentPoll: true,
  });

  // 버스가 준비되면 Explore 핫스pot 은 버스(빠르고 신선도 만료 포함)를 권위로,
  // 준비 전에만 에이전트 값으로 폴백 → reset 직후 깜빡임 방지.
  const exploreHotspotId = busReady ? busExploreHotspotId : agentExploreHotspotId;
  const manualLock = Boolean(busExploreHotspotId) || agentManualLock;

  const exploreZone = getMonitorZoneContent(exploreHotspotId);
  const isExplore = exploreZone !== null && (presenceMode === "explore" || Boolean(exploreHotspotId));
  const hideFooterCta = isExplore;

  useEffect(() => {
    setExplorePause(isExplore);
  }, [isExplore]);

  const states = buildMonitorStateSummary({
    presenceMode,
    sensor,
    crowdTier,
    manualLock,
    exploreHotspotId,
  });

  const visionHint =
    captureFromHost && networkOffline
      ? networkErrorMessageKo()
      : captureFromHost && visionAnalyzeError
        ? visionReachabilityMessageKo(visionAnalyzeError)
        : captureFromHost && visionRuntimeEnabled && visionBackendOff
          ? "브라우저 비전은 켜져 있으나 FastAPI USE_VISION_API=false — 인원·Crowd가 0으로 나옵니다. 루트 .env 에 USE_VISION_API=true 후 uvicorn 재시작."
          : captureFromHost && !visionRuntimeEnabled
            ? "NEXT_PUBLIC_ENABLE_VISION_RUNTIME=true 로 켜면 얼굴·Crowd가 연동됩니다."
            : !captureFromHost
              ? "Live view는 노트북 웹캠(host) 모드에서만 표시됩니다. web/.env.local 에 NEXT_PUBLIC_EXHIBIT_CAPTURE_SOURCE=host 를 확인하세요."
              : null;

  const effectivePeople = Math.max(localPeopleCount, sensor?.people_count ?? 0);
  const effectiveDecibel =
    typeof avgDecibel === "number" ? avgDecibel : typeof sensor?.decibel === "number" ? sensor.decibel : 40;

  const spacePreviewRaw = useMemo(
    () =>
      resolveSpacePreview({
        presenceMode,
        sceneId,
        emotion: sensor?.emotion_state,
        decibel: effectiveDecibel,
        peopleCount: effectivePeople,
      }),
    [presenceMode, sceneId, sensor?.emotion_state, effectiveDecibel, effectivePeople],
  );

  const spacePreview = useStableSpacePreview(spacePreviewRaw);

  const situationBrief = useMemo(
    () =>
      buildMonitorSituationBrief({
        presenceMode,
        sensor,
        exploreHotspotLabel: exploreZone?.label ?? null,
        isExplore,
        captureLive,
      }),
    [presenceMode, sensor, exploreZone?.label, isExplore, captureLive],
  );

  return (
    <div className="xfloor-page monitor-page" data-surface="exhibition-monitor" data-presence-mode={presenceMode}>
      <MonitorVideoPreload />
      <div className="xfloor-linear xfloor-linear--tl" aria-hidden="true" />
      <div className="xfloor-linear xfloor-linear--br" aria-hidden="true" />

      <div className="xfloor-inner monitor-inner">
        <header className="monitor-brand-header">
          <p className="monitor-brand">X-tra Space</p>
          {visionHint ? (
            <p
              className={`monitor-capture-hint${networkOffline ? " monitor-capture-hint--warn" : ""}`}
              role="status"
            >
              {visionHint}
            </p>
          ) : null}
        </header>

        <MonitorModeHero mode={presenceMode} states={states} />

        {!isExplore ? <MonitorSituationBriefPanel {...situationBrief} /> : null}

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
            <section className="monitor-panel monitor-panel--signals" aria-label="공간 반응">
              <h2 className="monitor-panel-title">Space response</h2>
              <MonitorSpacePreview {...spacePreview} />
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
                <p className="monitor-cta-ko">태블릿을 조작하면 공간을 탐색할 수 있습니다</p>
                <p className="monitor-cta-en">Operate the tablet to explore the space.</p>
              </div>
            </div>
          </footer>
        ) : null}
      </div>
    </div>
  );
}
