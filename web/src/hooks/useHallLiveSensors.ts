"use client";

import { captureVisionFrameBlob, parseVisionApiErrorBody } from "@/lib/captureVisionFrame";
import { EXHIBIT_HOST_AUDIO_DEVICE_ID, EXHIBIT_HOST_VIDEO_DEVICE_ID } from "@/lib/exhibitCaptureConfig";
import { EXHIBIT_POLL_INTERVAL_MS } from "@/lib/exhibitEventBusConstants";
import { isVideoFeedLive } from "@/lib/exhibitCameraLive";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

export type ExhibitSensorPublishMeta = { captureLive?: boolean };

export type HallEmotion = "calm" | "neutral" | "active" | "stressed";

const ENABLE_VISION_RUNTIME = process.env.NEXT_PUBLIC_ENABLE_VISION_RUNTIME === "true";
const VISION_API_URL = process.env.NEXT_PUBLIC_VISION_API_URL ?? "/api/exhibit/analyze";

export function classifyHallEmotion(inputPeople: number, inputDecibel: number): HallEmotion {
  const crowding = Math.min(inputPeople / 6, 1);
  const noiseScore = inputDecibel >= 75 ? 1 : inputDecibel >= 62 ? 0.8 : inputDecibel >= 48 ? 0.5 : 0.25;
  if (inputPeople === 0) return "calm";
  if (noiseScore >= 0.8) return "stressed";
  if (crowding < 0.35 && noiseScore <= 0.4) return "active";
  return "neutral";
}

export type HallCaptureProfile = "tablet" | "host";

export type MonitorFaceBox = {
  x: number;
  y: number;
  w: number;
  h: number;
};

function normalizeVisionFaces(
  faces: Array<{ box: [number, number, number, number] | number[] }> | undefined,
  width: number,
  height: number,
): MonitorFaceBox[] {
  if (!faces?.length || width <= 0 || height <= 0) return [];
  return faces
    .map((f) => {
      const box = f.box;
      if (!box || box.length < 4) return null;
      const [x1, y1, x2, y2] = box;
      const w = (x2 - x1) / width;
      const h = (y2 - y1) / height;
      if (w <= 0 || h <= 0) return null;
      return {
        x: x1 / width,
        y: y1 / height,
        w,
        h,
      };
    })
    .filter((b): b is MonitorFaceBox => b !== null);
}

export function useHallLiveSensors(options: {
  enabled: boolean;
  busPeopleFallback: number;
  publishSensor: (
    people: number,
    decibel: number,
    emotion?: HallEmotion,
    meta?: ExhibitSensorPublishMeta,
  ) => Promise<void>;
  videoRef: RefObject<HTMLVideoElement | null>;
  /** 태블릿 전면카메라 vs 노트북 USB 웹캠 */
  captureProfile: HallCaptureProfile;
  /** 미설정: host=true(모니터 Live view), tablet=Vision 켤 때만 */
  wantVideo?: boolean;
  /** Explore 등으로 `<video>` 가 잠깐 DOM 에 없을 때 — captureLive 끊지 않음 */
  pauseVideoHealthCheck?: boolean;
  /** Live 패널 표시 여부 — remount 시 스트림 재연결 */
  livePanelVisible?: boolean;
  /** Explore 등 — sensor.state·Vision 호출 중단 */
  pauseSensorPublish?: boolean;
}) {
  const { enabled, busPeopleFallback, publishSensor, videoRef, captureProfile } = options;
  const wantVideo = options.wantVideo ?? (captureProfile === "host" ? true : ENABLE_VISION_RUNTIME);
  const pauseVideoHealthCheck = options.pauseVideoHealthCheck ?? false;
  const livePanelVisible = options.livePanelVisible ?? true;
  const pauseSensorPublish = options.pauseSensorPublish ?? false;

  const [avgDecibel, setAvgDecibel] = useState(40);
  const [micLevel, setMicLevel] = useState(0);
  const [lineHint, setLineHint] = useState("전시장 소리·영상을 읽는 중…");
  const [videoLive, setVideoLive] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [faceBoxes, setFaceBoxes] = useState<MonitorFaceBox[]>([]);
  const [localPeopleCount, setLocalPeopleCount] = useState(0);
  const [visionBackendOff, setVisionBackendOff] = useState(false);
  const [visionAnalyzeError, setVisionAnalyzeError] = useState<string | null>(null);

  const avgRef = useRef(40);
  const busPeopleRef = useRef(busPeopleFallback);
  const visionBusyRef = useRef(false);
  const cameraLiveRef = useRef(true);
  const offlineStreakRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);

  const streamVideoLive = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return false;
    const tracks = stream.getVideoTracks();
    if (tracks.length === 0) return false;
    const track = tracks[0];
    return track.enabled && track.readyState === "live";
  }, []);

  const publishCaptureIdle = useCallback(
    async (decibel: number) => {
      cameraLiveRef.current = false;
      await publishSensor(0, decibel, "calm", { captureLive: false });
    },
    [publishSensor],
  );

  useEffect(() => {
    avgRef.current = avgDecibel;
  }, [avgDecibel]);

  useEffect(() => {
    busPeopleRef.current = busPeopleFallback;
  }, [busPeopleFallback]);

  const analyzeWithVisionApi = useCallback(async (noise01: number) => {
    if (!videoRef.current || visionBusyRef.current) return null;
    visionBusyRef.current = true;
    try {
      const blob = await captureVisionFrameBlob(videoRef.current);
      if (!blob) return null;

      const formData = new FormData();
      formData.append("frame", blob, "frame.jpg");
      formData.append("noise_level", String(Math.max(0, Math.min(1, noise01))));

      const res = await fetch(VISION_API_URL, { method: "POST", body: formData });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(parseVisionApiErrorBody(text) || `Vision API ${res.status}`);
      }
      setVisionAnalyzeError(null);
      return (await res.json()) as {
        ok?: boolean;
        vision_enabled?: boolean;
        people_count?: number;
        emotion_state?: HallEmotion;
        faces?: Array<{ box: [number, number, number, number] }>;
      };
    } finally {
      visionBusyRef.current = false;
    }
  }, [videoRef]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    let cancelled = false;
    let raf = 0;
    let ac: AudioContext | null = null;

    const stop = () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      setVideoLive(false);
    };

    const run = async () => {
      try {
        setCaptureError(null);
        const audioConstraint: boolean | MediaTrackConstraints =
          captureProfile === "host" && EXHIBIT_HOST_AUDIO_DEVICE_ID
            ? { deviceId: { exact: EXHIBIT_HOST_AUDIO_DEVICE_ID } }
            : true;

        const videoConstraint: boolean | MediaTrackConstraints = !wantVideo
          ? false
          : captureProfile === "tablet"
            ? { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }
            : EXHIBIT_HOST_VIDEO_DEVICE_ID
              ? {
                  deviceId: { exact: EXHIBIT_HOST_VIDEO_DEVICE_ID },
                  width: { ideal: 1280 },
                  height: { ideal: 720 },
                }
              : { width: { ideal: 1280 }, height: { ideal: 720 } };

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraint,
          video: videoConstraint,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;

        if (wantVideo && videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => {});
          const onVideoLost = () => {
            if (cancelled) return;
            offlineStreakRef.current = 99;
            cameraLiveRef.current = false;
            setVideoLive(false);
            setLineHint("카메라 입력 없음 — 공간이 대기 상태로 돌아갑니다.");
            void publishCaptureIdle(Number(avgRef.current.toFixed(1)));
          };
          for (const track of stream.getVideoTracks()) {
            track.addEventListener("ended", onVideoLost);
            track.addEventListener("mute", onVideoLost);
          }
          cameraLiveRef.current = isVideoFeedLive(videoRef.current);
          setVideoLive(cameraLiveRef.current);
        }

        ac = new AudioContext();
        if (ac.state === "suspended") {
          await ac.resume();
        }
        if (cancelled) {
          stop();
          return;
        }
        const src = ac.createMediaStreamSource(stream);
        const an = ac.createAnalyser();
        an.fftSize = 2048;
        src.connect(an);
        const buf = new Float32Array(an.fftSize);
        const loop = () => {
          if (cancelled) return;
          an.getFloatTimeDomainData(buf);
          let s = 0;
          for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
          const rms = Math.sqrt(s / buf.length);
          setMicLevel(rms);
          const db = 20 + Math.min(75, Math.max(0, rms * 130));
          setAvgDecibel(db);
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
        if (!cancelled) {
          setLineHint(
            !wantVideo
              ? "마이크로 전시장 소음을 읽는 중입니다."
              : captureProfile === "host"
                ? ENABLE_VISION_RUNTIME
                  ? "웹캠·마이크 → FastAPI 비전 분석·공간 연동 중입니다."
                  : "웹캠·마이크로 현장 소음·연동 중입니다."
                : "태블릿 마이크·카메라로 전시장을 읽는 중입니다.",
          );
        }
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : String(e);
          setCaptureError(msg);
          setLineHint("마이크(·카메라) 권한이 없습니다. 브라우저 설정을 확인해 주세요.");
          if (wantVideo) {
            void publishCaptureIdle(Number(avgRef.current.toFixed(1)));
          }
        }
        stop();
      }
    };

    void run();
    return () => {
      if (wantVideo) {
        void publishCaptureIdle(Number(avgRef.current.toFixed(1)));
      }
      stop();
    };
  }, [enabled, videoRef, captureProfile, wantVideo, publishCaptureIdle]);

  useLayoutEffect(() => {
    if (!enabled || !wantVideo) return;
    const el = videoRef.current;
    const stream = streamRef.current;
    if (!el || !stream) return;
    if (el.srcObject !== stream) {
      el.srcObject = stream;
      void el.play().catch(() => {});
    }
    const live = isVideoFeedLive(el) || streamVideoLive();
    cameraLiveRef.current = live;
    setVideoLive(live);
  }, [enabled, wantVideo, videoRef, livePanelVisible, streamVideoLive]);

  useEffect(() => {
    if (!enabled) return;
    let dead = false;
    const id = window.setInterval(() => {
      const db = Number(avgRef.current.toFixed(1));
      const noise01 = Math.max(0, Math.min(1, (db - 20) / 75));
      void (async () => {
        try {
          if (pauseSensorPublish) return;

          const needsVideo = wantVideo;
          const live = pauseVideoHealthCheck
            ? streamVideoLive()
            : !needsVideo || isVideoFeedLive(videoRef.current);
          if (!live) {
            if (pauseVideoHealthCheck) return;
            offlineStreakRef.current += 1;
            if (offlineStreakRef.current >= 4) {
              cameraLiveRef.current = false;
              setVideoLive(false);
              await publishCaptureIdle(db);
            }
            return;
          }
          offlineStreakRef.current = 0;
          cameraLiveRef.current = true;
          if (needsVideo) setVideoLive(true);

          let people = ENABLE_VISION_RUNTIME ? 0 : busPeopleRef.current;
          let emotion: HallEmotion | undefined;
          if (ENABLE_VISION_RUNTIME && wantVideo) {
            try {
              const analyzed = await analyzeWithVisionApi(noise01);
              if (dead) return;
              const backendVisionOff = analyzed?.vision_enabled === false;
              setVisionBackendOff(backendVisionOff);
              if (backendVisionOff) {
                people = busPeopleRef.current;
                setFaceBoxes([]);
              } else if (analyzed) {
                if (typeof analyzed.people_count === "number") people = analyzed.people_count;
                emotion = analyzed.emotion_state;
                if (videoRef.current) {
                  setFaceBoxes(
                    normalizeVisionFaces(
                      analyzed.faces,
                      videoRef.current.videoWidth,
                      videoRef.current.videoHeight,
                    ),
                  );
                }
              }
            } catch (e) {
              setVisionBackendOff(false);
              people = busPeopleRef.current;
              const msg = e instanceof Error ? e.message : String(e);
              setVisionAnalyzeError(msg);
            }
          }
          if (dead) return;
          setLocalPeopleCount(people);
          const derived = classifyHallEmotion(people, db);
          await publishSensor(people, db, emotion ?? derived, { captureLive: true });
        } catch {
          /* 네트워크 등 */
        }
      })();
    }, EXHIBIT_POLL_INTERVAL_MS);
    return () => {
      dead = true;
      window.clearInterval(id);
    };
  }, [
    enabled,
    wantVideo,
    pauseSensorPublish,
    publishSensor,
    publishCaptureIdle,
    analyzeWithVisionApi,
    videoRef,
    pauseVideoHealthCheck,
    streamVideoLive,
  ]);

  const visionRuntimeEnabled = ENABLE_VISION_RUNTIME;

  return {
    avgDecibel,
    micLevel,
    lineHint,
    videoLive,
    captureError,
    faceBoxes,
    localPeopleCount,
    visionRuntimeEnabled,
    visionBackendOff,
    visionAnalyzeError,
  };
}
