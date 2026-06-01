# 에이전트 대화 정리 (세션 아카이브)

Cursor 에이전트와 나눈 내용 중, **레포 운영·배포·하드웨어 연동**에 쓰이는 결론만 모았습니다.  
세부 코드는 각 `README.md`, `docs/*.txt`, 소스 주석을 따르세요.

---

## 1. 레포·워크스페이스

| 항목 | 내용 |
|------|------|
| **Git 원격** | `main` 브랜치 — GitHub 안내 URL은 `Exhibition-Agent` 쪽으로 통일 권장. 로컬: `git remote set-url origin https://github.com/baechubaechu/Exhibition-Agent.git` |
| **로컬 루트** | **`exhibition-suite/exhibition-agent` 이중 구조 폐지** → 한 레포 루트가 **`exhibition-agent` 폴더 자체** (`app/`, `web/`, `start-dev.bat` 동일 디렉터리). |
| **Cursor** | 워크스페이스는 **`C:\Users\user\exhibition-agent`** (또는 클론 경로)를 **폴더 열기**로 연 상태가 기준. 예전 `exhibition-suite`만 열려 있으면 경로가 어긋남. |
| **챗봇** | RAG 챗봇은 **별도 레포** (`exhibition-chatbot` 등). 이 레포와 **코드·env 공유 없음**. |

---

## 2. 배포: VPS만 vs 노트북(현장)

| 방식 | 조건 |
|------|------|
| **노트북 + 같은 Wi‑Fi** | 기본 **`push`**: FastAPI가 **`EXHIBITION_LIGHT_HTTP_URL`(ESP 사설 IP)** 로 `POST /light/scene`. PC가 ESP와 **같은 LAN**이어야 함. |
| **VPS만 (미니 PC 없음)** | **`EXHIBITION_LIGHT_MODE=pull`** + **`EXHIBITION_DEVICE_TOKEN`** + ESP 스케치 **`esp32_https_light_pull*.ino`** — ESP가 **`GET /device/light/next`** 를 HTTPS로 폴링. |
| **HTTPS 호스트명** | 태블릿·ESP에 **도메인 또는 Cloudflare Tunnel 등 발급 호스트** 권장. IP만 + 자체 서명은 브라우저·운영에 불리. |

전시장 노트북 없이 가려면 **pull** 쪽 설계가 맞고, 예전 **`esp32_http_light.ino`(ESP가 HTTP 서버로 POST 수신)** 만으로는 VPS가 사설 ESP에 직접 닿지 못함.

---

## 3. 실행 스크립트·환경

- **`start-dev.bat`** (레포 루트): `web` → `npm run dev:lan:https`, 루트에서 uvicorn 8000, `EVENT_BRIDGE_SSL_VERIFY=false` 등.
- **`start-dev-trusted.bat`**: mkcert 인증서 — `docs/tablet-trusted-https-ko.txt`, `certs/` 참고.
- **`.env` / `web/.env.local`**: FastAPI는 `app/env_load.py`로 **레포 루트 + `web/`** 의 `.env` / `.env.local` 로드. 복붙 템플릿: **`ENV-VPS-PASTE.txt`**.
- **상세 절차**: `docs/exhibition-notebook-setup-ko.txt`, `docs/exhibition-run-checklist-ko.txt`.

---

## 4. 웹·도면·HTTPS

- **기본 도면 UI**: `web/public/drawings/plan.svg` — LOD `lod-0`~`lod-3`, `FloorPlanSvgViewer` (pinch/휠 줌). 실행 로드맵: **`docs/roadmap-ko.md`** §P2.
- **실 도면 작업**: CAD → Illustrator(레이어 id `lod-0`…`lod-3`) → SVG export → `plan.svg` 교체.
- **레거시 PDF**: `web/public/floor-plan.pdf` — 사인지·백업용. 메인 `/` 화면은 SVG.
- **`pdf.worker`**: PDF.js 쓰는 화면용 — `web/package.json` **`postinstall`** (`web/scripts/sync-pdf-worker.js`).

---

## 5. FastAPI·이벤트 버스

- **`GET /device/light/next`**: FastAPI가 `dict | Response` 반환 시 OpenAPI 오류 → **`response_model=None`** 적용됨.
- **이벤트 버퍼 최대 500**: 가득 차면 **오래된 이벤트부터 잘림**(순환). `pull` 시 TTL(기본 60초)도 적용. 토픽별 최신은 `latestByTopic`에 유지.

---

## 6. 조명이 안 바뀔 때

1. **PC와 ESP가 같은 Wi‑Fi인지** (다른 망이면 ESP IP로 POST 불가).
2. **`EXHIBITION_LIGHT_HTTP_URL`** 이 시리얼에 찍힌 IP와 일치하는지.
3. PC에서 `curl` 등으로 **`http://ESP_IP/light/scene`** 직접 POST 테스트 → 여기서 되면 앱/env 문제, 안 되면 전원·핀·펌웨어.

---

## 7. 태블릿·카메라

- **태블릿 카메라 상시 ON**은 배터리·발열 부담 — 상시 충전, 필요 시만 ON, 또는 **호스트 웹캠+미니 PC** 분리 검토.
- **Vision URL**: 태블릿에서는 `localhost` 금지 — **노트북 LAN IP 기준 공개 URL** (`docs` 참고).

---

## 8. 사용자 홈 디렉터리 점 파일

- **`.bash_profile`, `.gitconfig`** 와 **나란히** `.cursor`, `.ssh`, `.conda` 등이 있음 — 전부 삭제 비추.
- 에이전트 터미널의 **`/home/...` 표기**는 샌드박스/도구 환경 때문일 수 있어, **로컬 `C:\Users\...` 와 항상 같지 않음**.

---

## 9. 이후 작업

전체 순서·상태표: **`docs/roadmap-ko.md`**

- [ ] P0: **`.env`**, `start-dev.bat`, `/` 도면·LOD 확인
- [ ] P1: ESP + **`EXHIBITION_LIGHT_HTTP_URL`**, 태블릿 HTTPS
- [ ] P2: **CAD → Illustrator → `plan.svg`**, `floorPlanHotspots.ts` 핀
- [ ] P3: **`assets/audio/`**, `SpeakerDriver` 재생
- [ ] (선택) `git remote` → **`Exhibition-Agent`**

---

*이 문서는 대화 기반 정리본이며, 최종 동작은 코드와 공식 README를 우선합니다.*
