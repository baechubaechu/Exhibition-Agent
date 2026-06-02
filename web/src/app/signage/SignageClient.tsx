"use client";

import { useExhibitSignageFeed } from "@/hooks/useExhibitSignageFeed";
import { describeReason } from "@/lib/signageCopy";

export default function SignageClient() {
  const {
    previewUrl,
    previewVisible,
    previewFromHost,
    previewPollMs,
    agent,
    agentErr,
    sensor,
    decision,
    sceneId,
    detail,
    emotionKo,
    modeLine,
    reasonText,
  } = useExhibitSignageFeed();

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
        <section className="signage-visual" aria-label={previewFromHost ? "호스트 웹캠 프리뷰" : "태블릿 카메라 프리뷰"}>
          <div className="signage-visual-inner">
            {previewVisible && previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="" className="signage-cam" />
            ) : (
              <div className="signage-cam-placeholder">
                <p>카메라 프리뷰 없음</p>
                <p className="signage-muted">
                  {previewFromHost ? (
                    <>
                      노트북에서 <code className="signage-scene-id">/host-exhibit-capture</code> 가 열려 웹캠 프리뷰가 올라오면, 약{" "}
                      {previewPollMs}ms 간격으로 여기에 표시됩니다.
                    </>
                  ) : (
                    <>
                      태블릿에서 전시장 도면이 열려 카메라 프리뷰가 올라오면, 약 {previewPollMs}ms 간격으로 여기에 표시됩니다.
                    </>
                  )}
                </p>
              </div>
            )}
          </div>
          <p className="signage-caption">
            {previewFromHost
              ? "좌측: 노트북 웹캠에서 올리는 현장 프리뷰 · 호스트 부하에 따라 갱신 간격이 달라질 수 있습니다."
              : "좌측: 태블릿이 보내는 현장 카메라 프리뷰 · Wi-Fi 상황에 따라 갱신 간격이 달라질 수 있습니다."}
          </p>
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
