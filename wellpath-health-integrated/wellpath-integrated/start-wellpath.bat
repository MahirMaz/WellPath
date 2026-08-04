@echo off
REM ============================================================
REM  WellPath one-click launcher
REM  Starts backend (auto-reload) + frontend (Vite HMR),
REM  then opens the app in your default browser.
REM  Any code change you save is picked up live.
REM ============================================================

set ROOT=%~dp0

echo.
echo  ===== Starting WellPath =====
echo.

REM --- Backend (nodemon: auto-restarts on save) ---
echo  Starting backend on http://localhost:3000 ...
start "WellPath Backend" cmd /k "cd /d %ROOT%backend && npm run dev"

REM --- Give the backend a head start so the DB pool is ready ---
timeout /t 4 /nobreak >nul

REM --- Frontend (Vite: hot-reloads on save) ---
echo  Starting frontend on http://localhost:5173 ...
start "WellPath Frontend" cmd /k "cd /d %ROOT% && npm run dev"

REM --- Wait for Vite to boot, then open the browser ---
timeout /t 5 /nobreak >nul
echo  Opening browser ...
start "" http://localhost:5173

echo.
echo  WellPath is up. Two terminal windows are running the servers.
echo  Close those windows (or press Ctrl+C in each) to stop.
echo.
pause
