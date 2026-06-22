import type { MonitorSituationBrief as Brief } from "@/lib/monitorSituationBrief";

type Props = Brief;

export function MonitorSituationBriefPanel({ situationKo, goalKo }: Props) {
  return (
    <section className="monitor-situation-brief" aria-label="전시 상황 설명">
      <div className="monitor-situation-brief-row">
        <p className="monitor-situation-brief-item">
          <span className="monitor-situation-brief-label">현재 상황</span>
          <span className="monitor-situation-brief-text">{situationKo}</span>
        </p>
        <p className="monitor-situation-brief-item">
          <span className="monitor-situation-brief-label">AI 목표</span>
          <span className="monitor-situation-brief-text">{goalKo}</span>
        </p>
      </div>
    </section>
  );
}
