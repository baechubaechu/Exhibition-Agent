import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "전시 모니터 (관람객용)",
  description: "전시장 대형 디스플레이 — 환경 연동·씬 상태",
};

export default function MonitorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
