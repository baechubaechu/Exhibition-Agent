@echo off

setlocal

chcp 65001 >nul

cd /d "%~dp0"

echo.
echo [데모] 태블릿 웹캠 ^→^ /monitor 연동 ^(조명 없음^)
echo.
echo   노트북 모니터 대용: https://127.0.0.1:3001/monitor
echo   태블릿 도면:       https://^(노트북 핫스팟 IPv4^):3001/
echo.
echo   태블릿에서 카메라 쓰려면 HTTPS 필수 — 인증서 경고 한 번 허용.
echo   조명 URL 미설정 = NeoPixel 호출 없음 ^(연동 확인만^).
echo.

echo [1/2] web — tablet capture (local face, no Google Vision) …

start "exhibition-web-demo" cmd /k pushd "%~dp0web" ^&^& set NEXT_PUBLIC_EXHIBIT_CAPTURE_SOURCE=tablet ^&^& set NEXT_PUBLIC_ENABLE_VISION_RUNTIME=false ^&^& npm run dev:lan:https

echo 잠시 대기 ^(Next TLS^)…

timeout /t 5 /nobreak >nul

echo.
echo [2/2] FastAPI ^(0.0.0.0:8000^) — Explore·핫스pot 상태용 …

start "exhibition-api-demo" cmd /k pushd "%~dp0" ^&^& set EVENT_BRIDGE_BASE_URL=https://127.0.0.1:3001 ^&^& set EVENT_BRIDGE_SSL_VERIFY=false ^&^& python -m uvicorn app.main:app --host 0.0.0.0 --port 8000

echo.
echo ipconfig 로 핫스팟 IPv4 확인 후 태블릿에 https://IP:3001/ 입력.
echo.

endlocal

exit /b 0
