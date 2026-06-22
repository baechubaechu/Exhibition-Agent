"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EXPLORE_MEDIA_RENDER_WIP } from "@/lib/exhibitExploreMedia";
import type { MonitorZoneContent, MonitorZoneSlide } from "@/lib/monitorZoneContent";

const SLIDE_MS = 8000;

type Props = {
  zone: MonitorZoneContent;
};

function slideKey(slide: MonitorZoneSlide, index: number): string {
  return `${slide.kind}:${slide.src}:${index}`;
}

export function MonitorExploreMedia({ zone }: Props) {
  const slides = zone.slides;
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState<Set<string>>(() => new Set());

  const visibleSlides = useMemo(
    () =>
      slides
        .map((slide, i) => ({ slide, key: slideKey(slide, i) }))
        .filter(({ key }) => !failed.has(key)),
    [slides, failed],
  );

  const activeIndex = visibleSlides.length === 0 ? 0 : index % visibleSlides.length;

  const markFailed = useCallback((key: string) => {
    setFailed((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }, []);

  useEffect(() => {
    setIndex(0);
    setFailed(new Set());
  }, [zone.hotspotId]);

  useEffect(() => {
    if (visibleSlides.length <= 1) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % visibleSlides.length);
    }, SLIDE_MS);
    return () => window.clearInterval(id);
  }, [visibleSlides.length, zone.hotspotId]);

  useEffect(() => {
    if (index >= visibleSlides.length && visibleSlides.length > 0) {
      setIndex(0);
    }
  }, [index, visibleSlides.length]);

  return (
    <section className="monitor-panel monitor-panel--visual monitor-explore-media" aria-label={`${zone.label} 미디어`}>
      <h2 className="monitor-panel-title">{zone.label}</h2>
      <div className="xfloor-map-wrap monitor-visual-frame monitor-explore-media-frame">
        {visibleSlides.length > 0 ? (
          <div className={`monitor-explore-media-stage${EXPLORE_MEDIA_RENDER_WIP ? " is-wip" : ""}`}>
            {visibleSlides.map(({ slide, key }, i) => {
              const isActive = i === activeIndex;
              return (
                <div key={key} className={`monitor-explore-slide${isActive ? " is-active" : ""}`} aria-hidden={!isActive}>
                  {slide.kind === "video" ? (
                    <video
                      className="monitor-zone-video"
                      src={slide.src}
                      autoPlay={isActive}
                      loop
                      muted
                      playsInline
                      preload="auto"
                      onError={() => markFailed(key)}
                    />
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={slide.src}
                      alt={slide.alt ?? zone.label}
                      className="monitor-explore-image"
                      onError={() => markFailed(key)}
                    />
                  )}
                </div>
              );
            })}
            {EXPLORE_MEDIA_RENDER_WIP ? (
              <div className="monitor-explore-media-wip" aria-label="렌더 작업 준비 중">
                <p className="monitor-explore-media-wip-ko">렌더 작업 준비 중</p>
                <p className="monitor-explore-media-wip-en">Rendering in progress</p>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="xfloor-pdf-loading monitor-cam-placeholder">
            <p className="monitor-cam-placeholder-title">미디어 준비 중</p>
            <p className="xfloor-status-row--hint monitor-cam-placeholder-hint">
              public/zones 또는 public/videos에 파일을 추가하세요.
            </p>
          </div>
        )}
        {visibleSlides.length > 1 && !EXPLORE_MEDIA_RENDER_WIP ? (
          <div className="monitor-explore-dots" aria-hidden="true">
            {visibleSlides.map(({ key }, i) => (
              <span key={key} className={`monitor-explore-dot${i === activeIndex ? " is-active" : ""}`} />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
