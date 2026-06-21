"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * 장시간 무인 운영 중 누적되는 자원(오디오/비전/인터벌 등)을 주기적으로 리셋한다.
 *
 * 전체 새로고침(`location.reload`)은 태블릿 자가서명 HTTPS에서 "안전하지 않은 연결"
 * 경고를 다시 띄울 수 있으므로, **페이지 이동 없이 React 트리만 재마운트**한다.
 * key 가 바뀌면 하위 트리가 언마운트→재마운트되어 모든 훅의 cleanup/초기화가 다시 돈다.
 *
 * - `NEXT_PUBLIC_AUTO_REMOUNT_MIN` 분 간격 (기본 60, 0 이하면 비활성).
 * - 관람객이 보고 있을 때 끊기지 않도록 idle presence(quiet_waiting/cooldown/leaving)
 *   일 때만 리셋한다. presence 정보가 없는 화면(태블릿)은 간격이 되면 즉시 리셋.
 */
const DEFAULT_MIN = 60;
const IDLE_MODES = new Set(["quiet_waiting", "cooldown", "leaving"]);
const IDLE_POLL_MS = 30_000;

export function PeriodicRemount({ children }: { children: ReactNode }) {
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    const raw = process.env.NEXT_PUBLIC_AUTO_REMOUNT_MIN;
    const min = raw == null || raw === "" ? DEFAULT_MIN : Number(raw);
    if (!Number.isFinite(min) || min <= 0) return;
    const periodMs = min * 60_000;

    let due = false;
    let dueTimer = window.setTimeout(() => {
      due = true;
    }, periodMs);

    const isIdle = () => {
      const el = document.querySelector("[data-presence-mode]");
      const mode = el?.getAttribute("data-presence-mode");
      return !mode || IDLE_MODES.has(mode);
    };

    const poll = window.setInterval(() => {
      if (!due || !isIdle()) return;
      due = false;
      dueTimer = window.setTimeout(() => {
        due = true;
      }, periodMs);
      setResetKey((k) => k + 1);
    }, IDLE_POLL_MS);

    return () => {
      window.clearTimeout(dueTimer);
      window.clearInterval(poll);
    };
  }, []);

  return (
    <div key={resetKey} style={{ display: "contents" }}>
      {children}
    </div>
  );
}
