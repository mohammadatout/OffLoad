@echo off
title OffLoad Launcher
echo ============================================
echo        OffLoad Suite Launcher
echo ============================================
echo.

echo [1/5] Starting Normalization Server (port 3000)...
start "Normalization Server" /min cmd /c "cd /d %~dp0Normalization\Cursor_Build_Norm && npm run dev"

echo [2/5] Starting Matcher API (port 8000)...
start "Matcher API" /min cmd /c "cd /d %~dp0Matching_Engine && python -m uvicorn matcher_service:app --host 0.0.0.0 --port 8000"

echo [3/5] Starting Streamlit legacy (port 8501)...
start "Streamlit Legacy" /min cmd /c "cd /d %~dp0Matching_Engine && streamlit run entity_matcher_v4.py --server.headless true"

echo [4/5] Waiting for Next.js to be ready...
:waitloop
timeout /t 2 /nobreak >nul
powershell -Command "try { $r = Invoke-WebRequest -Uri http://localhost:3000 -UseBasicParsing -TimeoutSec 2; exit 0 } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
    echo        Still waiting...
    goto waitloop
)

echo [5/5] Opening OffLoad Suite...
start "" http://localhost:3000

echo.
echo ============================================
echo  OffLoad Suite is running!
echo  - Next.js UI:    http://localhost:3000
echo  - Matcher API:   http://localhost:8000
echo  - Streamlit:     http://localhost:8501 (legacy)
echo.
echo  Use tabs to switch between Normalization
echo  and Matching Engine. One window, one URL.
echo.
echo  Close this window to keep servers running.
echo  To stop servers, close their terminal windows.
echo ============================================
pause
