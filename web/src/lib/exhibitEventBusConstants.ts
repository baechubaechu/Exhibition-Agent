/** `pull`/재생용 메모리 순환 버퍼 상한. UI 표시용 — 서버 `eventBus`와 숫자만 맞추면 됨. */
export const EVENT_BUS_MAX_STORED_EVENTS = 500;

function readPollMs(raw: string | undefined, fallback: number, min = 100, max = 30_000): number {
  if (raw == null || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** UI 상태 폴링·마이크 기반 sensor 발행 주기(ms) — `NEXT_PUBLIC_EXHIBIT_POLL_INTERVAL_MS` */
export const EXHIBIT_POLL_INTERVAL_MS = readPollMs(process.env.NEXT_PUBLIC_EXHIBIT_POLL_INTERVAL_MS, 500);

/**
 * `/monitor` Explore — 태블릿 scene.execute 반영.
 * dev Node 부하 줄이려면 `NEXT_PUBLIC_MONITOR_EXPLORE_BUS_POLL_MS=300` 등으로 완화.
 */
export const MONITOR_EXPLORE_BUS_POLL_MS = readPollMs(process.env.NEXT_PUBLIC_MONITOR_EXPLORE_BUS_POLL_MS, 250);

/** `/monitor` 에이전트 상태 — `NEXT_PUBLIC_MONITOR_AGENT_POLL_MS` */
export const MONITOR_AGENT_POLL_MS = readPollMs(process.env.NEXT_PUBLIC_MONITOR_AGENT_POLL_MS, 400);
