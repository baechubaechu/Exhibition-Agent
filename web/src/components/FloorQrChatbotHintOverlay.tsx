"use client";

type Props = {
  open: boolean;
  onDismiss: () => void;
};

/** Explore 씬 — QR 챗봇 안내 (탭 또는 자동 닫힘) */
export function FloorQrChatbotHintOverlay({ open, onDismiss }: Props) {
  if (!open) return null;

  return (
    <button
      type="button"
      className="xfloor-monitor-handoff xfloor-qr-hint"
      aria-label="QR 챗봇 안내 닫기"
      onPointerDown={(e) => {
        e.stopPropagation();
        onDismiss();
      }}
    >
      <div className="xfloor-monitor-handoff-card xfloor-qr-hint-card">
        <p className="xfloor-monitor-handoff-kicker">More info</p>
        <p className="xfloor-monitor-handoff-title">QR 챗봇에서 더 많은 정보를 확인할 수 있습니다</p>
        <p className="xfloor-monitor-handoff-en">Scan the QR code to chat for more details.</p>
        <p className="xfloor-monitor-handoff-dismiss">탭하여 닫기</p>
      </div>
    </button>
  );
}
