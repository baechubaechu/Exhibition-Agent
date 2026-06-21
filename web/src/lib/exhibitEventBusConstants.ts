/** `pull`/재생용 메모리 순환 버퍼 상한. UI 표시용 — 서버 `eventBus`와 숫자만 맞추면 됨. */
export const EVENT_BUS_MAX_STORED_EVENTS = 500;

/** UI 상태 폴링·마이크 기반 sensor 발행 주기(ms) — 반응성 개선 */
export const EXHIBIT_POLL_INTERVAL_MS = 500;

/** `/monitor` Explore — 태블릿 scene.execute 를 에이전트보다 먼저 반영 */
export const MONITOR_EXPLORE_BUS_POLL_MS = 120;
