import { EXHIBIT_HOST_AUDIO_DEVICE_ID, EXHIBIT_HOST_VIDEO_DEVICE_ID } from "@/lib/exhibitCaptureConfig";

/** Windows·Phone Link 등 가상 카메라 — 기본값으로 잡히면 USB 웹캠을 가림 */
const VIRTUAL_CAM_LABEL =
  /virtual|가상\s*카메라|obs|manycam|snap\s*camera|droidcam|ivcam|ndi|xsplit|camo|epoccam|tab\s*s/i;

function hostAudioConstraint(): boolean | MediaTrackConstraints {
  if (EXHIBIT_HOST_AUDIO_DEVICE_ID) {
    return { deviceId: { exact: EXHIBIT_HOST_AUDIO_DEVICE_ID } };
  }
  return true;
}

function hostVideoConstraint(deviceId: string): MediaTrackConstraints {
  return {
    deviceId: { exact: deviceId },
    width: { ideal: 1280 },
    height: { ideal: 720 },
  };
}

function rankVideoInputs(devices: MediaDeviceInfo[]): MediaDeviceInfo[] {
  const videos = devices.filter((d) => d.kind === "videoinput" && d.deviceId);
  const physical = videos.filter((d) => !VIRTUAL_CAM_LABEL.test(d.label));
  const virtual = videos.filter((d) => VIRTUAL_CAM_LABEL.test(d.label));
  const webcamNamed = physical.filter((d) => /webcam|usb|logitech|hd pro|c920|brio/i.test(d.label));
  const rest = physical.filter((d) => !webcamNamed.includes(d));
  return [...webcamNamed, ...rest, ...virtual];
}

function stopStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((t) => t.stop());
}

async function tryGetUserMedia(
  audio: boolean | MediaTrackConstraints,
  video: boolean | MediaTrackConstraints,
): Promise<MediaStream | null> {
  try {
    return await navigator.mediaDevices.getUserMedia({ audio, video });
  } catch {
    return null;
  }
}

/** host `/monitor` — USB 웹캠 우선, 가상 카메라·NotFound 시 후보 순회 */
export async function openHostMediaStream(wantVideo: boolean): Promise<MediaStream> {
  const audio = hostAudioConstraint();

  if (!wantVideo) {
    return navigator.mediaDevices.getUserMedia({ audio, video: false });
  }

  if (EXHIBIT_HOST_VIDEO_DEVICE_ID) {
    return navigator.mediaDevices.getUserMedia({
      audio,
      video: hostVideoConstraint(EXHIBIT_HOST_VIDEO_DEVICE_ID),
    });
  }

  const probe = await tryGetUserMedia(audio, { width: { ideal: 1280 }, height: { ideal: 720 } });
  const probeLabel = probe?.getVideoTracks()[0]?.label ?? "";

  if (probe && !VIRTUAL_CAM_LABEL.test(probeLabel)) {
    return probe;
  }

  stopStream(probe);

  const devices = await navigator.mediaDevices.enumerateDevices();
  for (const device of rankVideoInputs(devices)) {
    const stream = await tryGetUserMedia(audio, hostVideoConstraint(device.deviceId));
    if (stream) return stream;
  }

  try {
    return await navigator.mediaDevices.getUserMedia({
      audio,
      video: { width: { ideal: 1280 }, height: { ideal: 720 } },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/not found|NotFound/i.test(msg)) {
      throw new Error(
        "웹캠을 찾지 못했습니다. USB 연결·Windows 카메라 권한을 확인하거나, Tab Link 등 가상 카메라를 끄고 새로고침하세요.",
      );
    }
    throw e instanceof Error ? e : new Error(msg);
  }
}
