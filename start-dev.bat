@echo off

setlocal

chcp 65001 >nul

cd /d "%~dp0"



echo.

echo [HTTPS] 제어 웹: npm run dev:lan:https ^(0.0.0.0:3001^)
echo       Node RAM 폭주 시: web CMD 창 종료 후 재실행. HTTPS 불필요하면 start-prod.bat ^(빌드+start^).

echo       같은 PC: https://127.0.0.1:3001

echo       태블릿: https://^(이 PC IPv4^):3001

echo       에이전트는 브리지 https://127.0.0.1:3001 ^(자체 서명 무시^).

echo       태블릿 경고 없이: mkcert + docs\tablet-trusted-https-ko.txt ^+ start-dev-trusted.bat

echo.



echo [1/2] web — npm run dev:lan:https …

start "exhibition-web-https" cmd /k pushd "%~dp0web" ^&^& npm run dev:lan:https



echo 잠시 대기 ^(Next TLS 바인드^)…

timeout /t 5 /nobreak >nul



echo.

echo [2/2] FastAPI ^(0.0.0.0:8000^) …

start "exhibition-api" cmd /k pushd "%~dp0" ^&^& set EVENT_BRIDGE_BASE_URL=https://127.0.0.1:3001^& set EVENT_BRIDGE_SSL_VERIFY=false^& python -m uvicorn app.main:app --host 0.0.0.0 --port 8000



echo.

echo CMD 창 두 개 ^(웹 / API^). ipconfig 로 IPv4 확인.

echo.



endlocal

exit /b 0

