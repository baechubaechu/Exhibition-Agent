import type { MonitorStateChip } from "@/lib/monitorStateSummary";
import type { PresenceMode } from "@/lib/exhibitPresence";
import { PRESENCE_MODE_META } from "@/lib/exhibitPresence";

type Props = {
  mode: PresenceMode;
  states: MonitorStateChip[];
};

export function MonitorModeHero({ mode, states }: Props) {
  const meta = PRESENCE_MODE_META[mode];

  return (
    <section className={`monitor-mode-bar monitor-mode-bar--${mode}`} aria-label="현재 presence 모드">
      <div className="monitor-mode-bar-primary">
        <span className="monitor-mode-bar-kicker">Current mode</span>
        <span className="monitor-mode-bar-title">{meta.ko}</span>
        {meta.en !== meta.ko ? (
          <>
            <span className="monitor-mode-bar-dot" aria-hidden>
              ·
            </span>
            <span className="monitor-mode-bar-en">{meta.en}</span>
          </>
        ) : null}
      </div>

      <ul className="monitor-mode-bar-states" aria-label="입력 판정 요약">
        {states.map((s) => (
          <li key={s.id} className="monitor-mode-bar-state">
            <span className="monitor-mode-bar-state-label">{s.label}</span>
            <span className="monitor-mode-bar-state-value">{s.value}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
