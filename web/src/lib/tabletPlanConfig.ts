/** 태블릿 도면 — SVG(레이어) 또는 PDF 2장(배치·평면) */

export type TabletPlanMode = "svg" | "dual-pdf";

const trim = (v: string | undefined): string | undefined => {
  const t = v?.trim();
  return t && t.length > 0 ? t : undefined;
};

export const DEFAULT_TABLET_PLAN_SVG = "/drawings/tablet-plan.svg";

export const DEFAULT_TABLET_SITE_PDF = "/drawings/tablet-site.pdf";
export const DEFAULT_TABLET_FLOOR_PDF = "/drawings/tablet-floor.pdf";

export function tabletPlanSvgSrc(): string {
  return trim(process.env.NEXT_PUBLIC_TABLET_PLAN_SVG) ?? DEFAULT_TABLET_PLAN_SVG;
}

export function tabletSitePdfSrc(): string {
  return trim(process.env.NEXT_PUBLIC_TABLET_PLAN_SITE_PDF) ?? DEFAULT_TABLET_SITE_PDF;
}

export function tabletFloorPdfSrc(): string {
  return trim(process.env.NEXT_PUBLIC_TABLET_PLAN_FLOOR_PDF) ?? DEFAULT_TABLET_FLOOR_PDF;
}

export function tabletPlanModeEnv(): TabletPlanMode | "auto" {
  const raw = trim(process.env.NEXT_PUBLIC_TABLET_PLAN_MODE);
  if (raw === "svg" || raw === "dual-pdf") return raw;
  return "auto";
}

export async function urlExists(url: string, timeoutMs = 2500): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      let res = await fetch(url, { method: "HEAD", cache: "no-store", signal: controller.signal });
      if (res.status === 405 || res.status === 501) {
        res = await fetch(url, {
          method: "GET",
          cache: "no-store",
          headers: { Range: "bytes=0-0" },
          signal: controller.signal,
        });
      }
      return res.ok;
    } finally {
      window.clearTimeout(timer);
    }
  } catch {
    return false;
  }
}

/** auto: 배치·평면 PDF 둘 다 있으면 dual-pdf, 아니면 svg */
export async function resolveTabletPlanMode(): Promise<TabletPlanMode> {
  const forced = tabletPlanModeEnv();
  if (forced !== "auto") return forced;

  const site = tabletSitePdfSrc();
  const floor = tabletFloorPdfSrc();
  const [hasSite, hasFloor] = await Promise.all([urlExists(site), urlExists(floor)]);
  if (hasSite && hasFloor) return "dual-pdf";
  // HEAD 프로브가 태블릿·오프라인에서 멈추거나 실패해도 public/drawings PDF 는 번들에 포함 → dual-pdf 시도
  if (!hasSite && !hasFloor) return "dual-pdf";
  return "svg";
}
