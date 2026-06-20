/** fetch·Vision 실패가 네트워크/오프라인 때문인지 판별 */

export function isBrowserOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

export function isLikelyNetworkError(err: unknown): boolean {
  if (isBrowserOffline()) return true;
  if (err instanceof TypeError) {
    const m = err.message.toLowerCase();
    if (m.includes("fetch") || m.includes("network") || m.includes("failed to fetch")) return true;
  }
  if (err instanceof DOMException && err.name === "AbortError") return true;
  if (err instanceof Error) {
    const m = err.message.toLowerCase();
    if (m.includes("network") || m.includes("failed to fetch") || m.includes("load failed")) return true;
  }
  return false;
}

export function networkErrorMessageKo(): string {
  return "인터넷 연결이 끊겨 비전 분석(Cloud Vision)을 사용할 수 없습니다. Live view(웹캠)와 마이크 소음은 브라우저에서 계속 동작합니다. 네트워크가 복구되면 자동으로 재시도합니다.";
}

export function visionReachabilityMessageKo(detail?: string): string {
  const base =
    "비전 서버(FastAPI·Cloud Vision)에 연결할 수 없습니다. Live view는 로컬 웹캠이며 서버로 영상을 보내지 않습니다.";
  return detail ? `${base} (${detail})` : base;
}
