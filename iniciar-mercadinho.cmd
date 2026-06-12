@echo off
setlocal

set "API_ROOT=C:\Dev\MercadinhoApi"
set "FRONT_ROOT=C:\Dev\mercadinho-front"

if not exist "%API_ROOT%\run-api-clean.ps1" (
  echo [ERRO] Nao encontrei o script: %API_ROOT%\run-api-clean.ps1
  exit /b 1
)

start "Mercadinho API" powershell -NoExit -ExecutionPolicy Bypass -File "%API_ROOT%\run-api-clean.ps1"
start "Mercadinho Front" powershell -NoExit -Command "npm --prefix \"%FRONT_ROOT%\" start"

echo.
echo Mercadinho iniciado em janelas separadas.
echo API:  http://localhost:5122
echo Front: http://localhost:3000
echo.
echo Aguardando o frontend subir...
powershell -NoProfile -Command "Start-Sleep -Seconds 5" >nul 2>&1
start "" "http://localhost:3000"

endlocal
