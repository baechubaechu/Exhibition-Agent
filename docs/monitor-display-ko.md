# 전시 모니터 vs 태블릿 화면

| 화면 | URL (dev) | 코드 |
|------|-----------|------|
| **태블릿** — 도면·존 핀·환경 연동 | `https://노트북IP:3001/` | `web/src/app/ExhibitFloorClient.tsx` |
| **모니터 / TV** — 관람객용 상태판 | `https://노트북IP:3001/monitor` | `web/src/app/monitor/MonitorClient.tsx` |
| (구 URL, monitor 와 동일) | `/signage` | `web/src/app/signage/SignageClient.tsx` |

## 개발

- Next dev 가 **3001** 에 떠 있으면 브라우저만 새로고침.
- 모니터 UI만 바꿀 때: **`monitor/MonitorClient.tsx`** 및 `.monitor-*` 스타일(도면과 동일 톤은 `xfloor-*`·`:root` 토큰).
- 태블릿 도면·LOD: **`FloorPlanSvgViewer`**, `public/drawings/plan.svg`.

## 전시 당일

- 태블릿: `https://노트북IP:3001/`
- 모니터 브라우저: `https://노트북IP:3001/monitor` (전체 화면 F11)
- FastAPI(8000) + 이벤트 브리지가 떠 있어야 「환경 연동」·에이전트 상태가 갱신됨.
