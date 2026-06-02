/** 태블릿 핫스pot → HDMI 모니터 Explore (미디어 · 설명) */

export type MonitorZoneSlide = {
  kind: "video" | "image";
  src: string;
  alt?: string;
};

export type MonitorZoneContent = {
  hotspotId: string;
  label: string;
  /** 좌측에 순환 재생 — 1개면 고정, 2개 이상이면 슬라이드쇼 */
  slides: MonitorZoneSlide[];
  titleKo: string;
  titleEn: string;
  bodyKo: string;
  bodyEn: string;
  pointsKo: string[];
  pointsEn: string[];
  handoffHintKo: string;
};

export const MONITOR_ZONE_CONTENT: MonitorZoneContent[] = [
  {
    hotspotId: "transfer",
    label: "환승동선",
    slides: [
      { kind: "image", src: "/zones/transfer.svg", alt: "환승동선 개념도" },
      { kind: "video", src: "/videos/zone-transfer.mp4" },
    ],
    titleKo: "환승동선",
    titleEn: "Transfer circulation",
    bodyKo:
      "층과 프로그램을 잇는 짧은 연결 동선입니다. 관람객이 한 공간에서 다음 공간으로 넘어갈 때, 조명과 ambient가 자연스럽게 이어지도록 설계했습니다.",
    bodyEn:
      "A short connective path linking levels and programs. Lighting and ambient are tuned to carry visitors smoothly from one space to the next.",
    pointsKo: ["층간·프로그램 연결", "짧은 체류 · 통과형 동선", "은은한 조명 hand-off"],
    pointsEn: ["Level & program linkage", "Brief stay · pass-through flow", "Soft lighting hand-off"],
    handoffHintKo: "환승동선 설명이 큰 화면 오른쪽에 표시됩니다.",
  },
  {
    hotspotId: "walk",
    label: "산책동선",
    slides: [
      { kind: "image", src: "/zones/walk.svg", alt: "산책동선 개념도" },
      { kind: "video", src: "/videos/zone-walk.mp4" },
    ],
    titleKo: "산책동선",
    titleEn: "Walking layer",
    bodyKo:
      "조용할 때 드러나는 층간 산책로입니다. walking layer를 따라 천천히 이동하며 단면 모형과 여백을 함께 읽을 수 있습니다.",
    bodyEn:
      "An inter-level stroll that emerges in calm conditions. Move slowly along the walking layer to read the sectional model and void together.",
    pointsKo: ["Walking layer 강조", "느린 이동 · 낮은 ambient", "단면·여백 동시 감상"],
    pointsEn: ["Walking layer emphasis", "Slow movement · low ambient", "Section and void together"],
    handoffHintKo: "산책동선 영상과 설명을 큰 화면에서 확인하세요.",
  },
  {
    hotspotId: "xspace",
    label: "X-tra Space",
    slides: [
      { kind: "image", src: "/zones/xspace.svg", alt: "X-tra Space 개념도" },
      { kind: "video", src: "/videos/zone-xspace.mp4" },
    ],
    titleKo: "X-tra Space",
    titleEn: "X-tra Space",
    bodyKo:
      "전시의 중심 볼륨입니다. 코어를 둘러싼 X자 교차와 단면 모형이 만나는 지점에서, 소음·인원·태블릿 선택에 따라 연출이 달라집니다.",
    bodyEn:
      "The central volume of the exhibition. Where the X-cross and sectional model meet, the scene shifts with noise, crowd, and tablet selection.",
    pointsKo: ["코어 · X 교차", "환경 센서 연동 연출", "태블릿 Explore와 연결"],
    pointsEn: ["Core · X intersection", "Sensor-linked staging", "Linked to tablet explore"],
    handoffHintKo: "X-tra Space 소개가 모니터에 표시됩니다.",
  },
];

const BY_ID = new Map(MONITOR_ZONE_CONTENT.map((z) => [z.hotspotId, z]));

export function getMonitorZoneContent(hotspotId: string | null | undefined): MonitorZoneContent | null {
  if (!hotspotId) return null;
  return BY_ID.get(hotspotId) ?? null;
}

/** preload — 존재하는 video 슬라이드만 */
export const MONITOR_ZONE_VIDEO_SRCS = MONITOR_ZONE_CONTENT.flatMap((z) =>
  z.slides.filter((s) => s.kind === "video").map((s) => s.src),
);
