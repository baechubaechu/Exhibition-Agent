"use client";

import { EXHIBIT_HOST_VIDEO_DEVICE_ID } from "@/lib/exhibitCaptureConfig";
import { useEffect, useState, type RefObject } from "react";

/** host 시연 — 같은 PC `/monitor` 에서 웹캠을 직접 띄움 (JPEG 업로드·폴링 없음) */
export function useHostMonitorVideo(videoRef: RefObject<HTMLVideoElement | null>, enabled: boolean) {
  const [live, setLive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    let dead = false;
    let stream: MediaStream | null = null;

    const stop = () => {
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };

    void (async () => {
      try {
        const video: MediaTrackConstraints = EXHIBIT_HOST_VIDEO_DEVICE_ID
          ? {
              deviceId: { exact: EXHIBIT_HOST_VIDEO_DEVICE_ID },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            }
          : { width: { ideal: 1280 }, height: { ideal: 720 } };

        stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
        if (dead) {
          stop();
          return;
        }
        const el = videoRef.current;
        if (el) {
          el.srcObject = stream;
          await el.play().catch(() => {});
        }
        if (!dead) {
          setLive(true);
          setError(null);
        }
      } catch (e) {
        if (!dead) {
          setLive(false);
          setError(e instanceof Error ? e.message : String(e));
        }
      }
    })();

    return () => {
      dead = true;
      stop();
      setLive(false);
    };
  }, [enabled, videoRef]);

  return { live, error };
}
