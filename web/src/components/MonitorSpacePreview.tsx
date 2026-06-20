"use client";

import { useEffect, useRef, useState } from "react";
import type { SpacePreviewResolved } from "@/lib/monitorSpacePreview";
import { SPACE_RENDER_SRCS } from "@/lib/monitorSpacePreview";

const FADE_MS = 750;

type Props = SpacePreviewResolved;

export function MonitorSpacePreview({ id, src, captionKo }: Props) {
  const [currentId, setCurrentId] = useState(id);
  const [previousId, setPreviousId] = useState<string | null>(null);
  const prevIdRef = useRef(id);

  useEffect(() => {
    for (const preload of SPACE_RENDER_SRCS) {
      const img = new Image();
      img.src = preload;
    }
  }, []);

  useEffect(() => {
    if (id === prevIdRef.current) return;
    setPreviousId(prevIdRef.current);
    setCurrentId(id);
    prevIdRef.current = id;
    const t = window.setTimeout(() => setPreviousId(null), FADE_MS + 80);
    return () => window.clearTimeout(t);
  }, [id]);

  const layers: Array<{ key: string; src: string; active: boolean }> = [];
  if (previousId) {
    layers.push({
      key: `prev-${previousId}`,
      src: `/monitor/space/rsp__${previousId}.png`,
      active: false,
    });
  }
  layers.push({ key: `cur-${currentId}`, src, active: true });

  return (
    <div className="monitor-space-preview">
      <div className="xfloor-map-wrap monitor-visual-frame monitor-space-preview-frame">
        <div className="monitor-space-stage" aria-hidden={false}>
          {layers.map((layer) => (
            <div
              key={layer.key}
              className={`monitor-space-slide${layer.active ? " is-active" : ""}`}
              aria-hidden={!layer.active}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={layer.src} alt="" className="monitor-space-image" draggable={false} />
            </div>
          ))}
        </div>
      </div>
      <p className="monitor-space-caption" role="status">
        {captionKo}
      </p>
    </div>
  );
}
