import type { MonitorOutputRow } from "@/lib/monitorOutputs";

type Props = {
  rows: MonitorOutputRow[];
};

function sliderPercent(activeIndex: number, count: number): number {
  if (count <= 1) return 100;
  return (activeIndex / (count - 1)) * 100;
}

/** Space response — 라벨·힌트 유지, 아래 슬라이더로 현재 연출 위치 표시 */
export function MonitorOutputBoard({ rows }: Props) {
  return (
    <div className="monitor-outputs" aria-label="Space response · 출력 연출">
      {rows.map((row) => {
        const active = row.options[row.activeIndex] ?? row.options[0];
        const pct = sliderPercent(row.activeIndex, row.options.length);

        return (
          <div key={row.id} className="monitor-output-row">
            <div className="monitor-output-head">
              <span className="monitor-output-label">{row.label}</span>
              {row.hint ? <span className="monitor-output-hint">{row.hint}</span> : null}
            </div>

            <div className="monitor-output-slider-block" aria-label={`${row.label} · ${active}`}>
              <div
                className="monitor-output-slider"
                role="slider"
                aria-valuemin={0}
                aria-valuemax={Math.max(0, row.options.length - 1)}
                aria-valuenow={row.activeIndex}
                aria-valuetext={active}
                style={{ "--slider-pct": `${pct}%` } as React.CSSProperties}
              >
                <div className="monitor-output-slider-track" aria-hidden="true">
                  <div className="monitor-output-slider-fill" />
                  <div className="monitor-output-slider-thumb" />
                </div>
                <ul
                  className="monitor-output-slider-ticks"
                  aria-hidden="true"
                  style={{ "--tick-cols": String(row.options.length) } as React.CSSProperties}
                >
                  {row.options.map((opt, i) => (
                    <li
                      key={opt}
                      className={`monitor-output-slider-tick${i === row.activeIndex ? " is-active" : ""}`}
                    >
                      <span className="monitor-output-slider-dot" />
                      <span className="monitor-output-slider-opt">{opt}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <p className="monitor-output-current">
                현재 <strong>{active}</strong>
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
