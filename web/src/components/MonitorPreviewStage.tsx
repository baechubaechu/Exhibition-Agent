"use client";

import type { RefObject } from "react";

export type NormalizedFaceBox = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type Props = {
  previewUrl: string | null;
  previewVisible: boolean;
  previewFromHost: boolean;
  /** host + 같은 PC — `/host-exhibit-capture` JPEG 없을 때만 로컬 `<video>` */
  localVideoRef?: RefObject<HTMLVideoElement | null>;
  localVideoLive?: boolean;
  faceBoxes: NormalizedFaceBox[];
};

export function MonitorPreviewStage({
  previewUrl,
  previewVisible,
  previewFromHost,
  localVideoRef,
  localVideoLive = false,
  faceBoxes,
}: Props) {
  const useLocalVideo = Boolean(localVideoRef && localVideoLive);
  const showLive = useLocalVideo || (previewVisible && Boolean(previewUrl));

  return (
    <section className="monitor-panel monitor-panel--visual" aria-label="현장 영상">
      <h2 className="monitor-panel-title">Live view</h2>
      <div className="xfloor-map-wrap monitor-visual-frame">
        {showLive ? (
          <div className="monitor-cam-stage">
            {useLocalVideo ? (
              <video ref={localVideoRef} className="monitor-cam" autoPlay muted playsInline />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={previewUrl!} alt="" className="monitor-cam" decoding="async" fetchPriority="high" />
            )}
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
                  ? useLocalVideo
                    ? "카메라 권한을 허용하면 이 화면에 바로 표시됩니다."
                    : "노트북에서 /host-exhibit-capture 탭을 열어 웹캠 캡처를 시작하세요."
                  : "태블릿 카메라가 연결되면 얼굴 인식 테두리와 함께 표시됩니다."}
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
