"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** host 캡처·비전은 `/monitor` 로 통합 — 이 경로는 리다이렉트만 */
export default function HostExhibitCaptureClient() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/monitor");
  }, [router]);

  return (
    <div className="host-cap-page">
      <p className="host-cap-hint">
        웹캠·비전·센서는 <Link href="/monitor">/monitor</Link> 로 통합되었습니다. 잠시 후 이동합니다…
      </p>
    </div>
  );
}
