"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useExhibitSignageFeed } from "@/hooks/useExhibitSignageFeed";
import { describeReason } from "@/lib/signageCopy";

/** host 모드는 `/monitor` 로 통합 — tablet·레거시만 이 페이지 사용 */
export default function SignageClient() {
  const router = useRouter();
  const { captureFromHost, agent, agentErr, sensor, decision, sceneId, detail, emotionKo, modeLine, reasonText } =
    useExhibitSignageFeed();

  useEffect(() => {
    if (captureFromHost) router.replace("/monitor");
  }, [captureFromHost, router]);

  if (captureFromHost) {
    return (
      <div className="signage-root">
        <p className="signage-muted">/monitor 로 이동 중…</p>
      </div>
    );
  }

  return (
    <div className="signage-root">
      <header className="signage-top">
        <div>
          <p className="signage-kicker">Spatial Environment · 전시 모니터</p>
          <h1 className="signage-title">환경 연동 상태</h1>
        </div>
        <div className="signage-badge">{agent?.visitor_manual_lock ? "수동 / 존 선택" : "자동 연동"}</div>
      </header>

      <div className="signage-grid">
        <section className="signage-visual" aria-label="현장 영상">
          <div className="signage-visual-inner">
            <div className="signage-cam-placeholder">
              <p>Live view는 host 모드 /monitor 에서 표시</p>
              <p className="signage-muted">태블릿 모드에서는 도면 페이지에서 센서·비전이 동작합니다.</p>
            </div>
          </div>
        </section>

        <section className="signage-panel" aria-label="상황 설명">
          <div className="signage-panel-box">
            <h2 className="signage-h2">지금 모드</h2>
            <p className="signage-lead">{modeLine}</p>

            <h2 className="signage-h2">입력으로 파악한 전시장 상태</h2>
            <ul className="signage-metrics">
              <li>
                <span className="signage-metric-label">관람 인원(비전 추정)</span>
                <span className="signage-metric-val">{sensor?.people_count ?? "—"}</span>
              </li>
              <li>
                <span className="signage-metric-label">현장 소음(추정 dB)</span>
                <span className="signage-metric-val">
                  {sensor?.decibel !== undefined ? `${Number(sensor.decibel).toFixed(1)} dB` : "—"}
                </span>
              </li>
              <li>
                <span className="signage-metric-label">정서 신호</span>
                <span className="signage-metric-val">{emotionKo}</span>
              </li>
            </ul>

            <h2 className="signage-h2">적용 중인 씬</h2>
            <p className="signage-scene-title">{detail.title}</p>
            <p className="signage-scene-id">
              <code>{sceneId}</code>
              {decision?.target_zone ? (
                <>
                  {" "}
                  · 존 <code>{decision.target_zone}</code>
                </>
              ) : null}
            </p>

            <h3 className="signage-h3">왜 이런 씬인가요?</h3>
            <p className="signage-body">{reasonText ? describeReason(reasonText) : "아직 적용 이력이 없거나 에이전트와 통신 중입니다."}</p>

            <h3 className="signage-h3">조명 · 오디오 연출</h3>
            <p className="signage-body">
              <strong>조명:</strong> {detail.light}
              <br />
              <strong>사운드:</strong> {detail.sound}
              <br />
              <strong>무드:</strong> {detail.mood}
            </p>

            {agent?.last_updated ? (
              <p className="signage-footer-meta">에이전트 마지막 갱신 · {agent.last_updated}</p>
            ) : null}
            {agentErr ? <p className="signage-error">에이전트 연결: {agentErr}</p> : null}
          </div>
        </section>
      </div>
    </div>
  );
}
