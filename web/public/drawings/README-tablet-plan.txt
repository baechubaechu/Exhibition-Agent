태블릿 도면 (PDF 2장 또는 SVG)



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 PDF 2장 (권장 — 배치 + 평면 따로 export)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



아래 폴더에 파일만 넣으면 태블릿이 자동으로 PDF 모드로 전환됩니다.



  web/public/drawings/tablet-site.pdf   ← 1:3000 배치도 (A3)

  web/public/drawings/tablet-floor.pdf  ← 1:1000 평면도 (A3)



동작:

동작 (PDF 2장):
  ~1×~2.8×  배치 PDF — 휠로 천천히 확대
  ~3×       평면 PDF (중앙 1/3 → 3×와 시야 맞춤, 줌·패닝 유지)
  ~3×~       평면 + 구역 핫스pot 3개




파일 이름을 바꾸려면 web/.env.local:



  NEXT_PUBLIC_TABLET_PLAN_MODE=dual-pdf

  NEXT_PUBLIC_TABLET_PLAN_SITE_PDF=/drawings/my-site.pdf

  NEXT_PUBLIC_TABLET_PLAN_FLOOR_PDF=/drawings/my-floor.pdf



강제로 SVG만 쓰려면:

  NEXT_PUBLIC_TABLET_PLAN_MODE=svg



핫스pot 위치: web/src/lib/floorPlanHotspots.ts (평면 도면 기준 %)



참고: PDF는 확대 시 선이 흐려질 수 있습니다. 전시 후 SVG 합본으로 바꾸면 더 선명합니다.



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 SVG 1장 (lod-0 / lod-1 레이어)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



  web/public/drawings/tablet-plan.svg



Illustrator 레이어 id: lod-0(배치), lod-1(평면)



  NEXT_PUBLIC_TABLET_PLAN_SVG=/drawings/tablet-plan.svg



PDF 2장이 없으면 이 SVG가 사용됩니다.



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



핀치·휠 줌은 react-zoom-pan-pinch. 브라우저에서 SVG/PDF 캐시로 재방문 시 빠릅니다.

