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
import {
  hotspotsVisibleAtDisplayZoom,
  lodStatusLabel,
  maxVisibleLodIndex,
} from "@/lib/floorPlanLod";
import { fetchPlanPdf, renderPlanPdfPage } from "@/lib/floorPlanPdfLoad";
import type { FloorPlanViewerHandle } from "@/lib/floorPlanViewerHandle";
import { computeFitScale, type PlanViewBox } from "@/lib/floorPlanSvgLoad";

export type { FloorPlanViewerHandle };

type Props = {
  src?: string;
  activeHotspotId: string | null;
  exploreActive?: boolean;
  busy: boolean;
  onHotspotClick: (spot: FloorHotspot) => void;
  onReset?: () => void;
  onMapInteract?: () => void;
  onUserZoom?: () => void;
};

export const DEFAULT_TABLET_PLAN_PDF = "/drawings/tablet-plan.pdf";

const MIN_DISPLAY_ZOOM = 0.5;
const MAX_DISPLAY_ZOOM = 12;
const USER_ZOOM_EPS = 0.05;
const PINCH_ZOOM_STEP = 5;
/** 확대 시 PDF 선명도 (stage는 scale 1, 캔버스만 고해상도) */
const PDF_PIXEL_SCALE = 2.5;

export const FloorPlanPdfViewer = forwardRef<FloorPlanViewerHandle, Props>(function FloorPlanPdfViewer(
  {
    src = DEFAULT_TABLET_PLAN_PDF,
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const transformRef = useRef<ReactZoomPanPinchRef | null>(null);
  const fitScaleRef = useRef(1);
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

  const showHotspots = hotspotsVisibleAtDisplayZoom(displayZoom);

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
      setLodMaxIndex(maxVisibleLodIndex(dz));

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
    setStatus("loading");
    setErrorMsg("");
    setViewBox(null);
    setHotspots([]);
    setTransformReady(false);
    userZoomNotifiedRef.current = false;

    void (async () => {
      try {
        const loaded = await fetchPlanPdf(src);
        if (cancelled) return;
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

  useEffect(() => {
    if (status !== "ready" || !transformReady || !canvasRef.current) return;

    let cancelled = false;
    const canvas = canvasRef.current;
    const dpr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;

    void (async () => {
      try {
        await renderPlanPdfPage(src, canvas, PDF_PIXEL_SCALE * dpr);
      } catch (e) {
        if (!cancelled) {
          setStatus("error");
          setErrorMsg(e instanceof Error ? e.message : String(e));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [src, status, transformReady]);

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

  useEffect(() => {
    if (status !== "ready" || !transformReady || !viewBox) return;

    setDisplayZoom(1);
    setLodMaxIndex(0);
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
    <div ref={containerRef} className="xfloor-svg-viewer xfloor-pdf-viewer">
      {status === "loading" && (
        <div className="xfloor-svg-loading" aria-live="polite">
          도면 불러오는 중…
        </div>
      )}
      {status === "error" && (
        <div className="xfloor-svg-error">
          <p>PDF 도면을 표시할 수 없습니다.</p>
          <p className="xfloor-svg-error-detail">{errorMsg}</p>
          <a className="xfloor-pdf-open-tab" href={src} target="_blank" rel="noreferrer">
            PDF 열기
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
              <div className="xfloor-svg-stage" style={{ width: stageWidth, height: stageHeight }}>
                <canvas ref={canvasRef} className="xfloor-pdf-plan-canvas" aria-hidden={false} />
                {showHotspots
                  ? hotspots.map((spot) => (
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
                    ))
                  : null}
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

          {!showHotspots ? (
            <p className="xfloor-hotspot-zoom-hint" aria-live="polite">
              약 3× 이상 확대하면 구역 버튼이 나타납니다
            </p>
          ) : null}

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
