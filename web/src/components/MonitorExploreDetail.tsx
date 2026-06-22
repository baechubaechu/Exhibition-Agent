import type { MonitorZoneContent } from "@/lib/monitorZoneContent";

type Props = {
  zone: MonitorZoneContent;
};

/** Explore — 우측 구역 설명 (챗봇 canonical 위키 기반) */
export function MonitorExploreDetail({ zone }: Props) {
  return (
    <section className="monitor-panel monitor-panel--detail monitor-explore-detail" aria-label={`${zone.label} 설명`}>
      <header className="monitor-explore-detail-head">
        <p className="monitor-explore-detail-kicker">{zone.label}</p>
        <h2 className="monitor-explore-detail-title">{zone.titleKo}</h2>
        <p className="monitor-explore-detail-sub">{zone.subtitleKo}</p>
      </header>

      <p className="monitor-explore-detail-lead">{zone.leadKo}</p>

      <div className="monitor-explore-detail-sections">
        {zone.sectionsKo.map((section) => (
          <article key={section.heading} className="monitor-explore-detail-section">
            <h3>{section.heading}</h3>
            {section.paragraphs?.map((para) => (
              <p key={para.slice(0, 40)}>{para}</p>
            ))}
            {section.bullets && section.bullets.length > 0 ? (
              <ul>
                {section.bullets.map((item) => (
                  <li key={item.slice(0, 48)}>{item}</li>
                ))}
              </ul>
            ) : null}
          </article>
        ))}
      </div>

      <footer className="monitor-explore-detail-foot">
        <p className="monitor-explore-detail-foot-label">QR 챗봇 추천 질문</p>
        <ul className="monitor-explore-detail-chatbot">
          {zone.chatbotPromptsKo.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ul>
        <p className="monitor-explore-detail-handoff">{zone.handoffHintKo}</p>
      </footer>
    </section>
  );
}
