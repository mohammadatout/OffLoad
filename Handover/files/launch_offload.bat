@echo off
title OffLoad Launcher
echo ============================================
echo        OffLoad Suite Launcher
echo ============================================
echo.

echo [1/4] Starting Normalization Server (port 3000)...
start "Normalization Server" /min cmd /c "cd /d "%~dp0Normalization\Cursor_Build_Norm" && npm run dev"

echo [2/4] Starting Matching Engine (port 8501)...
start "Matching Engine" /min cmd /c "cd /d "%~dp0Matching_Engine" && streamlit run entity_matcher_v4.py"

echo [3/4] Waiting for servers to start...
timeout /t 6 /nobreak >nul

echo [4/4] Opening OffLoad Suite...
start "" http://localhost:3000

echo.
echo ============================================
echo  OffLoad Suite is running!
echo  Open http://localhost:3000
echo  Use tabs to switch between tools.
echo.
echo  Close this window to keep servers running.
echo  To stop servers, close their terminal windows.
echo ============================================
pause
