/** LAN 전시 프리뷰로 현실적인 하한. stream 모드는 33ms(~30fps 목표)까지 */
export const EXHIBIT_PREVIEW_INTERVAL_MIN_MS = 33;

const rawEnv = process.env.NEXT_PUBLIC_EXHIBIT_PREVIEW_INTERVAL_MS;
const parsed = rawEnv !== undefined && rawEnv !== "" ? Number(rawEnv) : undefined;
const streamDefault =
  process.env.NEXT_PUBLIC_EXHIBIT_PREVIEW_MODE === "stream" ? 33 : 125;

/** 태블릿 업로드 간격 = `/signage`·모니터 폴링( poll 모드 )과 동일하게 맞춤 */
export const EXHIBIT_PREVIEW_PUSH_MS = Math.max(
  EXHIBIT_PREVIEW_INTERVAL_MIN_MS,
  Number.isFinite(parsed) ? (parsed as number) : streamDefault,
);
