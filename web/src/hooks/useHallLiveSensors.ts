"use client";

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
}) {
  const { enabled, busPeopleFallback, publishSensor, videoRef, captureProfile } = options;
  const wantVideo = options.wantVideo ?? (captureProfile === "host" ? true : ENABLE_VISION_RUNTIME);

  const [avgDecibel, setAvgDecibel] = useState(40);
  const [micLevel, setMicLevel] = useState(0);
  const [lineHint, setLineHint] = useState("전시장 소리·영상을 읽는 중…");
  const [videoLive, setVideoLive] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);

  const avgRef = useRef(40);
  const busPeopleRef = useRef(busPeopleFallback);
  const visionBusyRef = useRef(false);
  const cameraLiveRef = useRef(true);
  const offlineStreakRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);

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
      const video = videoRef.current;
      if (video.videoWidth <= 0 || video.videoHeight <= 0) return null;

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.8);
      });
      if (!blob) return null;

      const formData = new FormData();
      formData.append("frame", blob, "frame.jpg");
      formData.append("noise_level", String(Math.max(0, Math.min(1, noise01))));

      const res = await fetch(VISION_API_URL, { method: "POST", body: formData });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Vision API ${res.status}`);
      }
      return (await res.json()) as {
        people_count?: number;
        emotion_state?: HallEmotion;
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
    const live = isVideoFeedLive(el);
    cameraLiveRef.current = live;
    setVideoLive(live);
  }, [enabled, wantVideo, videoRef]);

  useEffect(() => {
    if (!enabled) return;
    let dead = false;
    const id = window.setInterval(() => {
      const db = Number(avgRef.current.toFixed(1));
      const noise01 = Math.max(0, Math.min(1, (db - 20) / 75));
      void (async () => {
        try {
          const needsVideo = wantVideo;
          const live = !needsVideo || isVideoFeedLive(videoRef.current);
          if (!live) {
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
              if (typeof analyzed?.people_count === "number") people = analyzed.people_count;
              emotion = analyzed?.emotion_state;
            } catch {
              /* 비전 실패 시 마이크·버스 폴백 */
            }
          }
          if (dead) return;
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
  }, [enabled, wantVideo, publishSensor, publishCaptureIdle, analyzeWithVisionApi, videoRef]);

  return { avgDecibel, micLevel, lineHint, videoLive, captureError };
}
