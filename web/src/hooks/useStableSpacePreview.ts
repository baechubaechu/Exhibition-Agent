"use client";

import { useEffect, useRef, useState } from "react";
import type { SpacePreviewResolved } from "@/lib/monitorSpacePreview";

/** Space response 렌더 — 너무 잦은 전환 방지 (최소 holdMs 간격) */
export function useStableSpacePreview(next: SpacePreviewResolved, holdMs = 1500): SpacePreviewResolved {
  const [shown, setShown] = useState(next);
  const shownAtRef = useRef(Date.now());
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (next.id === shown.id && next.src === shown.src) return;

    window.clearTimeout(timerRef.current);
    const elapsed = Date.now() - shownAtRef.current;
    const delay = Math.max(0, holdMs - elapsed);

    timerRef.current = window.setTimeout(() => {
      shownAtRef.current = Date.now();
      setShown(next);
    }, delay);

    return () => window.clearTimeout(timerRef.current);
  }, [next, shown.id, shown.src, holdMs]);

  return shown;
}
