"use client";

import { captureVisionFrameBlob, captureVisionFrameCoverCropBlob, getVisionFrameSize, mapVisionCropBoxesToFullVideo, parseVisionApiErrorBody, type VisionCropFrame } from "@/lib/captureVisionFrame";
import { EXHIBIT_HOST_AUDIO_DEVICE_ID } from "@/lib/exhibitCaptureConfig";
import {
  FACE_CENTER_FOCUS_HEIGHT,
  FACE_CENTER_FOCUS_WIDTH,
} from "@/lib/exhibitFaceDetectionConfig";
import { openHostMediaStream } from "@/lib/resolveHostMediaStream";
import { faceBoxesNearlyEqual, lerpFaceBoxes } from "@/lib/faceBoxSmoothing";
import {
  clipNormFaceBox,
  filterSourceFaceBoxesForCoverDisplay,
  mapSourceFaceBoxesToCoverDisplay,
} from "@/lib/faceBoxMapping";
import { isVideoFeedLive } from "@/lib/exhibitCameraLive";
import { initLocalFaceGate, localFaceGateMode, scanLocalFaces, scanLocalFacesAsync, type LocalFaceHit } from "@/lib/localFaceGate";
import { isBrowserOffline, isLikelyNetworkError } from "@/lib/networkStatus";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

export type ExhibitSensorPublishMeta = { captureLive?: boolean; faceAreaRatio?: number };

export type HallEmotion = "calm" | "neutral" | "active" | "stressed";

const ENABLE_VISION_RUNTIME = process.env.NEXT_PUBLIC_ENABLE_VISION_RUNTIME === "true";
const VISION_API_URL = process.env.NEXT_PUBLIC_VISION_API_URL ?? "/api/exhibit/analyze";
/** 표시용 박스 보간 강도 (높을수록 빠르게 따라감) */
const FACE_BOX_LERP_ALPHA = 0.8;
/** Vision 한 프레임 미검출 시 박스 유지(ms) */
const FACE_BOX_STALE_MS = 420;
/** 로컬 얼굴 게이트 스캔 주기(ms) — 박스 실시간 추적 */
const LOCAL_GATE_SCAN_MS = 50;
/** 무인·로컬 미검출 시 Vision heartbeat */
const VISION_HEARTBEAT_MS = 10_000;
/** Vision 1회 확인 후 유지 호출(ms) */
const VISION_HYSTERESIS_MS = 7_000;
/** 얼굴/히스테리시스 구간 Vision 최소 간격(ms) — 인원·감정 갱신 반응성 */
const VISION_ACTIVE_MIN_GAP_MS = 350;

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

function videoRenderSize(video: HTMLVideoElement): { width: number; height: number } {
  const rw = video.clientWidth > 0 ? video.clientWidth : video.videoWidth;
  const rh = video.clientHeight > 0 ? video.clientHeight : video.videoHeight;
  return { width: rw, height: rh };
}

function filterHitsForMonitorViewport(
  video: HTMLVideoElement,
  hits: LocalFaceHit[],
  centerFocus: boolean,
): LocalFaceHit[] {
  if (hits.length === 0) return hits;
  const { width: rw, height: rh } = videoRenderSize(video);
  const filtered = filterSourceFaceBoxesForCoverDisplay(
    hits.map((h) => h.boxPx),
    video.videoWidth,
    video.videoHeight,
    rw,
    rh,
    {
      minVisibleOverlap: 0.25,
      centerFocus,
      focusWidth: FACE_CENTER_FOCUS_WIDTH,
      focusHeight: FACE_CENTER_FOCUS_HEIGHT,
    },
  );
  const allowed = new Set(filtered.map((b) => b.join(",")));
  return hits.filter((h) => allowed.has(h.boxPx.join(",")));
}

function mapHitsToDisplayBoxes(video: HTMLVideoElement, hits: LocalFaceHit[]): MonitorFaceBox[] {
  const { width: rw, height: rh } = videoRenderSize(video);
  return mapSourceFaceBoxesToCoverDisplay(
    hits.map((h) => h.boxPx),
    video.videoWidth,
    video.videoHeight,
    rw,
    rh,
  )
    .map((box) => clipNormFaceBox(box))
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
  const [networkOffline, setNetworkOffline] = useState(false);
  const [localGateReady, setLocalGateReady] = useState(false);
  // 카메라 트랙이 절전/잠금 등으로 죽으면 watchdog 이 이 값을 올려 스트림을 재획득한다.
  const [captureEpoch, setCaptureEpoch] = useState(0);
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
      const displayHits = filterHitsForMonitorViewport(video, hits, false);
      if (displayHits.length === 0) return;
      const boxes = mapHitsToDisplayBoxes(video, displayHits);
      if (boxes.length > 0) {
        faceTargetRef.current = boxes;
        lastFaceAtRef.current = Date.now();
      }
    };

    const applyLocalGateResult = (video: HTMLVideoElement, r: { faces: LocalFaceHit[]; maxAreaRatio: number }) => {
      const presenceHits = filterHitsForMonitorViewport(video, r.faces, true);
      localFacePresentRef.current = presenceHits.length > 0;
      localFaceCountRef.current = presenceHits.length;
      localMaxAreaRef.current = presenceHits.reduce((max, f) => Math.max(max, f.areaRatio), 0);
      pushLocalFaceOverlay(video, r.faces);
    };

    let busyStartedAt = 0;
    const scan = () => {
      if (dead) return;
      // async(Chrome) 스캔이 멈춰 gateScanBusyRef 가 영구 잠기는 것 방지 — 1.5s 넘으면 해제
      if (gateScanBusyRef.current) {
        if (busyStartedAt && performance.now() - busyStartedAt > 1500) {
          gateScanBusyRef.current = false;
        } else {
          return;
        }
      }
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
        busyStartedAt = performance.now();
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
  }, [enabled, wantVideo, pauseSensorPublish, videoRef, localGateReady]);

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
    // 사람이 없을 때도 ~0.9s 마다 깨어나 로컬 게이트(50ms)가 잡은 얼굴을 즉시 반영한다.
    // (Vision API 실제 호출은 shouldCallVisionApi 의 10s heartbeat 가 막으므로 부하는 거의 없음)
    // 이 상한이 없으면 직전 heartbeat 직후 tick 이 ~10s 동안 자버려, 다시 들어온 사람을 인식 못 한다.
    return 900;
  }, []);

  const analyzeWithVisionApi = useCallback(async (noise01: number) => {
    if (!videoRef.current || visionBusyRef.current) return null;
    visionBusyRef.current = true;
    // 타임아웃 없는 fetch 가 백엔드 지연 시 ~20s 매달려 루프 전체를 멈추던 문제 방지.
    // 2s 안에 응답 없으면 abort → null 반환하고 다음 틱에서 재시도(로컬 게이트가 박스·인원 담당).
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 2000);
    try {
      const maxEdge = captureProfile === "host" ? 960 : 1280;
      const useCoverCrop = captureProfile === "host";
      let frameSize: { width: number; height: number } | null;
      let visionCrop: VisionCropFrame | null = null;
      let blob: Blob | null;
      if (useCoverCrop) {
        const cropped = await captureVisionFrameCoverCropBlob(videoRef.current, maxEdge, 0.78);
        if (!cropped) return null;
        blob = cropped.blob;
        visionCrop = cropped.frame;
        frameSize = { width: cropped.frame.width, height: cropped.frame.height };
      } else {
        frameSize = getVisionFrameSize(videoRef.current, maxEdge);
        blob = await captureVisionFrameBlob(videoRef.current, maxEdge, 0.78);
      }
      if (!blob) return null;

      const formData = new FormData();
      formData.append("frame", blob, "frame.jpg");
      formData.append("noise_level", String(Math.max(0, Math.min(1, noise01))));

      let res: Response;
      try {
        res = await fetch(VISION_API_URL, { method: "POST", body: formData, signal: controller.signal });
      } catch (err) {
        // 타임아웃(abort)은 조용히 넘어가 다음 틱에서 재시도
        if (err instanceof DOMException && err.name === "AbortError") return null;
        throw err;
      }
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
        _vision_crop?: VisionCropFrame;
      };
      if (frameSize) {
        body._frame_width = frameSize.width;
        body._frame_height = frameSize.height;
      }
      if (visionCrop) {
        body._vision_crop = visionCrop;
      }
      return body;
    } finally {
      window.clearTimeout(timeoutId);
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
    let detachTrackListeners: (() => void) | null = null;

    const stop = () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      detachTrackListeners?.();
      detachTrackListeners = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      // AudioContext 를 닫지 않으면 effect 재실행 시 누적돼 장시간 후 심하게 느려짐
      if (ac) {
        void ac.close().catch(() => {});
        ac = null;
      }
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
          const videoTracks = stream.getVideoTracks();
          for (const track of videoTracks) {
            track.addEventListener("ended", onVideoLost);
            track.addEventListener("mute", onVideoLost);
          }
          detachTrackListeners = () => {
            for (const track of videoTracks) {
              track.removeEventListener("ended", onVideoLost);
              track.removeEventListener("mute", onVideoLost);
            }
          };
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
  }, [enabled, videoRef, captureProfile, wantVideo, publishCaptureIdle, captureEpoch]);

  // 카메라 watchdog — 절전/화면잠금/탭 백그라운드 후 트랙이 죽으면(ended·muted·disabled)
  // 자동으로 스트림을 재획득한다. (이게 없으면 자리 비웠다 오면 박스·인식이 영구 정지)
  useEffect(() => {
    if (!enabled || !wantVideo || typeof window === "undefined") return;
    let notLiveSince = 0;
    let lastRestart = 0;

    // 판정은 video 엘리먼트가 아니라 "트랙" 기준. explore 등으로 <video> 가 잠깐 DOM 에서
    // 빠져도 트랙은 살아있으므로 재시작하지 않는다. (엘리먼트 기준이면 explore 마다 churn)
    const isStreamLive = () => {
      const track = streamRef.current?.getVideoTracks()[0];
      if (!track) return false;
      return track.readyState !== "ended" && track.enabled && !track.muted;
    };

    const restart = () => {
      lastRestart = Date.now();
      notLiveSince = 0;
      setCaptureEpoch((e) => e + 1);
    };

    const check = () => {
      // explore 중(health check pause)에는 스트림이 정상이어도 publish 가 멈추므로 건드리지 않는다.
      if (pauseVideoHealthCheck) {
        notLiveSince = 0;
        return;
      }
      const now = Date.now();
      if (isStreamLive()) {
        notLiveSince = 0;
        return;
      }
      if (notLiveSince === 0) notLiveSince = now;
      // 일시적인 mute 깜빡임은 무시하고, 2.5s 이상 죽어 있을 때만 재획득(쿨다운 5s)
      if (now - notLiveSince > 2500 && now - lastRestart > 5000) restart();
    };

    const onVisible = () => {
      if (
        document.visibilityState === "visible" &&
        !pauseVideoHealthCheck &&
        !isStreamLive() &&
        Date.now() - lastRestart > 5000
      ) {
        restart();
      }
    };

    const id = window.setInterval(check, 1000);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, wantVideo, pauseVideoHealthCheck]);

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
                    const video = videoRef.current;
                    const { width: rw, height: rh } = videoRenderSize(video);
                    const pixelBoxes = analyzed._vision_crop
                      ? mapVisionCropBoxesToFullVideo(analyzed.faces, analyzed._vision_crop)
                      : (analyzed.faces ?? [])
                          .map((f) => f.box)
                          .filter((b): b is [number, number, number, number] => Boolean(b && b.length >= 4))
                          .map((b) => [b[0], b[1], b[2], b[3]] as [number, number, number, number]);
                    const displayBoxes = filterSourceFaceBoxesForCoverDisplay(
                      pixelBoxes,
                      video.videoWidth,
                      video.videoHeight,
                      rw,
                      rh,
                      { minVisibleOverlap: 0.25, centerFocus: false },
                    );
                    const boxes = mapSourceFaceBoxesToCoverDisplay(
                      displayBoxes,
                      video.videoWidth,
                      video.videoHeight,
                      rw,
                      rh,
                    )
                      .map((box) => clipNormFaceBox(box))
                      .filter((b): b is MonitorFaceBox => b !== null);
                    const localActive = localFaceGateMode() !== "none";
                    if (boxes.length > 0) {
                      // 로컬이 켜져 있어도 박스가 비면 Vision 박스로 폴백
                      if (!localActive || faceTargetRef.current.length === 0) {
                        faceTargetRef.current = boxes;
                        lastFaceAtRef.current = Date.now();
                      }
                    } else if (!localActive && people === 0) {
                      faceTargetRef.current = [];
                      lastFaceAtRef.current = 0;
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
