"use client";

type Props = {
  /** true = 평면( Main Plan 강조 ), false = 배치( Site Plan 강조 ) */
  floorActive: boolean;
};

/** 태블릿 도면 — Site / Main Plan 라벨 (줌에 따라 강조·위치 교체) */
export function FloorPlanLabelIslands({ floorActive }: Props) {
  return (
    <div
      className={`xfloor-plan-islands${floorActive ? " is-floor" : " is-site"}`}
      role="group"
      aria-label={floorActive ? "Main Plan" : "Site Plan"}
    >
      <div className="xfloor-plan-island xfloor-plan-island--site">
        <p className="xfloor-plan-island-kicker">X-tra Space</p>
        <p className="xfloor-plan-island-title">Site Plan</p>
      </div>
      <div className="xfloor-plan-island xfloor-plan-island--main">
        <p className="xfloor-plan-island-kicker">X-tra Space</p>
        <p className="xfloor-plan-island-title">Main Plan</p>
      </div>
    </div>
  );
}
