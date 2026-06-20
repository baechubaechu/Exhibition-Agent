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
  DUAL_PDF_FLOOR_STAGE_RATIO,
  displayLodIndexDualPdf,
  dualPdfHotspotsVisible,
  lodStatusLabel,
} from "@/lib/floorPlanLod";
import { blitPlanToDisplayCanvas, loadAndRenderPlanPdf } from "@/lib/floorPlanPdfLoad";
import type { FloorPlanViewerHandle } from "@/lib/floorPlanViewerHandle";
import { computeFitScale, type PlanViewBox } from "@/lib/floorPlanSvgLoad";
import {
  DEFAULT_TABLET_FLOOR_PDF,
  DEFAULT_TABLET_SITE_PDF,
} from "@/lib/tabletPlanConfig";

export type { FloorPlanViewerHandle };

type Props = {
  siteSrc?: string;
  floorSrc?: string;
  activeHotspotId: string | null;
  exploreActive?: boolean;
  busy: boolean;
  onHotspotClick: (spot: FloorHotspot) => void;
  onReset?: () => void;
  onMapInteract?: () => void;
  onUserZoom?: () => void;
  /** 0=배치, 1+=평면 — 태블릿 하단 안내 문구 */
  onLodChange?: (lodIndex: number) => void;
};

const MIN_DISPLAY_ZOOM = 0.5;
const MAX_DISPLAY_ZOOM = 12;
const USER_ZOOM_EPS = 0.05;
const WHEEL_STEP_SITE = 0.12;
const WHEEL_STEP_FLOOR = 0.24;
const PINCH_STEP_SITE = 5;
const PINCH_STEP_FLOOR = 10;
const SITE_PDF_PIXEL_SCALE = 1.75;
const SITE_PDF_MAX_PX = 2400;
const FLOOR_PDF_PIXEL_SCALE = 2.5;
const FLOOR_PDF_MAX_PX = 2800;
const DISPLAY_CANVAS_MAX_PX = 2800;

type LoadedLayer = {
  viewBox: PlanViewBox;
  painted: HTMLCanvasElement;
};

export const FloorPlanDualPdfViewer = forwardRef<FloorPlanViewerHandle, Props>(
  function FloorPlanDualPdfViewer(
    {
      siteSrc = DEFAULT_TABLET_SITE_PDF,
      floorSrc = DEFAULT_TABLET_FLOOR_PDF,
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
    const siteCanvasRef = useRef<HTMLCanvasElement>(null);
    const floorCanvasRef = useRef<HTMLCanvasElement>(null);
    const siteLayerRef = useRef<LoadedLayer | null>(null);
    const floorLayerRef = useRef<LoadedLayer | null>(null);
    const transformRef = useRef<ReactZoomPanPinchRef | null>(null);
    const fitScaleRef = useRef(1);
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
    const [stageViewBox, setStageViewBox] = useState<PlanViewBox | null>(null);
    const [hotspots, setHotspots] = useState<FloorHotspot[]>([]);
    const [fitScale, setFitScale] = useState(1);
    const [transformReady, setTransformReady] = useState(false);
    const [viewReady, setViewReady] = useState(false);
    const [floorReady, setFloorReady] = useState(false);
    const [displayZoom, setDisplayZoom] = useState(1);
    const [lodIndex, setLodIndex] = useState(0);

    const showSite = lodIndex === 0;
    const showFloor = lodIndex >= 1;
    const showHotspots = dualPdfHotspotsVisible(showFloor, displayZoom);
    const wheelStep = showFloor ? WHEEL_STEP_FLOOR : WHEEL_STEP_SITE;
    const pinchStep = showFloor ? PINCH_STEP_FLOOR : PINCH_STEP_SITE;

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
        setLodIndex(0);
        emitLod(0);

        const api = transformRef.current;
        if (api) {
          api.centerView(nextFit, 0);
        }
        endSuppressInteract();
      },
      [emitLod, endSuppressInteract],
    );

    const recalcFit = useCallback(() => {
      const container = containerRef.current;
      if (!stageViewBox || !container) return;
      const next = computeFitScale(container.clientWidth, container.clientHeight, stageViewBox);
      const prev = fitScaleRef.current;
      if (prev > 0 && Math.abs(next - prev) / prev < 0.02) return;
      applyFit(next);
    }, [applyFit, stageViewBox]);

    const handleTransform = useCallback(
      (_ref: ReactZoomPanPinchRef, state: { scale: number }) => {
        const fit = fitScaleRef.current || 1;
        const dz = state.scale / fit;
        const wasOnFloor = lodRef.current >= 1;
        const nextLod = displayLodIndexDualPdf(dz, wasOnFloor);

        if (nextLod !== lodRef.current) {
          emitLod(nextLod);
        }
        setDisplayZoom(dz);
        setLodIndex(nextLod);

        if (suppressInteractRef.current) return;

        onMapInteract?.();

        if (!userZoomNotifiedRef.current && Math.abs(dz - 1) > USER_ZOOM_EPS) {
          userZoomNotifiedRef.current = true;
          onUserZoom?.();
        }
      },
      [emitLod, onMapInteract, onUserZoom],
    );

    const handleReset = useCallback(() => {
      const container = containerRef.current;
      if (!stageViewBox || !container) return;
      userZoomNotifiedRef.current = false;
      const next = computeFitScale(container.clientWidth, container.clientHeight, stageViewBox);
      fitScaleRef.current = next;
      setFitScale(next);
      applyFit(next);
      onReset?.();
      onMapInteract?.();
    }, [applyFit, onMapInteract, onReset, stageViewBox]);

    useImperativeHandle(ref, () => ({ resetView: handleReset }), [handleReset]);

    useEffect(() => {
      let cancelled = false;
      siteLayerRef.current = null;
      floorLayerRef.current = null;
      setStatus("loading");
      setTransformReady(false);
      setViewReady(false);
      setFloorReady(false);
      setErrorMsg("");
      setStageViewBox(null);
      setHotspots([]);
      userZoomNotifiedRef.current = false;

      const dpr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;
      const siteOff = document.createElement("canvas");
      const floorOff = document.createElement("canvas");

      void (async () => {
        try {
          const siteLoaded = await loadAndRenderPlanPdf(siteSrc, siteOff, SITE_PDF_PIXEL_SCALE * dpr, {
            maxPx: SITE_PDF_MAX_PX,
          });
          if (cancelled) return;

          siteLayerRef.current = { viewBox: siteLoaded.viewBox, painted: siteOff };
          setStageViewBox(siteLoaded.viewBox);
          setStatus("ready");

          try {
            const floorLoaded = await loadAndRenderPlanPdf(floorSrc, floorOff, FLOOR_PDF_PIXEL_SCALE * dpr, {
              maxPx: FLOOR_PDF_MAX_PX,
              timeoutMs: 20_000,
            });
            if (cancelled) return;

            floorLayerRef.current = { viewBox: floorLoaded.viewBox, painted: floorOff };
            setHotspots(hotspotsForViewBox(floorLoaded.viewBox));
            setFloorReady(true);
          } catch (floorErr) {
            console.warn("[FloorPlanDualPdf] floor PDF skipped", floorErr);
          }
        } catch (e) {
          if (cancelled) return;
          setStatus("error");
          setErrorMsg(e instanceof Error ? e.message : String(e));
        }
      })();

      return () => {
        cancelled = true;
        siteLayerRef.current = null;
        floorLayerRef.current = null;
      };
    }, [floorSrc, siteSrc]);

    useEffect(() => {
      if (status !== "ready" || !stageViewBox) return;

      const container = containerRef.current;
      if (!container) return;

      const nextFit = computeFitScale(container.clientWidth, container.clientHeight, stageViewBox);
      fitScaleRef.current = nextFit;
      setFitScale(nextFit);
      setTransformReady(true);
    }, [stageViewBox, status]);

    useEffect(() => {
      if (status !== "ready" || !transformReady || !stageViewBox) return;

      const site = siteLayerRef.current;
      if (site) {
        blitPlanToDisplayCanvas(site.painted, siteCanvasRef.current, DISPLAY_CANVAS_MAX_PX);
      }

      userZoomNotifiedRef.current = false;

      requestAnimationFrame(() => {
        applyFit(fitScaleRef.current);
        setViewReady(true);
        emitLod(0);
      });
    }, [applyFit, emitLod, stageViewBox, status, transformReady]);

    useEffect(() => {
      if (!floorReady || !viewReady) return;
      const floor = floorLayerRef.current;
      if (floor) {
        blitPlanToDisplayCanvas(floor.painted, floorCanvasRef.current, DISPLAY_CANVAS_MAX_PX);
      }
    }, [floorReady, viewReady]);

    useEffect(() => {
      const container = containerRef.current;
      if (!container || !stageViewBox || status !== "ready" || !viewReady) return;

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
    }, [recalcFit, status, stageViewBox, viewReady]);

    const stageWidth = stageViewBox?.width ?? 400;
    const stageHeight = stageViewBox?.height ?? 300;

    return (
      <div ref={containerRef} className="xfloor-svg-viewer xfloor-pdf-viewer xfloor-dual-pdf-viewer">
        {(status === "loading" || (status === "ready" && !viewReady)) && (
          <div className="xfloor-svg-loading" aria-live="polite">
            도면 불러오는 중…
          </div>
        )}
        {status === "error" && (
          <div className="xfloor-svg-error">
            <p>PDF 도면을 표시할 수 없습니다.</p>
            <p className="xfloor-svg-error-detail">{errorMsg}</p>
            <p className="xfloor-svg-error-detail">
              배치: {siteSrc} · 평면: {floorSrc}
            </p>
            <a className="xfloor-pdf-open-tab" href={siteSrc} target="_blank" rel="noreferrer">
              배치 PDF 열기
            </a>
          </div>
        )}

        {status === "ready" && stageViewBox && transformReady && (
          <>
            <TransformWrapper
              ref={transformRef}
              initialScale={fitScale}
              minScale={fitScale * MIN_DISPLAY_ZOOM}
              maxScale={fitScale * MAX_DISPLAY_ZOOM}
              centerOnInit
              smooth={false}
              wheel={{ step: wheelStep, smooth: false }}
              pinch={{ step: pinchStep, disabled: false }}
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
                  style={{ width: stageWidth, height: stageHeight, visibility: viewReady ? "visible" : "hidden" }}
                >
                  <canvas
                    ref={siteCanvasRef}
                    className={`xfloor-pdf-plan-canvas xfloor-dual-pdf-site${showSite ? " is-active" : ""}`}
                    aria-hidden={!showSite}
                  />
                  <div
                    className={`xfloor-dual-pdf-floor-overlay${showFloor && floorReady ? " is-active" : ""}`}
                    style={
                      {
                        "--xfloor-floor-scale": DUAL_PDF_FLOOR_STAGE_RATIO,
                      } as React.CSSProperties
                    }
                    aria-hidden={!showFloor || !floorReady}
                  >
                    <canvas ref={floorCanvasRef} className="xfloor-pdf-plan-canvas" aria-hidden={!showFloor} />
                    {showHotspots
                      ? hotspots.map((spot) => (
                          <button
                            key={spot.id}
                            type="button"
                            className={`xfloor-hotspot xfloor-hotspot--map xfloor-hotspot--${spot.id}${spot.id === "transfer" ? " xfloor-hotspot--transfer" : ""} ${activeHotspotId === spot.id ? "is-active" : ""}`}
                            data-zone={spot.targetZone}
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
                </div>
              </TransformComponent>
            </TransformWrapper>

            {viewReady && (
              <>
                <div className="xfloor-map-hud xfloor-map-hud--tr" aria-live="polite">
                  <span className="xfloor-map-hud-label">줌</span>
                  <span className="xfloor-mono">{displayZoom.toFixed(2)}×</span>
                </div>

                <div className="xfloor-map-hud xfloor-map-hud--bl" aria-live="polite">
                  <span className="xfloor-map-hud-label">표시</span>
                  <span className="xfloor-mono">{lodStatusLabel(lodIndex)}</span>
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
          </>
        )}
      </div>
    );
  },
);
