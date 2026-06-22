import { hotspotMapLabel } from "@/lib/floorPlanHotspots";
import type { MonitorZoneContent } from "@/lib/monitorZoneContent";

type Props = {
  zone: MonitorZoneContent;
};

/** Explore — 우측 구역 설명 */
export function MonitorExploreDetail({ zone }: Props) {
  const titleEn = hotspotMapLabel(zone.hotspotId);

  return (
    <section className="monitor-panel monitor-panel--detail monitor-explore-detail" aria-label={`${titleEn} 설명`}>
      <header className="monitor-explore-detail-head">
        <h2 className="monitor-explore-detail-title">{titleEn}</h2>
        <p className="monitor-explore-detail-sub">{zone.subtitleKo}</p>
      </header>

      <p className="monitor-explore-detail-lead">{zone.leadKo}</p>

      <div className="monitor-explore-detail-body">
        {zone.bodyKo.map((para) => (
          <p key={para.slice(0, 48)}>{para}</p>
        ))}
      </div>
    </section>
  );
}
