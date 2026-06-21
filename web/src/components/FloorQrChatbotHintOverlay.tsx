"use client";

type Props = {
  open: boolean;
  onDismiss: () => void;
};

/** Explore 후 초기화 버튼 — QR 챗봇 안내 (1회) */
export function FloorQrChatbotHintOverlay({ open, onDismiss }: Props) {
  if (!open) return null;

  return (
    <button
      type="button"
      className="xfloor-monitor-handoff xfloor-qr-hint"
      aria-label="QR 챗봇 안내 닫기"
      onClick={onDismiss}
    >
      <div className="xfloor-monitor-handoff-card">
        <p className="xfloor-monitor-handoff-kicker">More info</p>
        <p className="xfloor-monitor-handoff-title">QR 속 챗봇에서 더 자세한 정보를 얻을 수 있습니다!</p>
        <p className="xfloor-monitor-handoff-en">Scan the QR code to chat for more details.</p>
        <p className="xfloor-monitor-handoff-dismiss">탭하여 닫기</p>
      </div>
    </button>
  );
}
