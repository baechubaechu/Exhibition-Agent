"use client";

import type { RefObject } from "react";
import type { MonitorFaceBox } from "@/hooks/useHallLiveSensors";

export type { MonitorFaceBox };

type Props = {
  captureFromHost: boolean;
  /** host + 같은 PC — `/monitor` 로컬 `<video>` */
  localVideoRef?: RefObject<HTMLVideoElement | null>;
  localVideoLive?: boolean;
  localVideoError?: string | null;
  faceBoxes?: MonitorFaceBox[];
};

export function MonitorPreviewStage({
  captureFromHost,
  localVideoRef,
  localVideoLive = false,
  localVideoError = null,
  faceBoxes = [],
}: Props) {
  const wantsLocal = Boolean(localVideoRef);
  const showFrame = wantsLocal;

  return (
    <section className="monitor-panel monitor-panel--visual" aria-label="현장 영상">
      <h2 className="monitor-panel-title">Live view</h2>
      <div className="xfloor-map-wrap monitor-visual-frame">
        {showFrame ? (
          <div className="monitor-cam-stage">
            <video ref={localVideoRef} className="monitor-cam" autoPlay muted playsInline />
            {localVideoLive && faceBoxes.length > 0 ? (
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
            {!localVideoLive ? (
              <div className="xfloor-pdf-loading monitor-cam-placeholder monitor-cam-placeholder--overlay">
                <div>
                  <p className="monitor-cam-placeholder-title">
                    {localVideoError ? "카메라를 열 수 없습니다" : "카메라 연결 중…"}
                  </p>
                  <p className="xfloor-status-row--hint monitor-cam-placeholder-hint">
                    {localVideoError
                      ? localVideoError
                      : "브라우저에서 카메라 권한을 허용해 주세요."}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="xfloor-pdf-loading monitor-cam-placeholder">
            <div>
              <p className="monitor-cam-placeholder-title">현장 영상 대기 중</p>
              <p className="xfloor-status-row--hint monitor-cam-placeholder-hint">
                {captureFromHost
                  ? "카메라 권한을 허용하면 이 화면에 바로 표시됩니다."
                  : "host 모드(`NEXT_PUBLIC_EXHIBIT_CAPTURE_SOURCE=host`)에서 /monitor 는 노트북 웹캠을 직접 표시합니다."}
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
