type ExhibitEmotion = "calm" | "neutral" | "active" | "stressed";

/** sensor.state — 이벤트 버스로 발행 */
export async function publishExhibitSensor(
  source: string,
  people: number,
  decibel: number,
  emotion: ExhibitEmotion,
  options?: { captureLive?: boolean; faceAreaRatio?: number },
): Promise<void> {
  const captureLive = options?.captureLive !== false;
  const faceAreaRatio =
    typeof options?.faceAreaRatio === "number"
      ? Math.max(0, Math.min(1, options.faceAreaRatio))
      : undefined;
  const res = await fetch("/api/events/publish", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      topic: "sensor.state",
      source,
      payload: {
        peopleCount: Math.min(300, Math.max(0, Math.round(people))),
        decibel: Math.min(160, Math.max(0, decibel)),
        emotionState: emotion,
        occupancyZone: "all",
        captureLive,
        ...(faceAreaRatio !== undefined ? { faceAreaRatio } : {}),
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text);
  }
}
