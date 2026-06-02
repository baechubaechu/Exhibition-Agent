# 노트북 시연 가이드 — 처음부터 끝까지

마감·시연용 **노트북 웹캠(host) + 모니터 `/monitor`** 기준입니다.  
(태블릿 웹캠 모드는 맨 아래 **부록** 참고.)

---

## 0. 화면 역할 정리

| URL | 누가 | 하는 일 |
|-----|------|---------|
| `https://127.0.0.1:3001/host-exhibit-capture` | **노트북** (백그라운드 탭) | USB 웹캠·마이크 → Vision·프리뷰·sensor 발행 |
| `https://127.0.0.1:3001/monitor` | **노트북** (외부 모니터 또는 전체화면) | Live view, Current mode, **Space response** |
| `https://127.0.0.1:3001/` | **태블릿** (선택) | 도면·핀 터치 → Explore 연동 |
| FastAPI `http://127.0.0.1:8000` | 노트북 프로세스 | 씬·presence·Vision API |

**Space response UI** — 라벨·힌트 문구는 그대로, 아래 **슬라이더 + 구간 이름 + “현재 ○○”** 로 현재 연출 위치를 표시합니다 (`MonitorOutputBoard.tsx`).

---

## 1. 최초 1회 설치

### 1-1. 프로그램

| 프로그램 | 용도 |
|----------|------|
| Git | 레포 clone |
| Node.js LTS | Next.js (web/) |
| Python 3.10+ | FastAPI — 설치 시 **Add to PATH** 체크 |

PowerShell에서 확인:

```powershell
git --version
node -v
npm -v
python --version
```

### 1-2. 레포 받기

```powershell
cd $env:USERPROFILE\Documents
git clone https://github.com/baechubaechu/Exhibition-Agent.git exhibition-agent
cd exhibition-agent
git pull
```

### 1-3. 의존성

```powershell
# 레포 루트
python -m pip install -r requirements.txt

cd web
npm install
cd ..
```

---

## 2. 환경 변수 (로컬, Git에 없음)

### 2-1. `web/.env.local` (시연 — 노트북 웹캠)

```env
NEXT_PUBLIC_EXHIBIT_CAPTURE_SOURCE=host
NEXT_PUBLIC_ENABLE_EXHIBIT_CAMERA_PREVIEW=true
NEXT_PUBLIC_ENABLE_VISION_RUNTIME=true
NEXT_PUBLIC_VISION_API_URL=/api/exhibit/analyze
NEXT_PUBLIC_EXHIBIT_PREVIEW_MODE=stream
NEXT_PUBLIC_EXHIBIT_PREVIEW_INTERVAL_MS=33
```

- `host` = 태블릿 카메라 **안 씀**. `/host-exhibit-capture` 에서만 캡처.
- Vision 끄려면 `NEXT_PUBLIC_ENABLE_VISION_RUNTIME=false` (Crowd는 마이크·기본값만).

### 2-2. 레포 루트 `.env` (FastAPI + Vision)

```env
EVENT_BRIDGE_BASE_URL=https://127.0.0.1:3001
EVENT_BRIDGE_SSL_VERIFY=false

USE_VISION_API=true
GOOGLE_APPLICATION_CREDENTIALS=C:\경로\vision-service-account.json
```

- JSON 키 파일은 **절대 Git에 올리지 않음**.
- 조명 ESP 없으면 `EXHIBITION_LIGHT_HTTP_URL` **비워 둠** (스텁, 시연에 영향 없음).

---

## 3. 서버 기동

### 방법 A — bat 한 번 (권장)

레포 루트에서 **`start-dev.bat`** 더블클릭.

- CMD 창 **2개**가 뜸: Next(3001 HTTPS) + FastAPI(8000).
- `web/.env.local` 이 위 설정이면 host 웹캠 모드.

mkcert 인증서(`certs/`)가 있으면 **`start-dev-trusted.bat`** (태블릿 HTTPS 경고 줄이기).

### 방법 B — 수동 (문제 있을 때)

**터미널 1 — Next**

```powershell
cd web
npm run dev:lan:https
# 또는 trusted: npm run dev:lan:https:trusted
```

**터미널 2 — FastAPI**

```powershell
cd 레포루트
$env:EVENT_BRIDGE_BASE_URL="https://127.0.0.1:3001"
$env:EVENT_BRIDGE_SSL_VERIFY="false"
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Ready 확인:

- 브라우저 `https://127.0.0.1:3001/` — 인증서 경고 **한 번 허용** (로컬 자체 서명).
- `http://127.0.0.1:8000/health` → `{"status":"ok"}`.

---

## 4. 브라우저 탭 열기 (시연 순서)

### 4-1. 캡처 탭 (필수)

1. **`https://127.0.0.1:3001/host-exhibit-capture`**
2. **카메라·마이크 허용**
3. 화면에 웹캠 미리보기 + “호스트 웹캠·마이크로…” 문구
4. **시연 내내 이 탭을 닫지 않음** (닫으면 ~2.5초 내 모니터가 **대기**로 복귀)

> OS 설정에서 **기본 입력 마이크 = 웹캠 내장 마이크** 권장.

### 4-2. 모니터 탭 (필수)

1. **`https://127.0.0.1:3001/monitor`**
2. 외부 디스플레이에 끌어다 놓거나 F11 전체화면
3. 확인 항목:
   - **Live view** — 웹캠 영상 + 얼굴 테두리
   - **Current mode** — Solo / 대기 등
   - **Space response** — 슬라이더가 **현재 ○○** 위치에 맞는지

### 4-3. 태블릿 (Explore 시연할 때만)

1. 노트북 **모바일 핫스pot** ON → 태블릿 Wi‑Fi 연결
2. `ipconfig` → 핫스pot IPv4 (예: `192.168.137.1`)
3. 태블릿: **`https://192.168.137.1:3001/`** (host 모드면 태블릿 **카메라는 안 켜짐** — 도면만)
4. 핀 터치 → `/monitor` 가 **Explore** + 구역 영상/캡션

---

## 5. 시연 흐름 (노트북 웹캠)

1. **대기** — 캡처 탭만 켜 두고 모니터 `/monitor` → Current mode **대기**, Crowd **Empty**, Space response 슬라이더 **calm** 쪽.
2. **웹캠 앞에 서기** — Vision 인원 감지 (~1초) → Solo/Incoming, Live view 얼굴 박스, Space response 슬라이더 이동.
3. **말하기·움직임** — Noise / Mood 칩 변화.
4. **태블릿 핀** (선택) — Explore 모드, Monitor 출력 슬라이더·Walkthrough.
5. **캠 가리거나 캡처 탭 닫기** — 즉시 **대기**·프리뷰 “현장 영상 대기 중”.

---

## 6. 종료

1. Next·FastAPI CMD 창에서 `Ctrl+C` 또는 창 닫기.
2. 포트 정리 (필요 시):

```powershell
Get-NetTCPConnection -LocalPort 3001,8000 -State Listen -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique |
  ForEach-Object { Stop-Process -Id $_ -Force }
```

---

## 7. 자주 막히는 것

| 증상 | 확인 |
|------|------|
| `/monitor` 영상 없음 | `/host-exhibit-capture` 열렸는지, 카메라 허용했는지 |
| Crowd / Space response 안 바뀜 | FastAPI(8000) 실행 중인지, `.env` `EVENT_BRIDGE_*` |
| Vision 안 됨 | 루트 `.env` `USE_VISION_API` + JSON 경로, FastAPI 로그 |
| `ERR_EMPTY_RESPONSE` on monitor | **`http://` 아님** — 반드시 **`https://127.0.0.1:3001/monitor`** |
| Space response 슬라이더 안 보임 | 최신 `git pull` 후 Next 재시작 |

---

## 부록 — 태블릿 웹캠 모드

태블릿 카메라로 Live view를 올릴 때:

```env
NEXT_PUBLIC_EXHIBIT_CAPTURE_SOURCE=tablet
NEXT_PUBLIC_ENABLE_EXHIBIT_CAMERA_PREVIEW=true
```

루트 **`start-demo-tablet.bat`** 실행 → 태블릿 `https://노트북IP:3001/`, 모니터 `/monitor`.

HTTPS 필수 — 태블릿에서 인증서 경고 허용.

---

## 배포(Vercel 등) 참고

- **Git push만**으로 `/`, `/monitor` **페이지는** 올라감.
- **FastAPI(8000)** 는 별도 서버 필요 — 없으면 agent-status·Vision·씬 연동 불가.
- `.env` / `.env.local` 은 배포 환경에 **수동 설정**.
