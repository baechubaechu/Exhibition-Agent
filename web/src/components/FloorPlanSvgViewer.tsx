"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { TransformComponent, TransformWrapper, type ReactZoomPanPinchRef } from "react-zoom-pan-pinch";
import { FloorMapHotspotButton } from "@/components/FloorMapHotspotButton";
import { hotspotsForViewBox, type FloorHotspot } from "@/lib/floorPlanHotspots";
import { applyLodVisibility, displayLodIndex, hotspotsVisibleAtDisplayZoom } from "@/lib/floorPlanLod";
import type { FloorPlanViewerHandle } from "@/lib/floorPlanViewerHandle";
import {
  computeFitScale,
  fetchPlanSvg,
  type LoadedPlanSvg,
  type PlanViewBox,
} from "@/lib/floorPlanSvgLoad";
import { TABLET_INITIAL_DISPLAY_ZOOM, TABLET_PINCH_ZOOM_STEP } from "@/lib/tabletMapZoom";

export type FloorPlanSvgViewerHandle = FloorPlanViewerHandle;

type Props = {
  src?: string;
  activeHotspotId: string | null;
  /** 핫스pot Explore 중 — 초기화 버튼 강조 */
  exploreActive?: boolean;
  busy: boolean;
  onHotspotClick: (spot: FloorHotspot) => void;
  /** 줌·맞춤 초기화 시 함께 호출 (장소 선택·패널 해제 등) */
  onReset?: () => void;
  /** 사용자가 줌·패닝 등 도면을 조작했을 때 */
  onMapInteract?: () => void;
  /** displayZoom 이 기본(1.0)에서 벗어난 첫 사용자 줌 */
  onUserZoom?: () => void;
  onLodChange?: (lodIndex: number) => void;
};

const DEFAULT_SRC = "/drawings/tablet-plan.svg";

/** HUD displayZoom = scale / fitScale (reset ≈ TABLET_INITIAL_DISPLAY_ZOOM) */
const MIN_DISPLAY_ZOOM = 0.5;
const MAX_DISPLAY_ZOOM = 12;
const USER_ZOOM_EPS = 0.05;

export const FloorPlanSvgViewer = forwardRef<FloorPlanSvgViewerHandle, Props>(function FloorPlanSvgViewer(
  {
    src = DEFAULT_SRC,
    activeHotspotId,
    exploreActive = false,
    busy,
    onHotspotClick,
    onReset,
    onMapInteract,
    onUserZoom,
    onLodChange,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgHostRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef<ReactZoomPanPinchRef | null>(null);
  const planRef = useRef<LoadedPlanSvg | null>(null);
  const fitScaleRef = useRef(1);
  const displayZoomRef = useRef(TABLET_INITIAL_DISPLAY_ZOOM);
  const lodLayersRef = useRef<LoadedPlanSvg["lodLayers"]>({});
  const suppressInteractRef = useRef(false);
  const userZoomNotifiedRef = useRef(false);
  const lodRef = useRef(0);
  const onLodChangeRef = useRef(onLodChange);
  onLodChangeRef.current = onLodChange;

  const emitLod = useCallback((nextLod: number) => {
    lodRef.current = nextLod;
    onLodChangeRef.current?.(nextLod);
  }, []);

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [viewBox, setViewBox] = useState<PlanViewBox | null>(null);
  const [hotspots, setHotspots] = useState<FloorHotspot[]>([]);
  const [fitScale, setFitScale] = useState(1);
  const [transformReady, setTransformReady] = useState(false);
  const [displayZoom, setDisplayZoom] = useState(TABLET_INITIAL_DISPLAY_ZOOM);

  const showHotspots = hotspotsVisibleAtDisplayZoom(displayZoom);

  const endSuppressInteract = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        suppressInteractRef.current = false;
      });
    });
  }, []);

  const applyMapView = useCallback(
    (nextFit: number, displayZoomTarget: number) => {
      suppressInteractRef.current = true;
      fitScaleRef.current = nextFit;
      displayZoomRef.current = displayZoomTarget;
      setFitScale(nextFit);
      setDisplayZoom(displayZoomTarget);
      applyLodVisibility(lodLayersRef.current, displayZoomTarget);
      emitLod(displayLodIndex(displayZoomTarget));

      const api = transformRef.current;
      if (api) {
        api.centerView(nextFit * displayZoomTarget, 0);
      }
      endSuppressInteract();
    },
    [emitLod, endSuppressInteract],
  );

  const applyFit = useCallback(
    (nextFit: number) => {
      applyMapView(nextFit, TABLET_INITIAL_DISPLAY_ZOOM);
    },
    [applyMapView],
  );

  const recalcFit = useCallback(() => {
    const container = containerRef.current;
    if (!viewBox || !container) return;
    const next = computeFitScale(container.clientWidth, container.clientHeight, viewBox);
    const prev = fitScaleRef.current;
    if (prev > 0 && Math.abs(next - prev) / prev < 0.02) return;
    applyMapView(next, displayZoomRef.current);
  }, [applyMapView, viewBox]);

  const handleTransform = useCallback(
    (_ref: ReactZoomPanPinchRef, state: { scale: number }) => {
      const fit = fitScaleRef.current || 1;
      const dz = state.scale / fit;
      displayZoomRef.current = dz;
      const nextLod = displayLodIndex(dz);
      if (nextLod !== lodRef.current) {
        emitLod(nextLod);
      }
      setDisplayZoom(dz);
      applyLodVisibility(lodLayersRef.current, dz);

      if (suppressInteractRef.current) return;

      onMapInteract?.();

      if (!userZoomNotifiedRef.current && Math.abs(dz - TABLET_INITIAL_DISPLAY_ZOOM) > USER_ZOOM_EPS) {
        userZoomNotifiedRef.current = true;
        onUserZoom?.();
      }
    },
    [emitLod, onMapInteract, onUserZoom],
  );

  const handleReset = useCallback(() => {
    const container = containerRef.current;
    if (!viewBox || !container) return;
    userZoomNotifiedRef.current = false;
    const next = computeFitScale(container.clientWidth, container.clientHeight, viewBox);
    fitScaleRef.current = next;
    setFitScale(next);
    applyFit(next);
    onReset?.();
    onMapInteract?.();
  }, [applyFit, onMapInteract, onReset, viewBox]);

  useImperativeHandle(ref, () => ({ resetView: handleReset }), [handleReset]);

  useEffect(() => {
    let cancelled = false;
    planRef.current = null;
    setStatus("loading");
    setErrorMsg("");
    setViewBox(null);
    setHotspots([]);
    setTransformReady(false);
    userZoomNotifiedRef.current = false;

    void (async () => {
      try {
        const loaded = await fetchPlanSvg(src);
        if (cancelled) return;
        planRef.current = loaded;
        lodLayersRef.current = loaded.lodLayers;
        setViewBox(loaded.viewBox);
        setHotspots(hotspotsForViewBox(loaded.viewBox));
        setStatus("ready");
      } catch (e) {
        if (cancelled) return;
        setStatus("error");
        setErrorMsg(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [src]);

  /** TransformWrapper 마운트 전에 fitScale만 계산 (svgHost는 아직 없음) */
  useEffect(() => {
    if (status !== "ready" || !viewBox) return;

    const measure = () => {
      const container = containerRef.current;
      if (!container) return;
      const next = computeFitScale(container.clientWidth, container.clientHeight, viewBox);
      fitScaleRef.current = next;
      setFitScale(next);
      setTransformReady(true);
    };

    requestAnimationFrame(() => requestAnimationFrame(measure));
  }, [status, viewBox]);

  /** transformReady 이후 svgHost가 DOM에 붙은 뒤 SVG 삽입 */
  useEffect(() => {
    if (status !== "ready" || !transformReady || !planRef.current || !svgHostRef.current) return;

    svgHostRef.current.replaceChildren(planRef.current.svg);
    applyLodVisibility(lodLayersRef.current, TABLET_INITIAL_DISPLAY_ZOOM);
    setDisplayZoom(TABLET_INITIAL_DISPLAY_ZOOM);
    displayZoomRef.current = TABLET_INITIAL_DISPLAY_ZOOM;
    userZoomNotifiedRef.current = false;

    requestAnimationFrame(() => {
      applyFit(fitScaleRef.current);
    });
  }, [applyFit, status, transformReady, viewBox]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !viewBox || status !== "ready") return;

    let t: ReturnType<typeof setTimeout> | undefined;
    const ro = new ResizeObserver(() => {
      if (t) clearTimeout(t);
      t = setTimeout(() => recalcFit(), 120);
    });
    ro.observe(container);
    return () => {
      ro.disconnect();
      if (t) clearTimeout(t);
    };
  }, [recalcFit, status, viewBox]);

  const stageWidth = viewBox?.width ?? 400;
  const stageHeight = viewBox?.height ?? 300;

  return (
    <div ref={containerRef} className="xfloor-svg-viewer">
      {status === "loading" && (
        <div className="xfloor-svg-loading" aria-live="polite">
          도면 불러오는 중…
        </div>
      )}
      {status === "error" && (
        <div className="xfloor-svg-error">
          <p>SVG 도면을 표시할 수 없습니다.</p>
          <p className="xfloor-svg-error-detail">{errorMsg}</p>
          <a className="xfloor-pdf-open-tab" href={src} target="_blank" rel="noreferrer">
            원본 파일 열기
          </a>
        </div>
      )}

      {status === "ready" && viewBox && transformReady && (
        <>
          <TransformWrapper
            ref={transformRef}
            initialScale={fitScale * TABLET_INITIAL_DISPLAY_ZOOM}
            minScale={fitScale * MIN_DISPLAY_ZOOM}
            maxScale={fitScale * MAX_DISPLAY_ZOOM}
            centerOnInit
            smooth={false}
            wheel={{ step: 0.12 }}
            pinch={{ step: TABLET_PINCH_ZOOM_STEP, disabled: false }}
            panning={{ velocityDisabled: true }}
            doubleClick={{ disabled: true }}
            onTransform={handleTransform}
          >
            <TransformComponent
              wrapperClass="xfloor-svg-transform-wrap"
              contentClass="xfloor-svg-transform-content"
            >
              <div
                className="xfloor-svg-stage"
                style={{ width: stageWidth, height: stageHeight }}
              >
                <div ref={svgHostRef} className="xfloor-svg-host" aria-hidden={false} />
                {showHotspots
                  ? hotspots.map((spot) => (
                      <FloorMapHotspotButton
                        key={spot.id}
                        spot={spot}
                        active={activeHotspotId === spot.id}
                        busy={busy}
                        onClick={onHotspotClick}
                        onMapInteract={onMapInteract}
                      />
                    ))
                  : null}
              </div>
            </TransformComponent>
          </TransformWrapper>

          <div className="xfloor-map-hud xfloor-map-hud--tr" aria-live="polite">
            <span className="xfloor-map-hud-label">줌</span>
            <span className="xfloor-mono">{displayZoom.toFixed(2)}×</span>
          </div>

          <button
            type="button"
            className={`xfloor-map-reset${exploreActive ? " is-highlighted" : ""}`}
            onClick={handleReset}
          >
            초기화
          </button>
        </>
      )}
    </div>
  );
});
