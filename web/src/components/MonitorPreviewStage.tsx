"use client";

import type { RefObject } from "react";
import type { MonitorFaceBox } from "@/hooks/useHallLiveSensors";

export type { MonitorFaceBox };

type Props = {
  localVideoRef?: RefObject<HTMLVideoElement | null>;
  localVideoLive?: boolean;
  localVideoError?: string | null;
  faceBoxes?: MonitorFaceBox[];
};

export function MonitorPreviewStage({
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
            <div className="monitor-cam-mirror">
              <video ref={localVideoRef} className="monitor-cam" autoPlay muted playsInline />
              {faceBoxes.length > 0 && (localVideoLive || !localVideoError) ? (
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
            {!localVideoLive ? (
              <div
                className="monitor-cam-waiting"
                aria-busy={!localVideoError}
                aria-label={localVideoError ? "카메라 오류" : "Live view 연결 중"}
              >
                {localVideoError ? (
                  <p className="monitor-cam-waiting-err">{localVideoError}</p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="monitor-cam-waiting monitor-cam-waiting--idle" aria-hidden="true" />
        )}
      </div>
    </section>
  );
}
