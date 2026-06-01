# Exhibition Agent — 실행 로드맵

전시 **A안(노트북 + 같은 Wi‑Fi + push + `esp32_http_light`)** 기준.  
세부 절차: `docs/exhibition-notebook-setup-ko.txt`, `docs/exhibition-run-checklist-ko.txt`.

**상태 범례:** ✅ 완료 · 🔄 진행/부분 · ⬜ 예정

---

## 현재 스냅샷 (코드·문서)

| 항목 | 상태 |
|------|------|
| 워크스페이스 `exhibition-agent` | ✅ |
| 배포 방향 A (push) | ✅ 결정 |
| `.env` / `web/.env.local` | ⬜ 미작성 |
| `start-dev.bat` 로컬 기동 | ⬜ |
| ESP + NeoPixel 60 | ⬜ 하드웨어·납땜 |
| 도면 UI (SVG LOD + pinch/휠 줌) | ✅ `FloorPlanSvgViewer` |
| `web/public/drawings/plan.svg` | 🔄 플레이스홀더 → **실 도면 교체 예정** |
| `SpeakerDriver` 실제 재생 | ⬜ 스텁 |
| `assets/audio/` 트랙 | ⬜ |
| git remote `Exhibition-Agent` | ⬜ (현재 `Spatial-Environment-Agent` 가능) |

---

## P0 — 환경·스택 (오늘)

| # | 할 일 | 상태 |
|---|--------|------|
| 0.1 | 루트 `.env`: `EVENT_BRIDGE_BASE_URL`, (ESP 후) `EXHIBITION_LIGHT_HTTP_URL` | ⬜ |
| 0.2 | HTTPS dev 시 `EVENT_BRIDGE_SSL_VERIFY=false` (`start-dev.bat`와 맞춤) | ⬜ |
| 0.3 | `start-dev.bat` → PC `https://127.0.0.1:3001`, FastAPI 8000 | ⬜ |
| 0.4 | `/` 도면: 줌·LOD·핀 UI 동작 확인 | ⬜ |
| 0.5 | (선택) `git remote` → `Exhibition-Agent` URL | ⬜ |

---

## P1 — 하드웨어·현장 리허설 (push)

| # | 할 일 | 상태 |
|---|--------|------|
| 1.1 | 부품: ESP32, WS2812 **60 LED**, 5V **4–5A**, GND 공통, 데이터선 짧게 | ⬜ |
| 1.2 | `arduino-test/esp32_http_light/` 업로드, Wi‑Fi SSID/비번 | ⬜ |
| 1.3 | 노트북·태블릿·ESP **같은 SSID** | ⬜ |
| 1.4 | `.env` ESP IP → **uvicorn 재시작** | ⬜ |
| 1.5 | `http://ESP_IP/health` → ok | ⬜ |
| 1.6 | 제어 UI 씬·도면 핀 → NeoPixel | ⬜ |
| 1.7 | 태블릿 `https://노트북IP:3001` | ⬜ |

조명 트러블: `docs/agent-session-notes-ko.md` §6, `docs/exhibition-run-checklist-ko.txt`.

---

## P2 — 도면 자산 (CAD → Illustrator → `plan.svg`) 🔄

**목표:** 줌에 따라 lod-0~3 선이 점진적으로 보이는 **실제 평면도**를 `web/public/drawings/plan.svg`에 반영.

### 작업 파이프라인

```text
CAD (DWG/DXF)
  → Illustrator (아트보드 1개, 스케일·원점 정렬)
  → 레이어 이름: lod-0, lod-1, lod-2, lod-3 (id 그대로 export)
  → SVG 1회 export
  → web/public/drawings/plan.svg 덮어쓰기
  → 브라우저 / 도면 화면 LOD 확인
  → floorPlanHotspots.ts 핀 위치 조정
```

### LOD 레이어 정의

| id | 내용 |
|----|------|
| **lod-0** | 전체 외곽, 대지 경계, 주요 보이드, 주요 동선 |
| **lod-1** | 벽체, 기둥, 계단, 램프, 프로그램 구획 |
| **lod-2** | 유리선, 멀리언, 하부 프레임, 난간, 문선 |
| **lod-3** | 재료 해치, 치수, 텍스트, 센서/조명/스피커 표시 |

### 줌 ↔ 표시 (앱 구현 완료)

| displayZoom (reset ≈ 1.0×) | 표시 |
|----------------------------|------|
| &lt; 1.5 | lod-0 |
| 1.5 ~ 3 | lod-0, lod-1 |
| 3 ~ 6 | lod-0 ~ lod-2 |
| ≥ 6 | lod-0 ~ lod-3 |

### Illustrator export 체크

- [ ] 레이어 이름 **`lod-0` … `lod-3`** (소문자, 하이픈)
- [ ] SVG 1.1, **Presentation Attributes**, 텍스트 **outline**
- [ ] export SVG에 `<g id="lod-0">` 형태 확인
- [ ] **viewBox** 네 LOD 동일; 바꾸면 핀 재조정
- [ ] `<defs>`(해치)는 필요 시 `<svg>` 직속으로
- [ ] `/drawings/plan.svg` 직접 열기 + `/` 줌·LOD·콘솔 warn 없음

### 코드 참고

- 뷰어: `web/src/components/FloorPlanSvgViewer.tsx`
- LOD: `web/src/lib/floorPlanLod.ts`
- 로드: `web/src/lib/floorPlanSvgLoad.ts`
- 핀: `web/src/lib/floorPlanHotspots.ts`

**2D / 3D:** 당분간 **2D SVG**. 3D는 미결정 — LOD 개념만 재사용 가능.

---

## P3 — 사운드 연출 (마스킹, ANC 아님)

| # | 할 일 | 상태 |
|---|--------|------|
| 3.1 | `assets/audio/` — `ambient_calm`, `crowd_flux`, `focus_pulse`, `low_reflect`, `silence` (루프 mp3) | ⬜ |
| 3.2 | `LICENSES.md` (Freesound 등 출처) | ⬜ |
| 3.3 | `SpeakerDriver` → 노트북 연결 스피커 재생 | ⬜ |
| 3.4 | (선택) 홀 dB 높을 때 calm 씬 + 낮은 볼륨 | ⬜ |

**하지 않음:** 홀 전체 ANC, 지향 스피커 기반 상쇄 — **앰비언트 마스킹 + 씬 반응**만.

---

## P4 — 전시 전 마감

| # | 할 일 | 상태 |
|---|--------|------|
| 4.1 | `docs/exhibition-run-checklist-ko.txt` 통과 | ⬜ |
| 4.2 | 태블릿 HTTPS: `start-dev-trusted.bat` + `certs/` (선택) | ⬜ |
| 4.3 | Vision 쓸 때 `NEXT_PUBLIC_VISION_API_URL` (localhost 금지) | ⬜ |
| 4.4 | 챗봇 연동 필요 시 **별도 레포** (`exhibition-chatbot`) | — |

---

## P5 — 선택 (VPS만, 노트북 없음)

A안과 **동시에 하지 않음**. 필요 시만:

- `EXHIBITION_LIGHT_MODE=pull`, `EXHIBITION_DEVICE_TOKEN`
- `esp32_https_light_pull*.ino`, `ENV-VPS-PASTE.txt`

---

## 우선순위 한 줄

1. **P0** `.env` + dev 기동  
2. **P1** ESP + 조명 리허설  
3. **P2** CAD → Illustrator → **`plan.svg` 실 도면** + 핀 조정  
4. **P3** 앰비언트 mp3 + 스피커 드라이버  
5. **P4** 전시 체크리스트  

---

## 관련 문서

| 문서 | 용도 |
|------|------|
| `docs/monitor-display-ko.md` | 태블릿 `/` vs 모니터 `/monitor` |
| `docs/agent-session-notes-ko.md` | 세션별 결론 아카이브 |
| `docs/exhibition-notebook-setup-ko.txt` | 노트북 초기 설치 |
| `docs/exhibition-run-checklist-ko.txt` | 전시 당일 절차 |
| `docs/event-bus-contract-ko.md` | 이벤트 스키마 |
| `README.md` | 레포 개요 |

---

*코드와 충돌 시 **코드·README**를 우선합니다. 로드맵 갱신 시 위 표의 ✅/🔄/⬜ 도 함께 수정하세요.*
