@echo off

setlocal

chcp 65001 >nul

cd /d "%~dp0"

echo.
echo [전시 — production] Next 빌드 후 start ^(dev Turbopack 대비 RAM 적음^)
echo   HTTP: http://0.0.0.0:3001  ^(태블릿 카메라/HTTPS 필요 시 start-dev-trusted.bat^)
echo   FastAPI는 별도 창에서 8000
echo.

echo [1/2] web build …
pushd "%~dp0web"
call npm run build
if errorlevel 1 (
  popd
  echo build 실패
  pause
  exit /b 1
)

echo.
echo [2/2] web start:lan …
start "exhibition-web-prod" cmd /k npm run start:lan
popd

timeout /t 3 /nobreak >nul

echo.
echo [3/3] FastAPI …
start "exhibition-api" cmd /k pushd "%~dp0" ^&^& set EVENT_BRIDGE_BASE_URL=http://127.0.0.1:3001^& python -m uvicorn app.main:app --host 0.0.0.0 --port 8000

echo.
echo RAM이 다시 크면 web CMD 창만 닫고 start-prod.bat 을 다시 실행하세요.
echo.

endlocal
exit /b 0
