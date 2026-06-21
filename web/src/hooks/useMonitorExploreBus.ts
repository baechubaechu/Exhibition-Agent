"use client";

import { useEffect, useRef, useState } from "react";
import { hotspotIdFromReason } from "@/lib/exhibitPresence";
import { MONITOR_EXPLORE_BUS_POLL_MS } from "@/lib/exhibitEventBusConstants";

type SceneExecuteEvent = {
  payload?: { reason?: string; sceneId?: string; holdSec?: number };
  envelope?: { timestamp?: string };
};

type SensorStateEvent = {
  payload?: { peopleCount?: number };
};

/** floor_hotspot scene.execute 가 holdSec 안쪽일 때만 Explore 로 간주 */
function freshHotspotId(evt: SceneExecuteEvent | undefined): string | null {
  if (!evt?.payload) return null;
  const reason = String(evt.payload.reason ?? "");
  if (reason.startsWith("visitor:reset")) return null;
  const hid = hotspotIdFromReason(reason);
  if (!hid) return null;
  const ts = evt.envelope?.timestamp ? Date.parse(evt.envelope.timestamp) : NaN;
  if (Number.isNaN(ts)) return null;
  const holdMs = Math.max(5, Math.min(600, evt.payload.holdSec ?? 120)) * 1000;
  return Date.now() - ts <= holdMs ? hid : null;
}

/**
 * 태블릿 핫스pot → 모니터 Explore — 이벤트 버스 직결(에이전트 폴링보다 빠름).
 * `/api/events/state` 1회 폴링으로 Explore 핫스pot·인원 fallback 을 함께 제공.
 */
export function useMonitorExploreBus() {
  const [exploreHotspotId, setExploreHotspotId] = useState<string | null>(null);
  const [peopleCountFallback, setPeopleCountFallback] = useState(0);
  const [busReady, setBusReady] = useState(false);
  const readyRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    const poll = async () => {
      try {
        const res = await fetch("/api/events/state", { cache: "no-store" });
        if (!res.ok || !mounted) return;
        const j = (await res.json()) as {
          latest?: {
            "scene.execute"?: SceneExecuteEvent;
            "sensor.state"?: SensorStateEvent;
          };
        };
        if (!mounted) return;

        const hid = freshHotspotId(j.latest?.["scene.execute"]);
        setExploreHotspotId((prev) => (prev === hid ? prev : hid));

        const people = j.latest?.["sensor.state"]?.payload?.peopleCount;
        if (typeof people === "number") {
          const clamped = Math.min(300, Math.max(0, people));
          setPeopleCountFallback((prev) => (prev === clamped ? prev : clamped));
        }

        if (!readyRef.current) {
          readyRef.current = true;
          setBusReady(true);
        }
      } catch {
        /* ignore */
      }
    };

    void poll();
    const id = window.setInterval(() => void poll(), MONITOR_EXPLORE_BUS_POLL_MS);
    return () => {
      mounted = false;
      window.clearInterval(id);
    };
  }, []);

  return { exploreHotspotId, peopleCountFallback, busReady };
}
