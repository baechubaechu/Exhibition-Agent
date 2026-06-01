"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FLOOR_PIN_SCENE_OPTIONS, getHotspotMetaById, type HotspotMeta } from "@/lib/floorPlanHotspots";

const DEFAULT_HOLD_SEC = 120;

type Zone = HotspotMeta["targetZone"];

type Props = {
  hotspotId: string | null;
  manualRemainingSec?: number | null;
  agentErr?: string | null;
};

/** 시연용 — Space response 하단 작은 링크로만 열림 */
export function MonitorExploreControls({ hotspotId, manualRemainingSec, agentErr }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const spot = getHotspotMetaById(hotspotId);
  const [sceneId, setSceneId] = useState("");
  const [targetZone, setTargetZone] = useState<Zone>("zoneA");
  const [holdSec, setHoldSec] = useState(DEFAULT_HOLD_SEC);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const s = getHotspotMetaById(hotspotId);
    if (!s) return;
    setSceneId(s.sceneId);
    setTargetZone(s.targetZone);
    setHoldSec(DEFAULT_HOLD_SEC);
    setMsg("");
  }, [hotspotId]);

  const openDialog = useCallback(() => {
    dialogRef.current?.showModal();
  }, []);

  const closeDialog = useCallback(() => {
    dialogRef.current?.close();
  }, []);

  const publishScene = useCallback(async () => {
    if (!spot) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/events/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: "scene.execute",
          source: "monitor-explore-controls",
          payload: {
            sceneId,
            reason: `floor_hotspot:${spot.id}`,
            holdSec,
            targetZone,
          },
        }),
      });
      const text = await res.text();
      setMsg(res.ok ? "연출을 적용했습니다." : text.slice(0, 120) || "전송 실패");
    } catch {
      setMsg("네트워크 오류");
    } finally {
      setBusy(false);
    }
  }, [holdSec, sceneId, spot, targetZone]);

  const resumeLive = useCallback(async () => {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/events/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetZone: "all", reason: "monitor resume live" }),
      });
      const text = await res.text();
      setMsg(res.ok ? "전시장 자동 연동으로 복귀했습니다." : text.slice(0, 120) || "복귀 실패");
    } catch {
      setMsg("네트워크 오류");
    } finally {
      setBusy(false);
    }
  }, []);

  const inManual = typeof manualRemainingSec === "number";

  return (
    <>
      <div className="monitor-panel-foot">
        {agentErr ? <span className="monitor-error">{agentErr}</span> : null}
        <button type="button" className="monitor-demo-link" onClick={openDialog}>
          scene tuning
        </button>
      </div>

      <dialog ref={dialogRef} className="monitor-tuning-dialog" aria-label="Scene tuning">
        <form method="dialog" className="monitor-tuning-dialog-inner">
          <header className="monitor-tuning-dialog-head">
            <h2 className="monitor-tuning-dialog-title">Scene tuning</h2>
            <button type="submit" className="monitor-tuning-dialog-close" aria-label="닫기">
              ×
            </button>
          </header>

          {!spot ? (
            <p className="monitor-controls-idle">태블릿에서 장소를 선택하면 여기서 연출을 조절할 수 있습니다.</p>
          ) : (
            <>
              <p className="monitor-panel-lead">
                <strong>{spot.label}</strong> · 태블릿 선택 구역
              </p>

              <div className="monitor-controls-body">
                <fieldset className="monitor-controls-field">
                  <legend className="monitor-controls-label">조명 구역</legend>
                  <div className="monitor-controls-zone-row">
                    <button
                      type="button"
                      className={`monitor-controls-zone ${targetZone === "zoneA" ? "is-active" : ""}`}
                      disabled={busy}
                      onClick={() => setTargetZone("zoneA")}
                    >
                      A구역
                    </button>
                    <button
                      type="button"
                      className={`monitor-controls-zone ${targetZone === "zoneB" ? "is-active" : ""}`}
                      disabled={busy}
                      onClick={() => setTargetZone("zoneB")}
                    >
                      B구역
                    </button>
                  </div>
                </fieldset>

                <label className="monitor-controls-field">
                  <span className="monitor-controls-label">씬 프리셋</span>
                  <select
                    className="monitor-controls-select"
                    value={sceneId}
                    disabled={busy}
                    onChange={(e) => setSceneId(e.target.value)}
                  >
                    {FLOOR_PIN_SCENE_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="monitor-controls-field">
                  <span className="monitor-controls-label">
                    유지 시간 <span className="monitor-controls-value">{holdSec}s</span>
                  </span>
                  <input
                    type="range"
                    className="monitor-controls-range"
                    min={15}
                    max={300}
                    step={15}
                    value={holdSec}
                    disabled={busy}
                    onChange={(e) => setHoldSec(Number(e.target.value))}
                  />
                </label>

                {inManual ? (
                  <p className="monitor-controls-hint" aria-live="polite">
                    수동 연출 · 자동 복귀까지 {Math.ceil(manualRemainingSec ?? 0)}s
                  </p>
                ) : null}
              </div>

              <div className="monitor-controls-actions">
                <button
                  type="button"
                  className="monitor-controls-apply"
                  disabled={busy}
                  onClick={() => void publishScene()}
                >
                  {busy ? "전송 중…" : "연출 적용"}
                </button>
                <button
                  type="button"
                  className="monitor-controls-secondary"
                  disabled={busy}
                  onClick={() => void resumeLive()}
                >
                  전시장 연동 복귀
                </button>
              </div>
            </>
          )}

          {msg ? <p className="monitor-controls-msg">{msg}</p> : null}

          <footer className="monitor-tuning-dialog-foot">
            <button type="button" className="monitor-controls-secondary" onClick={closeDialog}>
              닫기
            </button>
          </footer>
        </form>
      </dialog>
    </>
  );
}
