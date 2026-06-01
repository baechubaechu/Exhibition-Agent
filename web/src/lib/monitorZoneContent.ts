/** 태블릿 핫스pot → HDMI 모니터 Explore (동선 영상·설명) */

export type MonitorZoneContent = {
  hotspotId: string;
  label: string;
  /** `web/public/videos/` 아래 MP4 — faststart H.264 권장 */
  videoSrc: string;
  titleKo: string;
  titleEn: string;
  bodyKo: string;
  bodyEn: string;
};

export const MONITOR_ZONE_CONTENT: MonitorZoneContent[] = [
  {
    hotspotId: "h1",
    label: "전실",
    videoSrc: "/videos/walk-h1.mp4",
    titleKo: "전실 · 입구 동선",
    titleEn: "Antechamber · Entry path",
    bodyKo: "입구에서 전시장으로 들어오는 동선입니다. 메인 모형 전실을 따라 걸어갑니다.",
    bodyEn: "The path from the entry into the exhibition hall, along the main model antechamber.",
  },
  {
    hotspotId: "h2",
    label: "코어",
    videoSrc: "/videos/walk-h2.mp4",
    titleKo: "코어 · 중심부",
    titleEn: "Core · Central volume",
    bodyKo: "단면 모형의 코어를 중심으로 공간이 모입니다.",
    bodyEn: "The space gathers around the core of the sectional model.",
  },
  {
    hotspotId: "h3",
    label: "동선",
    videoSrc: "/videos/walk-h3.mp4",
    titleKo: "동선 · Walking Layer",
    titleEn: "Circulation · Walking layer",
    bodyKo: "조용할 때 강조되는 층간 동선을 따라 이동합니다.",
    bodyEn: "Movement along the walking layer emphasized in calm conditions.",
  },
  {
    hotspotId: "h4",
    label: "후면",
    videoSrc: "/videos/walk-h4.mp4",
    titleKo: "후면 · X-Cross",
    titleEn: "Rear · X-Cross",
    bodyKo: "소음이 클 때 시각적으로 강조되는 X 교차 지점입니다.",
    bodyEn: "The X-cross junction highlighted visually when the hall is loud.",
  },
  {
    hotspotId: "h5",
    label: "코너",
    videoSrc: "/videos/walk-h5.mp4",
    titleKo: "코너 구역",
    titleEn: "Corner zone",
    bodyKo: "모형 코너에서 여백과 구조를 함께 읽을 수 있습니다.",
    bodyEn: "At the model corner, void and structure can be read together.",
  },
  {
    hotspotId: "h6",
    label: "여백",
    videoSrc: "/videos/walk-h6.mp4",
    titleKo: "여백 · 잔잔한 갤러리",
    titleEn: "Void · Calm gallery",
    bodyKo: "한산할 때 은은한 조명과 함께 여백을 느끼는 구역입니다.",
    bodyEn: "A zone to feel the void with soft light when the space is calm.",
  },
];

const BY_ID = new Map(MONITOR_ZONE_CONTENT.map((z) => [z.hotspotId, z]));

export function getMonitorZoneContent(hotspotId: string | null | undefined): MonitorZoneContent | null {
  if (!hotspotId) return null;
  return BY_ID.get(hotspotId) ?? null;
}

export const MONITOR_ZONE_VIDEO_SRCS = MONITOR_ZONE_CONTENT.map((z) => z.videoSrc);
