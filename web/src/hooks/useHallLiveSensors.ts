"use client";

import { captureVisionFrameBlob, getVisionFrameSize, parseVisionApiErrorBody } from "@/lib/captureVisionFrame";
import { EXHIBIT_HOST_AUDIO_DEVICE_ID } from "@/lib/exhibitCaptureConfig";
import { openHostMediaStream } from "@/lib/resolveHostMediaStream";
import { faceBoxesNearlyEqual, lerpFaceBoxes } from "@/lib/faceBoxSmoothing";
import { mapSourceFaceBoxesToCoverDisplay, mapVisionFacesToCoverDisplay } from "@/lib/faceBoxMapping";
import { isVideoFeedLive } from "@/lib/exhibitCameraLive";
import { initLocalFaceGate, localFaceGateMode, scanLocalFaces, scanLocalFacesAsync, type LocalFaceHit } from "@/lib/localFaceGate";
import { isBrowserOffline, isLikelyNetworkError } from "@/lib/networkStatus";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

export type ExhibitSensorPublishMeta = { captureLive?: boolean; faceAreaRatio?: number };

export type HallEmotion = "calm" | "neutral" | "active" | "stressed";

const ENABLE_VISION_RUNTIME = process.env.NEXT_PUBLIC_ENABLE_VISION_RUNTIME === "true";
const VISION_API_URL = process.env.NEXT_PUBLIC_VISION_API_URL ?? "/api/exhibit/analyze";
/** 표시용 박스 보간 강도 (높을수록 빠르게 따라감) */
const FACE_BOX_LERP_ALPHA = 0.55;
/** Vision 한 프레임 미검출 시 박스 유지(ms) */
const FACE_BOX_STALE_MS = 420;
/** 로컬 얼굴 게이트 스캔 주기(ms) — 박스 실시간 추적 */
const LOCAL_GATE_SCAN_MS = 60;
/** 무인·로컬 미검출 시 Vision heartbeat */
const VISION_HEARTBEAT_MS = 10_000;
/** Vision 1회 확인 후 유지 호출(ms) */
const VISION_HYSTERESIS_MS = 7_000;
/** 얼굴/히스테리시스 구간 Vision 최소 간격(ms) */
const VISION_ACTIVE_MIN_GAP_MS = 450;

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

function maxFaceAreaRatio(boxes: MonitorFaceBox[]): number | undefined {
  if (!boxes.length) return undefined;
  let maxArea = 0;
  for (const b of boxes) {
    const area = b.w * b.h;
    if (area > maxArea) maxArea = area;
  }
  return Math.max(0, Math.min(1, maxArea));
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
  const [networkOffline, setNetworkOffline] = useState(false);
  const [localGateReady, setLocalGateReady] = useState(false);
  const networkOfflineRef = useRef(false);

  const avgRef = useRef(40);
  const busPeopleRef = useRef(busPeopleFallback);
  const visionBusyRef = useRef(false);
  const cameraLiveRef = useRef(true);
  const offlineStreakRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const faceTargetRef = useRef<MonitorFaceBox[]>([]);
  const lastFaceAtRef = useRef(0);
  const localFacePresentRef = useRef(false);
  const localFaceCountRef = useRef(0);
  const localMaxAreaRef = useRef(0);
  const lastVisionAtRef = useRef(0);
  const visionActiveUntilRef = useRef(0);
  const lastVisionPeopleRef = useRef(0);
  const lastVisionEmotionRef = useRef<HallEmotion | undefined>(undefined);
  const lastVisionFaceAreaRef = useRef<number | undefined>(undefined);
  const lastVisionFaceAtRef = useRef(0);
  const gateScanBusyRef = useRef(false);

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

  useEffect(() => {
    networkOfflineRef.current = networkOffline;
  }, [networkOffline]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // navigator.onLine 은 와이파이 로밍·DHCP 갱신 등으로 순간적으로 false 가 됐다가
    // 바로 복구되는 경우가 많다. 그 깜빡임마다 "비전 사용 불가" 경고가 뜨는 것을 막기 위해
    // 일정 시간(OFFLINE_CONFIRM_MS) 이상 끊겨 있을 때만 오프라인으로 확정한다. 복구는 즉시 반영.
    const OFFLINE_CONFIRM_MS = 4000;
    let confirmTimer: number | undefined;

    const clearConfirm = () => {
      if (confirmTimer !== undefined) {
        window.clearTimeout(confirmTimer);
        confirmTimer = undefined;
      }
    };

    const goOnline = () => {
      clearConfirm();
      setNetworkOffline(false);
    };

    const maybeGoOffline = () => {
      clearConfirm();
      confirmTimer = window.setTimeout(() => {
        confirmTimer = undefined;
        // 확정 시점에도 여전히 끊겨 있을 때만 경고
        if (isBrowserOffline()) setNetworkOffline(true);
      }, OFFLINE_CONFIRM_MS);
    };

    if (isBrowserOffline()) maybeGoOffline();
    else setNetworkOffline(false);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", maybeGoOffline);
    return () => {
      clearConfirm();
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", maybeGoOffline);
    };
  }, []);

  useEffect(() => {
    if (!enabled || !wantVideo || !ENABLE_VISION_RUNTIME) return;
    let cancelled = false;
    void initLocalFaceGate().then((mode) => {
      if (!cancelled) setLocalGateReady(mode !== "none");
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, wantVideo]);

  /** 로컬 얼굴 게이트 — Vision 호출 여부만 판단 (브라우저 CPU) */
  useEffect(() => {
    if (!enabled || !wantVideo || !ENABLE_VISION_RUNTIME || pauseSensorPublish) return;
    let dead = false;

    // 로컬 온디바이스 검출이 박스를 실시간으로 그림(Vision 왕복 지연 회피)
    const pushLocalFaceOverlay = (video: HTMLVideoElement, hits: LocalFaceHit[]) => {
      const rw = video.clientWidth;
      const rh = video.clientHeight;
      if (rw <= 0 || rh <= 0 || hits.length === 0) return;
      const boxes = mapSourceFaceBoxesToCoverDisplay(
        hits.map((h) => h.boxPx),
        video.videoWidth,
        video.videoHeight,
        rw,
        rh,
      );
      if (boxes.length > 0) {
        faceTargetRef.current = boxes;
        lastFaceAtRef.current = Date.now();
      }
    };

    const applyLocalGateResult = (video: HTMLVideoElement, r: { faces: LocalFaceHit[]; maxAreaRatio: number }) => {
      localFacePresentRef.current = r.faces.length > 0;
      localFaceCountRef.current = r.faces.length;
      localMaxAreaRef.current = r.maxAreaRatio;
      pushLocalFaceOverlay(video, r.faces);
    };

    const scan = () => {
      if (dead || gateScanBusyRef.current) return;
      const video = videoRef.current;
      if (!video || !isVideoFeedLive(video)) {
        localFacePresentRef.current = false;
        localFaceCountRef.current = 0;
        localMaxAreaRef.current = 0;
        return;
      }

      const mode = localFaceGateMode();
      if (mode === "chrome") {
        gateScanBusyRef.current = true;
        void scanLocalFacesAsync(video)
          .then((r) => {
            applyLocalGateResult(video, r);
          })
          .finally(() => {
            gateScanBusyRef.current = false;
          });
        return;
      }

      const r = scanLocalFaces(video, performance.now());
      applyLocalGateResult(video, r);
    };

    scan();
    const id = window.setInterval(scan, LOCAL_GATE_SCAN_MS);
    return () => {
      dead = true;
      window.clearInterval(id);
    };
  }, [enabled, wantVideo, pauseSensorPublish, videoRef]);

  const shouldCallVisionApi = useCallback((now: number): boolean => {
    const localFace = localFacePresentRef.current;
    const hysteresis = now < visionActiveUntilRef.current;
    const sinceLast = now - lastVisionAtRef.current;
    if (localFace || hysteresis) return sinceLast >= VISION_ACTIVE_MIN_GAP_MS;
    return sinceLast >= VISION_HEARTBEAT_MS;
  }, []);

  const nextVisionTickDelayMs = useCallback((now: number, calledVision: boolean): number => {
    if (networkOfflineRef.current) return 3_000;
    if (calledVision) return VISION_ACTIVE_MIN_GAP_MS;
    const localFace = localFacePresentRef.current;
    const hysteresis = now < visionActiveUntilRef.current;
    if (localFace || hysteresis) {
      const untilActive = lastVisionAtRef.current + VISION_ACTIVE_MIN_GAP_MS - now;
      return Math.max(200, Math.min(600, untilActive));
    }
    const untilHeartbeat = lastVisionAtRef.current + VISION_HEARTBEAT_MS - now;
    return Math.max(400, untilHeartbeat);
  }, []);

  const analyzeWithVisionApi = useCallback(async (noise01: number) => {
    if (!videoRef.current || visionBusyRef.current) return null;
    visionBusyRef.current = true;
    try {
      const maxEdge = captureProfile === "host" ? 960 : 1280;
      const frameSize = getVisionFrameSize(videoRef.current, maxEdge);
      const blob = await captureVisionFrameBlob(videoRef.current, maxEdge, 0.78);
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
      setNetworkOffline(false);
      const body = (await res.json()) as {
        ok?: boolean;
        vision_enabled?: boolean;
        people_count?: number;
        emotion_state?: HallEmotion;
        faces?: Array<{ box: [number, number, number, number] }>;
        _frame_width?: number;
        _frame_height?: number;
      };
      if (frameSize) {
        body._frame_width = frameSize.width;
        body._frame_height = frameSize.height;
      }
      return body;
    } finally {
      visionBusyRef.current = false;
    }
  }, [videoRef, captureProfile]);

  /** Vision 결과는 target 에만 반영 — 화면은 rAF 로 보간 */
  useEffect(() => {
    if (!enabled || !wantVideo || !ENABLE_VISION_RUNTIME) return;
    let raf = 0;
    const step = () => {
      const now = Date.now();
      const target = faceTargetRef.current;
      if (target.length === 0) {
        if (now - lastFaceAtRef.current > FACE_BOX_STALE_MS) {
          setFaceBoxes((prev) => (prev.length === 0 ? prev : []));
        }
      } else {
        setFaceBoxes((prev) => {
          const next = lerpFaceBoxes(prev, target, FACE_BOX_LERP_ALPHA);
          return faceBoxesNearlyEqual(prev, next) ? prev : next;
        });
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [enabled, wantVideo]);

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

        const stream =
          captureProfile === "host"
            ? await openHostMediaStream(wantVideo)
            : await navigator.mediaDevices.getUserMedia({
                audio: audioConstraint,
                video: !wantVideo
                  ? false
                  : { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
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
    let timer: number | null = null;

    const tick = async () => {
      if (dead) return;
      let calledVision = false;
      const db = Number(avgRef.current.toFixed(1));
      const noise01 = Math.max(0, Math.min(1, (db - 20) / 75));
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
        let faceAreaRatio: number | undefined;
        let emotion: HallEmotion | undefined;
        const now = Date.now();

        if (ENABLE_VISION_RUNTIME && wantVideo) {
          const runVision = shouldCallVisionApi(now);
          if (runVision) {
            if (isBrowserOffline()) {
              setNetworkOffline(true);
            } else {
              calledVision = true;
              lastVisionAtRef.current = now;
              try {
                const analyzed = await analyzeWithVisionApi(noise01);
                if (dead) return;
                const backendVisionOff = analyzed?.vision_enabled === false;
                setVisionBackendOff(backendVisionOff);
                if (backendVisionOff) {
                  people = busPeopleRef.current;
                  faceTargetRef.current = [];
                  lastFaceAtRef.current = 0;
                  lastVisionPeopleRef.current = people;
                } else if (analyzed) {
                  if (typeof analyzed.people_count === "number") people = analyzed.people_count;
                  emotion = analyzed.emotion_state;
                  lastVisionPeopleRef.current = people;
                  lastVisionEmotionRef.current = emotion;
                  if (people > 0 || (analyzed.faces?.length ?? 0) > 0) {
                    visionActiveUntilRef.current = now + VISION_HYSTERESIS_MS;
                  }
                  if (videoRef.current) {
                    const boxes = mapVisionFacesToCoverDisplay(
                      analyzed.faces,
                      analyzed._frame_width ?? videoRef.current.videoWidth,
                      analyzed._frame_height ?? videoRef.current.videoHeight,
                      videoRef.current.clientWidth,
                      videoRef.current.clientHeight,
                    );
                    // 로컬 검출기가 있으면 박스는 로컬이 실시간으로 담당 — Vision 은 인원/감정만
                    const localActive = localFaceGateMode() !== "none";
                    if (!localActive) {
                      if (boxes.length > 0) {
                        faceTargetRef.current = boxes;
                        lastFaceAtRef.current = Date.now();
                      } else if (people === 0) {
                        faceTargetRef.current = [];
                        lastFaceAtRef.current = 0;
                      }
                    }
                    if (boxes.length > 0) lastVisionFaceAtRef.current = Date.now();
                    faceAreaRatio = maxFaceAreaRatio(boxes.length > 0 ? boxes : faceTargetRef.current);
                    lastVisionFaceAreaRef.current = faceAreaRatio;
                  }
                }
              } catch (e) {
                setVisionBackendOff(false);
                if (isLikelyNetworkError(e)) {
                  setNetworkOffline(true);
                  setVisionAnalyzeError(null);
                } else {
                  setNetworkOffline(false);
                  const msg = e instanceof Error ? e.message : String(e);
                  setVisionAnalyzeError(msg);
                }
                people = now < visionActiveUntilRef.current ? lastVisionPeopleRef.current : busPeopleRef.current;
                emotion = lastVisionEmotionRef.current;
                faceAreaRatio = lastVisionFaceAreaRef.current;
              }
            }
          } else if (now < visionActiveUntilRef.current) {
            people = lastVisionPeopleRef.current;
            emotion = lastVisionEmotionRef.current;
            faceAreaRatio = lastVisionFaceAreaRef.current;
          } else if (localFacePresentRef.current) {
            people = Math.min(8, Math.max(1, localFaceCountRef.current));
            faceAreaRatio = localMaxAreaRef.current;
          } else if (lastVisionPeopleRef.current > 0 && now - lastVisionAtRef.current < VISION_HEARTBEAT_MS) {
            people = lastVisionPeopleRef.current;
            emotion = lastVisionEmotionRef.current;
            faceAreaRatio = lastVisionFaceAreaRef.current;
          } else {
            people = 0;
            faceTargetRef.current = [];
            lastFaceAtRef.current = 0;
          }
        }
        if (ENABLE_VISION_RUNTIME && wantVideo && localFacePresentRef.current) {
          people = Math.max(people, Math.min(8, localFaceCountRef.current));
        }
        if (dead) return;
        setLocalPeopleCount(people);
        const derived = classifyHallEmotion(people, db);
        void publishSensor(people, db, emotion ?? derived, { captureLive: true, faceAreaRatio });
      } catch {
        /* 네트워크 등 */
      } finally {
        if (!dead) {
          const delay = nextVisionTickDelayMs(Date.now(), calledVision);
          timer = window.setTimeout(() => void tick(), delay);
        }
      }
    };

    void tick();
    return () => {
      dead = true;
      if (timer !== null) window.clearTimeout(timer);
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
    shouldCallVisionApi,
    nextVisionTickDelayMs,
  ]);

  useEffect(() => {
    if (!pauseSensorPublish) return;
    faceTargetRef.current = [];
    lastFaceAtRef.current = 0;
    setFaceBoxes([]);
  }, [pauseSensorPublish]);

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
    networkOffline,
    localGateReady,
  };
}
