/** 태블릿 핫스pot → HDMI 모니터 Explore (미디어 · 설명) */

export type MonitorZoneSlide = {
  kind: "video" | "image";
  src: string;
  alt?: string;
};

export type MonitorZoneContent = {
  hotspotId: string;
  label: string;
  slides: MonitorZoneSlide[];
  titleKo: string;
  subtitleKo: string;
  /** 도입 한두 문장 */
  leadKo: string;
  /** 짧은 설명 본문 (2~3문단) */
  bodyKo: string[];
};

export const MONITOR_ZONE_CONTENT: MonitorZoneContent[] = [
  {
    hotspotId: "transfer",
    label: "환승동선",
    slides: [
      { kind: "video", src: "/zones/transfer/transit.mp4" },
      { kind: "image", src: "/zones/transfer.svg", alt: "환승동선" },
    ],
    titleKo: "환승동선",
    subtitleKo: "Transit Layer",
    leadKo:
      "환승동선은 역 안에서 다음 목적지로 빠르게 이동하는 구간입니다. 사람은 여기서 오래 서 있지 않고, 감정도 쌓이기 전에 지나갑니다.",
    bodyKo: [
      "금정역은 1·4호선과 GTX-C가 한자리에서 만나는 환승 허브입니다. 천장이 낮고 동선이 직선이라, 콘크리트와 금속의 차가운 인프라 느낌이 강합니다.",
      "이 층의 목적은 머무는 것이 아니라 통과입니다. 산책동선과 나란히 보면 속도와 밀도 차이가 분명히 드러납니다.",
    ],
  },
  {
    hotspotId: "walk",
    label: "산책동선",
    slides: [
      { kind: "video", src: "/zones/walk/walking.mp4" },
      { kind: "image", src: "/zones/walk.svg", alt: "산책동선" },
    ],
    titleKo: "산책동선",
    subtitleKo: "Stroll Layer",
    leadKo:
      "산책동선은 산본천과 수리산 쪽에서 사이트로 천천히 들어오는 길입니다. 걸으면서 몸의 속도가 다시 느려지고, 주변 감각이 조금씩 돌아옵니다.",
    bodyKo: [
      "동선은 완만하고 천장이 높으며, 자연광과 식재가 들어옵니다. 환승보다 여유가 있고, 잠시 멈춰 볼 수 있는 공간으로 읽힙니다.",
      "하천과 산 풍경과 연결되는 방향입니다. 환승의 빠른 흐름과 겹치는 지점에서 Extra Space가 시작됩니다.",
    ],
  },
  {
    hotspotId: "xspace",
    label: "X-tra Space",
    slides: [{ kind: "image", src: "/zones/xspace/xtra.png", alt: "X-tra Space" }],
    titleKo: "X-tra Space",
    subtitleKo: "Extra Space",
    leadKo: "X-tra Space는 환승과 산책 사이에 끼워 넣은 잠깐의 여백입니다.",
    bodyKo: [
      "단순한 휴게 공간이 아니라, 지나치며 무감각해진 감정을 다시 느낄 수 있게 하는 틈입니다. 벽으로 막기보다 빛, 재료, 높이 차이로 공간이 나뉩니다.",
      "소멸이 먼저 드러나고, 걸으며 회복하고, 주변과 다시 연결되는 흐름을 염두에 둔 자리입니다. 더 길게 알고 싶으면 테이블 옆 QR 챗봇을 이용하면 됩니다.",
    ],
  },
];

const BY_ID = new Map(MONITOR_ZONE_CONTENT.map((z) => [z.hotspotId, z]));

export function getMonitorZoneContent(hotspotId: string | null | undefined): MonitorZoneContent | null {
  if (!hotspotId) return null;
  return BY_ID.get(hotspotId) ?? null;
}

export const MONITOR_ZONE_PRELOAD_SRCS = MONITOR_ZONE_CONTENT.flatMap((z) => z.slides.map((s) => s.src));

export const MONITOR_ZONE_VIDEO_SRCS = MONITOR_ZONE_CONTENT.flatMap((z) =>
  z.slides.filter((s) => s.kind === "video").map((s) => s.src),
);
