/** 태블릿 핫스pot → HDMI 모니터 Explore (미디어 · 설명)
 *  텍스트 정본: exhibition-chatbot/wiki/canonical
 */

export type MonitorZoneSlide = {
  kind: "video" | "image";
  src: string;
  alt?: string;
};

export type MonitorExploreSection = {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
};

export type MonitorZoneContent = {
  hotspotId: string;
  label: string;
  slides: MonitorZoneSlide[];
  titleKo: string;
  subtitleKo: string;
  /** 상단 강조 한 줄 */
  leadKo: string;
  sectionsKo: MonitorExploreSection[];
  /** QR 챗봇 추천 질문 */
  chatbotPromptsKo: string[];
  handoffHintKo: string;
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
    subtitleKo: "Transit Layer · Fast flow",
    leadKo:
      "역 안에서 일어나는 빠르고 목적 지향적인 흐름. 압축된 시간 속에서 감정이 쌓이지 못하고 소멸하는 층위이며, Extra Space가 ‘자각’을 시작하는 출발점입니다.",
    sectionsKo: [
      {
        heading: "이 동선이란",
        paragraphs: [
          "금정역 환승 결절 — 1·4호선과 GTX-C가 한 자리에서 만나는 Transit Layer입니다. ‘5분 환승 대기’가 전체 이동 1시간보다 길게 느껴지는, 고속 이동 시대의 심리적 시간이 여기서 작동합니다.",
          "공간은 차가움·속도·소음·인공 조명이 지배하고, 시야는 짧고 차단됩니다. 콘크리트·금속의 인프라 감각이 환승의 리듬을 그대로 보여 줍니다.",
        ],
      },
      {
        heading: "감정 — 소멸 (Numbing)",
        paragraphs: [
          "환승역은 ‘감정이 없는 곳’이 아닙니다. 출근·귀가·기다림·피로 같은 감정이 매일 수십만 번 발생하지만, 머물 틈이 없어 곧바로 사라집니다.",
          "긴장·불안·지루함·방향 상실이 동시에 일어나는 ‘감정의 경계 상태’입니다. Extra Space는 이 무감각을 부정하지 않고, 한 번 명확히 자각하게 만드는 리셋 구간으로 읽힙니다.",
        ],
      },
      {
        heading: "Fast flow — 빠른 흐름의 문법",
        bullets: [
          "형태: 직선·압축된 동선",
          "천장: 낮음 — 시야가 닫힘",
          "재료: 콘크리트·금속",
          "빛: 인공·중성",
          "목적: 통과 — 체류가 아닌 이동",
        ],
      },
      {
        heading: "한 단면에서 읽는 대비 — 환승 vs 산책",
        bullets: [
          "천장: 낮음 ↔ (산책) 높음·보이드",
          "빛: 인공·중성 ↔ 자연광·시간성",
          "재료: 콘크리트·금속 ↔ 목재·유리·식재",
          "시야: 차단·짧음 ↔ 개방·먼 풍경",
          "리듬: 빠른 통과 ↔ 머무름·머묾",
          "감정: 소멸 ↔ 재생성 → 공명",
        ],
      },
      {
        heading: "수직 층위에서의 위치",
        bullets: [
          "Level 0 (철로·플랫폼): 소멸의 핵심부. 속도·소음·환승이 가장 농도되게 모이는 자리.",
          "Level 1 (도시 테라스): 환승 동선이 잠깐 풀리는 자리 — 첫 번째 Extra Space 후보.",
          "Level 2 (캐노피): 환승이 거의 멈추는 머묾의 자리.",
        ],
      },
      {
        heading: "대표 장면",
        bullets: [
          "Threshold Space — 도시에서 역으로 들어오며 무채·소음·속도가 중성·압축·인공 조명으로 바뀌는 문턱. 소멸의 시작.",
          "Compression Space — 환승 동선이 한 줄로 압축되는 구간. 긴장·집중·속도를 한 번 자각.",
        ],
      },
      {
        heading: "단면적 속도 저감",
        paragraphs: [
          "천장이 낮아졌다 다시 열리는 구간, 시야가 닫혔다 풀리는 구간이 빠른 환승 흐름을 ‘한 박자’ 누릅니다. 이 한 박자가 Extra Space의 입구입니다.",
        ],
      },
      {
        heading: "전시에서 읽는 법",
        bullets: [
          "태블릿 평면도에서 이 핀을 선택하면 모니터가 Explore로 전환되고, 모형 조명이 연동됩니다.",
          "선형 LED = 연결 동선 · 흰색 약한 빛 = 선택된 Extra Space",
          "조명은 장식이 아니라 공간 논리를 보여 주는 인덱스입니다.",
        ],
      },
    ],
    chatbotPromptsKo: [
      "「레이어와 노드」— 환승·산책 층위가 무엇인지",
      "「금정역 맥락 한눈에」— 왜 이 역인지",
      "「소멸–재생성–공명」— 감정 시퀀스 설명",
    ],
    handoffHintKo: "테이블 옆 QR → 챗봇에서 위 질문으로 더 긴 설명·도면을 이어갈 수 있습니다.",
  },
  {
    hotspotId: "walk",
    label: "산책동선",
    slides: [
      { kind: "video", src: "/zones/walk/walking.mp4" },
      { kind: "image", src: "/zones/walk.svg", alt: "산책동선" },
    ],
    titleKo: "산책동선",
    subtitleKo: "Stroll Layer · Slow flow",
    leadKo:
      "산본천·수리산·주변 도시에서 사이트로 관입하는 느리고 감각적인 흐름. 풀린 시간 속에서 환승이 만든 소멸이 풀리고, 재생성에서 공명으로 이어지는 층위입니다.",
    sectionsKo: [
      {
        heading: "이 동선이란",
        paragraphs: [
          "Stroll Layer — 외부에서 관입하는 산책 동선입니다. 산본천 축, 수리산 방향, 주변 도시 조직에서 금정역 사이트로 들어옵니다.",
          "한 발 한 발의 속도가 다시 인간 신체에 묶이는 ‘풀린 시간’입니다. 자연광·식재·목재·유리·정적, 먼 시야와 개방감이 이 층위를 만듭니다.",
        ],
      },
      {
        heading: "감정 — 재생성 → 공명",
        paragraphs: [
          "환승이 만든 감정 소멸이 한 번 풀립니다. 걷는 동안 천장이 열리고, 빛·재료·소리·온도·시야가 바뀌며 감각이 다시 켜지는 단계 — ‘기분을 좋게 만드는 것’이 아니라 감정이 다시 지각 가능해지는 단계입니다.",
          "회복된 감각이 타인·공간·도시와 다시 연결되면 공명(resonance)에 이릅니다. 이때 Extra Space는 단순 휴게가 아니라 공공 공간으로 작동합니다.",
        ],
      },
      {
        heading: "Slow flow — 느린 흐름의 문법",
        bullets: [
          "형태: 곡선·완만한 동선",
          "천장: 높음·보이드",
          "재료: 목재·유리·식재",
          "빛: 자연광·시간에 따라 변함",
          "목적: 체류·감각 — 통과가 아님",
        ],
      },
      {
        heading: "산본천과 맥락",
        paragraphs: [
          "한때 곡선으로 흐르던 자연 수계가 복개·단절되면서 생태·보행·시각의 흐름이 끊겼습니다. 이 프로젝트는 그 단절선을 ‘덮는 것’이 아니라 ‘드러내고 잇는 일’로 봅니다.",
          "Level −1 산본천은 직접 진입하기보다 슬릿·투명 슬래브·시야축으로 존재를 감각하게 합니다. 물길의 존재를 한 번 인지시키는 것이 1차 목표입니다.",
        ],
      },
      {
        heading: "수직 층위에서의 위치",
        bullets: [
          "Level 1 × 산책: 환승과 산책이 처음 만나는 자리 — Extra Space의 본 무대.",
          "Level 2 × 산책: 수리산·풍경과 연결 — 공명의 자리.",
          "Level 0: 거의 닿지 않음. 시야로만 인지.",
        ],
      },
      {
        heading: "대표 장면",
        bullets: [
          "Overlap Deck — 산책 × 환승이 같은 단면에서 시각적으로 겹침. 속도 차이를 자각하는 관찰·교차.",
          "Recovery Edge — 하천·수리산·외부 풍경, 최저 속도. 회복·안정으로 공명을 마무리.",
          "Release Void — 압축 직후 천장·시야가 동시에 열리며 해방·호흡. 재생성의 핵심.",
        ],
      },
      {
        heading: "매스와 보행",
        paragraphs: [
          "산책 통로는 독립된 공공 보행 장치(Elevated Walk Network)로, 중심 매스는 흐름이 응축되는 결절입니다. split-weave 문법으로 갈라진 레이어가 서로 스치고 관입합니다.",
        ],
      },
      {
        heading: "전시에서 읽는 법",
        bullets: [
          "태블릿에서 산책동선 핀 선택 → 모니터 Explore + 모형 산책 레이어 하이라이트",
          "Interactive Spatial Index: 생성 조건 예시 — 산책 × 환승 × 보이드",
          "좌측 렌더·영상은 준비 중이며, 우측 설명으로 공간 논리를 먼저 읽을 수 있습니다.",
        ],
      },
    ],
    chatbotPromptsKo: [
      "「산본천과 설계」— 하천이 설계에서 어떤 역할인지",
      "「레이어와 노드」— 산책·환승 층위 설명",
      "「왜 금정역인가요?」— 입지·맥락",
    ],
    handoffHintKo: "QR 챗봇에서 산본천·수직 층위·동선 교차에 대한 심화 답변을 받을 수 있습니다.",
  },
  {
    hotspotId: "xspace",
    label: "X-tra Space",
    slides: [{ kind: "image", src: "/zones/xspace/xtra.png", alt: "X-tra Space" }],
    titleKo: "X-tra Space",
    subtitleKo: "Extra Space · 감각적 여백",
    leadKo:
      "일상 속 무감각해진 감정을 다시 ‘지각 가능한 상태’로 되돌리는, 감각 기반의 순환형 공공 공간. 환승(빠름)과 산책(느림)이 한 단면에서 겹치는 노드입니다.",
    sectionsKo: [
      {
        heading: "한 줄 정의",
        paragraphs: [
          "Extra Space는 단순한 휴게·여유 공간이 아닙니다. 이미 빠르게 흐르는 환승 공간에 ‘잠깐의 잉여 시간’을 의도적으로 끼워 넣고, 그 틈에서 감정이 다시 드러나고 순환할 수 있게 하는 공간입니다.",
        ],
      },
      {
        heading: "네 가지 정의 (같은 공간, 다른 면)",
        bullets: [
          "공간적 — 환승 동선(빠름·목적)과 산책 동선(느림·감각)이 같은 단면에서 겹치는 노드",
          "경험적 — 무감각해진 감정을 지각 가능한 상태로 되돌리는 감각 기반 순환 공간 (지각 회복)",
          "태도적 — 감정을 조절·억제·미화하지 않고, 스스로 드러나게 두는 여백",
          "이론적(ANT) — 인간·비인간(공간·재료·동선·자연) 네트워크가 만드는 감정 효과를 재배열하는 장치",
        ],
      },
      {
        heading: "출발점 — 왜 필요한가",
        paragraphs: [
          "금정역은 세 도시(군포·안양·산본)가 갈라지고 감정이 소멸되는 한국적 인프라의 전형입니다. ‘비어 있는 곳을 채우는 공간’이 아니라, 이미 발생하고 있는 감정에 잠깐의 틈을 만들어 주는 공간을 제안합니다.",
        ],
      },
      {
        heading: "감정 시퀀스",
        bullets: [
          "소멸 — 환승 인프라가 만든 무감각. 낮은 천장·직선 동선·중성 재료. ‘이미 일어나는 소멸’을 부정하지 않고 자각.",
          "재생성 — 천장·빛·재료·소리·시야가 변하며 감각이 다시 켜짐.",
          "공명 — 회복된 감각이 타인·도시와 연결. 단순 휴게를 넘어 공공 공간으로 작동.",
        ],
      },
      {
        heading: "형식 — 어떻게 생긴 공간인가",
        bullets: [
          "Under-programmed — 카페·상점처럼 기능을 닫지 않은 여백. 머무름·관찰·우연한 만남의 가능성.",
          "감각의 변화로 구획 — 벽이 아니라 빛·재료·천장·소리·온도로 영역이 나뉨.",
          "속도를 늦추는 단면적 장치 — 층고·시야가 닫혔다 열리며 환승 흐름을 한 박자 누름.",
          "시간성에 열린 표면 — 같은 자리가 아침과 저녁 다르게 보임.",
        ],
      },
      {
        heading: "6개 대표 장면",
        bullets: [
          "Threshold — 진입 문턱 · Compression — 환승 압축",
          "Release Void — 해방의 보이드 · Overlap Deck — 산책×환승 교차",
          "Sensory Chamber — 감각의 방 · Recovery Edge — 회복의 가장자리",
        ],
      },
      {
        heading: "설계 3축 (A · B · C)",
        bullets: [
          "A 동선: 환승 / 산책 / 정지 / 우회 / 교차",
          "B 감각: 빛 / 소리 / 천장 / 재료 / 밀도 / 시야 / 온도",
          "C 감정: 안정 / 불안 / 몰입 / 환기 / 회복 / 해방 등",
        ],
      },
      {
        heading: "Interactive Spatial Index — 화면 4항목",
        bullets: [
          "① 위치 — 평면에서 선택한 Extra Space",
          "② 생성 조건 — 어떤 동선이 교차하는가 (예: 산책 × 환승 × 보이드)",
          "③ 감각 장치 — 빛·소리·재료·높이·시야·밀도",
          "④ 감정 상태 — 안정·각성·몰입·긴장·회복·해방 등",
        ],
      },
      {
        heading: "마스터플랜 — 세 Phase",
        bullets: [
          "Phase 1 소멸 — 기존 역 개조, 중성층으로 동선 정리",
          "Phase 2 재생성 — 확장·산본천 재노출, 감각이 켜지는 구간",
          "Phase 3 공명 — 커뮤니티 클러스터, 도시와 다시 잇는 자리",
        ],
      },
      {
        heading: "「돌아서라도 가고 싶은 공간」",
        paragraphs: [
          "환승 효율을 한 번 어긋나게 할 만큼 머묾의 가치가 있는 자리. 통과형 인프라 한가운데, 다른 시간 감각이 잠깐 작동하는 틈을 의도적으로 남깁니다.",
        ],
      },
      {
        heading: "전시에서",
        bullets: [
          "벽 = 이야기·해석 · 테이블 = 물질성·증거·체험",
          "태블릿 선택 → 모형 하이라이트 + 이 화면의 4항목 해석",
          "챗봇 = canonical 위키 기반 심화 번역 장치 (물리 전시와 매체는 다름)",
        ],
      },
    ],
    chatbotPromptsKo: [
      "「X-tra Space가 뭐예요?」",
      "「이 작품 한 줄 소개」",
      "「전시에서 뭘 보나요?」",
      "「소멸–재생성–공명」이 무슨 뜻인지",
    ],
    handoffHintKo: "테이블 옆 QR 스캔 → 챗봇에서 프로젝트 전체 논리·도면·FAQ를 이어서 탐색하세요.",
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
