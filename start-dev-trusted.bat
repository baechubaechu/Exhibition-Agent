@echo off

setlocal

chcp 65001 >nul

cd /d "%~dp0"



if not exist "%~dp0certs\cert.pem" goto nocert

if not exist "%~dp0certs\cert-key.pem" goto nocert



echo.

echo [HTTPS + mkcert] npm run dev:lan:https:trusted

echo       안드로이드에 mkcert CA 설치 후 경고 없이 접속 가능할 수 있음.

echo       가이드: docs\tablet-trusted-https-ko.txt

echo.



echo [1/2] web …

start "exhibition-web-https-trusted" cmd /k pushd "%~dp0web" ^&^& npm run dev:lan:https:trusted



echo 잠시 대기 …

timeout /t 5 /nobreak >nul



echo.

echo [2/2] FastAPI ^(브리지 TLS 검증 기본 ON / mkcert 신뢰 전제^) …

start "exhibition-api" cmd /k pushd "%~dp0" ^&^& set EVENT_BRIDGE_BASE_URL=https://127.0.0.1:3001^& python -m uvicorn app.main:app --host 0.0.0.0 --port 8000



echo.

echo CMD 창 두 개. 태블릿 https://^(IPv4^):3001

echo.

endlocal

exit /b 0



:nocert

echo.

echo certs\cert.pem 또는 certs\cert-key.pem 이 없습니다.

echo docs\tablet-trusted-https-ko.txt 를 보고 mkcert 로 발급한 뒤 이름을 맞추세요.

echo.

pause

endlocal

exit /b 1

