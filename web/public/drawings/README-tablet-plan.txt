태블릿 도면 PDF

1. CAD에서 CTB 적용한 "Tablet Plan" 을 PDF로 플롯합니다.
2. 파일 이름을 tablet-plan.pdf 로 저장합니다.
3. 이 폴더(web/public/drawings/)에 넣습니다.

경로: web/public/drawings/tablet-plan.pdf
URL:  /drawings/tablet-plan.pdf

핀치·휠 줌은 SVG 도면과 동일합니다.
구역 핫스팟은 줌이 충분히 들어가면 표시됩니다(LOD 2).
핀 위치: web/src/lib/floorPlanHotspots.ts
파일이 크면 첫 로드가 수 초 걸릴 수 있습니다 — 플롯 PDF 용량을 줄이면 빨라집니다.
