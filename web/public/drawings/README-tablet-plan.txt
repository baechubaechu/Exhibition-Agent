태블릿 도면 (벡터 SVG 권장)

1. CAD에서 도면을 SVG로 내보냅니다 (또는 PDF가 아닌 벡터 SVG).
2. 파일 이름을 tablet-plan.svg 로 저장합니다.
3. 이 폴더(web/public/drawings/)에 넣습니다.

기본 경로: web/public/drawings/tablet-plan.svg
기본 URL:  /drawings/tablet-plan.svg

환경 변수 (선택):
  NEXT_PUBLIC_TABLET_PLAN_SVG=/drawings/my-plan.svg

핀치·휠 줌은 SVG 벡터로 렌더되므로 확대해도 선이 깨지지 않습니다.
브라우저 HTTP 캐시 + sessionStorage + 메모리에 SVG 본문을 캐싱해 재방문 시 빠르게 뜹니다.

구역 핫스팟은 LOD 3(줌 약 6× 이상)에서 표시됩니다.
핫스팟 위치: web/src/lib/floorPlanHotspots.ts
(실제 도면 viewBox 크기에 맞게 좌표를 조정하세요.)

참고: PDF(tablet-plan.pdf)는 캔버스 래스터 방식이라 확대 시 흐려집니다. 태블릿 UI는 SVG 뷰어를 사용합니다.
