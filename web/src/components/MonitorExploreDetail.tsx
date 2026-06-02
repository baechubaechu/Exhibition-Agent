import type { MonitorZoneContent } from "@/lib/monitorZoneContent";

type Props = {
  zone: MonitorZoneContent;
};

/** Explore — 우측 구역 설명 */
export function MonitorExploreDetail({ zone }: Props) {
  return (
    <section className="monitor-panel monitor-panel--detail monitor-explore-detail" aria-label={`${zone.label} 설명`}>
      <p className="monitor-explore-detail-kicker">{zone.label}</p>
      <h2 className="monitor-explore-detail-title">{zone.titleKo}</h2>
      <p className="monitor-explore-detail-en">{zone.titleEn}</p>
      <p className="monitor-explore-detail-body">{zone.bodyKo}</p>
      <p className="monitor-explore-detail-body-en">{zone.bodyEn}</p>
      {zone.pointsKo.length > 0 ? (
        <ul className="monitor-explore-detail-points">
          {zone.pointsKo.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
