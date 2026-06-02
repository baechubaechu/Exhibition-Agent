"use client";

import type { MonitorZoneContent } from "@/lib/monitorZoneContent";

export type NormalizedFaceBox = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type Props = {
  mode?: "live" | "explore";
  previewUrl: string | null;
  previewVisible: boolean;
  previewFromHost: boolean;
  previewStream?: boolean;
  faceBoxes: NormalizedFaceBox[];
  zone?: MonitorZoneContent | null;
};

export function MonitorPreviewStage({
  mode = "live",
  previewUrl,
  previewVisible,
  previewFromHost,
  previewStream = false,
  faceBoxes,
  zone,
}: Props) {
  const showExplore = mode === "explore" && zone;
  const showLive = mode === "live" && previewVisible && Boolean(previewUrl);

  return (
    <section className="monitor-panel monitor-panel--visual" aria-label={showExplore ? "구역 동선 영상" : "현장 영상"}>
      <h2 className="monitor-panel-title">{showExplore ? "Explore" : "Live view"}</h2>
      <div className="xfloor-map-wrap monitor-visual-frame">
        {showExplore ? (
          <div className="monitor-cam-stage monitor-explore-stage">
            <video
              key={zone.videoSrc}
              className="monitor-zone-video"
              src={zone.videoSrc}
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
            />
            <div className="monitor-explore-caption">
              <p className="monitor-explore-title">{zone.titleKo}</p>
              <p className="monitor-explore-body">{zone.bodyKo}</p>
            </div>
          </div>
        ) : showLive ? (
          <div className="monitor-cam-stage">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl!}
              alt=""
              className="monitor-cam"
              decoding="async"
              fetchPriority="high"
            />
            {faceBoxes.length > 0 ? (
              <div className="monitor-face-layer" aria-hidden="true">
                {faceBoxes.map((box, i) => (
                  <span
                    key={i}
                    className="monitor-face-box"
                    style={{
                      left: `${box.x * 100}%`,
                      top: `${box.y * 100}%`,
                      width: `${box.w * 100}%`,
                      height: `${box.h * 100}%`,
                    }}
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="xfloor-pdf-loading monitor-cam-placeholder">
            <div>
              <p className="monitor-cam-placeholder-title">현장 영상 대기 중</p>
              <p className="xfloor-status-row--hint monitor-cam-placeholder-hint">
                {previewFromHost
                  ? "웹캠 캡처가 켜지면 얼굴 인식 테두리와 함께 표시됩니다."
                  : "태블릿 카메라가 연결되면 얼굴 인식 테두리와 함께 표시됩니다."}
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
