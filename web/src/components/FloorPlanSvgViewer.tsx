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
import { hotspotsForViewBox, type FloorHotspot } from "@/lib/floorPlanHotspots";
import { applyLodVisibility, lodStatusLabel } from "@/lib/floorPlanLod";
import {
  computeFitScale,
  fetchPlanSvg,
  type LoadedPlanSvg,
  type PlanViewBox,
} from "@/lib/floorPlanSvgLoad";

export type FloorPlanSvgViewerHandle = {
  resetView: () => void;
};

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
};

const DEFAULT_SRC = "/drawings/plan.svg";

/** HUD displayZoom = scale / fitScale (reset ≈ 1.0) */
const MIN_DISPLAY_ZOOM = 0.5;
const MAX_DISPLAY_ZOOM = 12;
const USER_ZOOM_EPS = 0.05;
/** react-zoom-pan-pinch: scaleDelta ∝ step/5 — 5면 손가락 2배 벌릴 때 displayZoom +≈1 */
const PINCH_ZOOM_STEP = 5;

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
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgHostRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef<ReactZoomPanPinchRef | null>(null);
  const planRef = useRef<LoadedPlanSvg | null>(null);
  const fitScaleRef = useRef(1);
  const lodLayersRef = useRef<LoadedPlanSvg["lodLayers"]>({});
  const suppressInteractRef = useRef(false);
  const userZoomNotifiedRef = useRef(false);

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [viewBox, setViewBox] = useState<PlanViewBox | null>(null);
  const [hotspots, setHotspots] = useState<FloorHotspot[]>([]);
  const [fitScale, setFitScale] = useState(1);
  const [transformReady, setTransformReady] = useState(false);
  const [displayZoom, setDisplayZoom] = useState(1);
  const [lodMaxIndex, setLodMaxIndex] = useState(0);

  const endSuppressInteract = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        suppressInteractRef.current = false;
      });
    });
  }, []);

  const applyFit = useCallback(
    (nextFit: number) => {
      suppressInteractRef.current = true;
      fitScaleRef.current = nextFit;
      setFitScale(nextFit);
      setDisplayZoom(1);
      applyLodVisibility(lodLayersRef.current, 1);
      setLodMaxIndex(0);

      const api = transformRef.current;
      if (api) {
        api.centerView(nextFit, 0);
      }
      endSuppressInteract();
    },
    [endSuppressInteract],
  );

  const recalcFit = useCallback(() => {
    const container = containerRef.current;
    if (!viewBox || !container) return;
    const next = computeFitScale(container.clientWidth, container.clientHeight, viewBox);
    const prev = fitScaleRef.current;
    if (prev > 0 && Math.abs(next - prev) / prev < 0.02) return;
    applyFit(next);
  }, [applyFit, viewBox]);

  const handleTransform = useCallback(
    (_ref: ReactZoomPanPinchRef, state: { scale: number }) => {
      const fit = fitScaleRef.current || 1;
      const dz = state.scale / fit;
      setDisplayZoom(dz);
      const maxIdx = applyLodVisibility(lodLayersRef.current, dz);
      setLodMaxIndex(maxIdx);

      if (suppressInteractRef.current) return;

      onMapInteract?.();

      if (!userZoomNotifiedRef.current && Math.abs(dz - 1) > USER_ZOOM_EPS) {
        userZoomNotifiedRef.current = true;
        onUserZoom?.();
      }
    },
    [onMapInteract, onUserZoom],
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
    applyLodVisibility(lodLayersRef.current, 1);
    setLodMaxIndex(0);
    setDisplayZoom(1);
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
            initialScale={fitScale}
            minScale={fitScale * MIN_DISPLAY_ZOOM}
            maxScale={fitScale * MAX_DISPLAY_ZOOM}
            centerOnInit
            smooth={false}
            wheel={{ step: 0.12, smooth: false }}
            pinch={{ step: PINCH_ZOOM_STEP, disabled: false }}
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
                {hotspots.map((spot) => (
                  <button
                    key={spot.id}
                    type="button"
                    className={`xfloor-hotspot xfloor-hotspot--map ${activeHotspotId === spot.id ? "is-active" : ""}`}
                    style={{ left: spot.x, top: spot.y }}
                    disabled={busy}
                    aria-label={`${spot.label}, ${spot.targetZone === "zoneA" ? "A구역" : "B구역"} 조명`}
                    title={`${spot.label} (${spot.targetZone})`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onMapInteract?.();
                      onHotspotClick(spot);
                    }}
                  >
                    <span className="xfloor-hotspot-dot" aria-hidden />
                    <span className="xfloor-hotspot-label">{spot.label}</span>
                  </button>
                ))}
              </div>
            </TransformComponent>
          </TransformWrapper>

          <div className="xfloor-map-hud xfloor-map-hud--tr" aria-live="polite">
            <span className="xfloor-map-hud-label">줌</span>
            <span className="xfloor-mono">{displayZoom.toFixed(2)}×</span>
          </div>

          <div className="xfloor-map-hud xfloor-map-hud--bl" aria-live="polite">
            <span className="xfloor-map-hud-label">표시</span>
            <span className="xfloor-mono">{lodStatusLabel(lodMaxIndex)}</span>
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
