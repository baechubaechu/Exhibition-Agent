"use client";

import { useEffect, useRef, useState } from "react";
import type { SpacePreviewResolved } from "@/lib/monitorSpacePreview";
import { SPACE_RENDER_SRCS } from "@/lib/monitorSpacePreview";

const FADE_MS = 1200;

type Props = SpacePreviewResolved;

export function MonitorSpacePreview({ id, src }: Props) {
  // 크로스페이드: 레이어를 id 별 "안정적인 key" 로 유지해야 opacity 트랜지션이 동작한다.
  // (key 가 바뀌면 엘리먼트가 새로 마운트돼 목표 opacity 로 즉시 그려지고 페이드가 사라짐)
  const [layers, setLayers] = useState<Array<{ id: string; src: string }>>([{ id, src }]);
  const [activeId, setActiveId] = useState(id);
  const prevIdRef = useRef(id);

  useEffect(() => {
    for (const preload of SPACE_RENDER_SRCS) {
      const img = new Image();
      img.src = preload;
      // 전환 시 디코딩 멈칫 방지 — 미리 비트맵으로 디코딩해 캐시
      void img.decode?.().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (id === prevIdRef.current) return;
    prevIdRef.current = id;

    // 새 레이어를 (이전 레이어는 유지한 채) 맨 위에 opacity:0 으로 추가
    setLayers((cur) => {
      const withoutDup = cur.filter((l) => l.id !== id);
      return [...withoutDup, { id, src }];
    });

    // 다음 프레임에 활성화 → 0→1 페이드인, 동시에 이전 레이어는 1→0 페이드아웃
    const raf = window.requestAnimationFrame(() => setActiveId(id));

    // 페이드 종료 후 현재 레이어만 남김
    const t = window.setTimeout(() => {
      setLayers([{ id, src }]);
    }, FADE_MS + 120);

    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(t);
    };
  }, [id, src]);

  return (
    <div className="monitor-space-preview">
      <div className="xfloor-map-wrap monitor-visual-frame monitor-space-preview-frame">
        <div className="monitor-space-stage" aria-hidden={false}>
          {layers.map((layer) => {
            const active = layer.id === activeId;
            return (
              <div
                key={layer.id}
                className={`monitor-space-slide${active ? " is-active" : ""}`}
                aria-hidden={!active}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={layer.src} alt="" className="monitor-space-image" draggable={false} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
