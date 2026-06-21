import MonitorClient from "./MonitorClient";
import { PeriodicRemount } from "../../components/PeriodicRemount";

/** 전시장 모니터·TV 전용 라우트 (태블릿 도면 `/` 와 분리) */
export default function MonitorPage() {
  return (
    <PeriodicRemount>
      <MonitorClient />
    </PeriodicRemount>
  );
}
