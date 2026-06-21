"use client";

import { MONITOR_ZONE_PRELOAD_SRCS } from "@/lib/monitorZoneContent";

/** 전시일 preload — Explore 존 영상·이미지(HDMI 노트북 로컬 캐시) */
export function MonitorVideoPreload() {
  return (
    <div className="monitor-video-preload" aria-hidden="true">
      {MONITOR_ZONE_PRELOAD_SRCS.map((src) =>
        src.endsWith(".mp4") ? (
          <video key={src} src={src} preload="auto" muted playsInline />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={src} src={src} alt="" loading="eager" />
        ),
      )}
    </div>
  );
}
