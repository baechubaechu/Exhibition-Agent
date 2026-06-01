# 마감 시연 — 태블릿 웹캠 + 노트북 `/monitor`

조명(ESP) 없이 **태블릿 도면 ↔ 노트북 모니터 화면** 연동만 확인할 때.

## 노트북 처음 세팅 (Git clone 포함)

아무것도 없는 PC 기준 **한 번만** 하면 됩니다.

### 1. 설치

| 프로그램 | 받는 곳 |
|----------|---------|
| **Git** | https://git-scm.com/download/win |
| **Node.js LTS** | https://nodejs.org |
| **Python 3.10+** | https://www.python.org/downloads/ — **Add python.exe to PATH** 체크 |

새 PowerShell에서 확인:

```powershell
git --version
node -v
npm -v
python --version
```

### 2. 레포 clone

```powershell
cd $env:USERPROFILE\Documents
git clone https://github.com/baechubaechu/Spatial-Environment-Agent.git exhibition-agent
cd exhibition-agent
```

(다른 폴더명·경로도 됩니다.)

### 3. 의존성 설치

```powershell
python -m pip install -r requirements.txt

cd web
npm install
cd ..
```

`python`이 안 되면 `py -m pip install -r requirements.txt` 사용.

`.env` / `.env.local` **없어도** 데모 bat이 설정합니다.

---

## 한 번에 기동

루트에서 **`start-demo-tablet.bat`** 실행 → CMD 두 개(웹 / FastAPI).

| 화면 | 주소 |
|------|------|
| **태블릿** (도면·핀·웹캠) | `https://노트북핫스팟IP:3001/` |
| **모니터 대용** (노트북 브라우저) | `https://127.0.0.1:3001/monitor` |

## 노트북 준비

1. Windows **모바일 핫스팟** 켜기.
2. 태블릿을 핫스팟 Wi‑Fi에 연결.
3. `ipconfig` → 핫스팟 어댑터 **IPv4** (예: `192.168.137.1`) 확인.
4. 노트북 브라우저: `/monitor` 탭 열어 두기.
5. 태블릿 Safari/Chrome: `https://IPv4:3001/` → **인증서 경고 허용** → **카메라·마이크 허용**.

## 시연 흐름

1. **Live view** — 태블릿 전면 카메라 영상이 `/monitor` 왼쪽에 뜨는지 확인.
2. 도면 **핀** 터치 → 태블릿에 「큰 화면을 바라봐 주세요」 오버레이.
3. `/monitor`가 **Explore**로 바뀌며 해당 장소 **제목·설명** 표시 (동영상 파일 없으면 캡션만).
4. 우측 **Scene tuning**은 운영용 — 시연에서 생략 가능.

## 환경 변수 (`start-demo-tablet.bat`가 자동 설정)

```env
NEXT_PUBLIC_EXHIBIT_CAPTURE_SOURCE=tablet
NEXT_PUBLIC_ENABLE_EXHIBIT_CAMERA_PREVIEW=true
NEXT_PUBLIC_ENABLE_VISION_RUNTIME=false
```

`web/.env.local`에 위를 넣고 평소 `start-dev.bat`만 써도 동일.

## 조명

`.env`에 `EXHIBITION_LIGHT_HTTP_URL` **없으면** 조명 API는 스텁 — 시연에 영향 없음.

## 자주 막히는 것

| 증상 | 확인 |
|------|------|
| 태블릿 카메라 안 됨 | `https://` 로 접속했는지, 권한 허용했는지 |
| `/monitor` 영상 없음 | 태블릿 `/` 도면 페이지가 **켜져 있는지** (프레임 업로드) |
| Explore 안 바뀜 | FastAPI(8000) 창이 떠 있는지 |
| 핫스pot 후 영상 끊김 | 최신 코드 — 태블릿 캡처는 수동(핀) 중에도 유지 |
