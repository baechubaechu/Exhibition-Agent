/**
 * 전시 핫스팟(오프라인) — MediaPipe WASM·얼굴 모델을 public/ 으로 복사.
 * npm install 시 postinstall 로 1회 실행.
 */
import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkgWasm = join(root, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const publicWasm = join(root, "public", "mediapipe", "wasm");
const publicModel = join(root, "public", "mediapipe", "models", "blaze_face_short_range.tflite");
const modelUrl =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";

function copyWasm() {
  if (!existsSync(pkgWasm)) {
    console.warn("[copy-mediapipe] @mediapipe/tasks-vision wasm 없음 — npm install 후 다시 실행");
    return;
  }
  mkdirSync(publicWasm, { recursive: true });
  cpSync(pkgWasm, publicWasm, { recursive: true, force: true });
  console.log("[copy-mediapipe] wasm → public/mediapipe/wasm");
}

async function copyModel() {
  if (existsSync(publicModel) && existsSync(publicModel.replace(".tflite", ".tflite.ok"))) {
    return;
  }
  mkdirSync(dirname(publicModel), { recursive: true });
  try {
    const res = await fetch(modelUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(publicModel, buf);
    writeFileSync(`${publicModel}.ok`, "");
    console.log("[copy-mediapipe] model → public/mediapipe/models/");
  } catch (e) {
    console.warn(
      "[copy-mediapipe] 모델 다운로드 실패(오프라인?) — 인터넷 연결 후 npm run copy:mediapipe 실행:",
      e instanceof Error ? e.message : e,
    );
  }
}

copyWasm();
await copyModel();
