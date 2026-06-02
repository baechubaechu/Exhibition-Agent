/** 웹캠·태블릿 영상 트랙이 실제로 프레임을 내는지 */
export function isVideoFeedLive(video: HTMLVideoElement | null): boolean {
  if (!video) return false;
  const stream = video.srcObject;
  if (!(stream instanceof MediaStream)) return false;
  const tracks = stream.getVideoTracks();
  if (tracks.length === 0) return false;
  const track = tracks[0];
  if (!track.enabled || track.readyState === "ended") return false;
  if (video.videoWidth <= 0 || video.videoHeight <= 0) return false;
  return true;
}
