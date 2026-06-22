/** 태블릿 도면 — 첫 화면·「초기화」 시 displayZoom (1=맞춤, 1.5=1.5× 배치도) */
export const TABLET_INITIAL_DISPLAY_ZOOM = 1.5;

/**
 * react-zoom-pan-pinch pinch.step (기본 5).
 * step=5면 손가락 간격 2배 벌릴 때 displayZoom도 약 2배 → 1.5× 시작 + 한 번 핀치로 3×(평면) 도달.
 */
export const TABLET_PINCH_ZOOM_STEP = 5;
