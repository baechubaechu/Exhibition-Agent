"use client";

import { MONITOR_ZONE_VIDEO_SRCS } from "@/lib/monitorZoneContent";

/** 전시일 preload — `public/videos/walk-h*.mp4` (HDMI 노트북 로컬 캐시) */
export function MonitorVideoPreload() {
  return (
    <div className="monitor-video-preload" aria-hidden="true">
      {MONITOR_ZONE_VIDEO_SRCS.map((src) => (
        <video key={src} src={src} preload="auto" muted playsInline />
      ))}
    </div>
  );
}
