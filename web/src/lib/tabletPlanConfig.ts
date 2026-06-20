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

export async function urlExists(url: string): Promise<boolean> {
  try {
    let res = await fetch(url, { method: "HEAD", cache: "no-store" });
    if (res.status === 405 || res.status === 501) {
      res = await fetch(url, { method: "GET", cache: "no-store", headers: { Range: "bytes=0-0" } });
    }
    return res.ok;
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
  return hasSite && hasFloor ? "dual-pdf" : "svg";
}
