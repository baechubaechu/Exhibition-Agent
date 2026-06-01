import { LOD_LAYER_IDS, type LodLayerId } from "@/lib/floorPlanLod";

export type PlanViewBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type LoadedPlanSvg = {
  svg: SVGSVGElement;
  viewBox: PlanViewBox;
  lodLayers: Partial<Record<LodLayerId, SVGGElement>>;
};

function parseViewBox(raw: string | null, svg: SVGSVGElement): PlanViewBox {
  if (raw) {
    const parts = raw.trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
      return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
    }
  }

  const w = Number(svg.getAttribute("width")) || 400;
  const h = Number(svg.getAttribute("height")) || 300;
  return { x: 0, y: 0, width: w, height: h };
}

function stripUnsafeSvgNodes(svg: SVGSVGElement): void {
  svg.querySelectorAll("script, foreignObject").forEach((node) => node.remove());
  svg.querySelectorAll("*").forEach((node) => {
    for (const attr of Array.from(node.attributes)) {
      if (/^on/i.test(attr.name)) {
        node.removeAttribute(attr.name);
      }
    }
  });
}

export function collectLodLayers(svg: SVGSVGElement): Partial<Record<LodLayerId, SVGGElement>> {
  const layers: Partial<Record<LodLayerId, SVGGElement>> = {};
  for (const id of LOD_LAYER_IDS) {
    const el = svg.getElementById(id);
    if (el instanceof SVGGElement) {
      layers[id] = el;
    } else if (el) {
      console.warn(`[FloorPlan] #${id} exists but is not an <g> element`);
    } else {
      console.warn(`[FloorPlan] missing layer #${id}`);
    }
  }
  return layers;
}

export async function fetchPlanSvg(src: string): Promise<LoadedPlanSvg> {
  const url = typeof window !== "undefined" ? new URL(src, window.location.origin).href : src;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(
      res.status === 404 ? `파일 없음(404): ${src}` : `SVG 로드 실패 HTTP ${res.status}`,
    );
  }

  const text = await res.text();
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  const parseError = doc.querySelector("parsererror");
  if (parseError) {
    const detail = parseError.textContent?.trim().slice(0, 200);
    throw new Error(detail ? `SVG 파싱 실패: ${detail}` : "SVG 파싱 실패");
  }

  const root = doc.documentElement;
  if (!(root instanceof SVGSVGElement)) {
    throw new Error("루트 요소가 <svg>가 아닙니다");
  }

  stripUnsafeSvgNodes(root);

  const viewBox = parseViewBox(root.getAttribute("viewBox"), root);
  root.setAttribute("width", "100%");
  root.setAttribute("height", "100%");
  root.setAttribute("preserveAspectRatio", "xMidYMid meet");
  root.style.display = "block";

  return {
    svg: root,
    viewBox,
    lodLayers: collectLodLayers(root),
  };
}

export function computeFitScale(
  containerWidth: number,
  containerHeight: number,
  viewBox: PlanViewBox,
  padding = 0.94,
): number {
  if (containerWidth < 1 || containerHeight < 1 || viewBox.width < 1 || viewBox.height < 1) {
    return 1;
  }
  return Math.min(containerWidth / viewBox.width, containerHeight / viewBox.height) * padding;
}
