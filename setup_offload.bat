@echo off
title OffLoad - First Time Setup
color 0A
echo ============================================
echo        OffLoad - First Time Setup
echo ============================================
echo.
echo This will install everything you need and
echo launch the app. Just sit back and wait!
echo.
echo ============================================
echo.

REM --- Verify folder structure ---
echo [1/6] Verifying project files...
if not exist "%~dp0Normalization\Cursor_Build_Norm\package.json" (
    echo.
    echo  ERROR: Project files are missing or incomplete!
    echo.
    echo  Make sure you have the ENTIRE OffLoad folder,
    echo  not just this setup file.
    echo.
    echo  Ask Mohammad to share the full folder with you.
    echo.
    pause
    exit /b 1
)
if not exist "%~dp0Matching_Engine\requirements.txt" (
    echo.
    echo  ERROR: Matching Engine files are missing!
    echo.
    echo  Make sure you have the ENTIRE OffLoad folder,
    echo  not just this setup file.
    echo.
    echo  Ask Mohammad to share the full folder with you.
    echo.
    pause
    exit /b 1
)
echo      Project files OK!

REM --- Check for Node.js ---
echo [2/6] Checking for Node.js...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo  ERROR: Node.js is not installed!
    echo.
    echo  Please install it from: https://nodejs.org
    echo  Download the LTS version, run the installer,
    echo  then run this setup again.
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node -v') do echo      Found Node.js %%i

REM --- Check for Python (real install, not Windows Store alias) ---
echo [3/6] Checking for Python...
python --version >nul 2>nul
if %errorlevel% neq 0 (
    goto :python_missing
)
REM Verify it's a real Python, not the Windows Store redirect
for /f "tokens=*" %%i in ('python -c "import sys; print(sys.executable)" 2^>nul') do set PYTHON_PATH=%%i
if "%PYTHON_PATH%"=="" goto :python_missing
echo %PYTHON_PATH% | findstr /i "WindowsApps" >nul 2>nul
if %errorlevel% equ 0 (
    goto :python_missing
)
for /f "tokens=*" %%i in ('python --version') do echo      Found %%i
goto :python_ok

:python_missing
echo.
echo  ERROR: Python is not installed (or only the Windows Store shortcut exists).
echo.
echo  Please install Python:
echo    1. Go to https://python.org
echo    2. Click "Download Python"
echo    3. Run the installer
echo    4. IMPORTANT: Check the box "Add Python to PATH"
echo    5. Click "Install Now"
echo    6. Then run this setup again.
echo.
pause
exit /b 1

:python_ok

REM --- Install Node.js dependencies ---
echo.
echo [4/6] Installing Normalization app dependencies...
echo      (this may take a couple of minutes)
cd /d "%~dp0Normalization\Cursor_Build_Norm"
call npm install
if %errorlevel% neq 0 (
    echo.
    echo  ERROR: Failed to install Node.js dependencies.
    echo  Please check your internet connection and try again.
    echo.
    pause
    exit /b 1
)
echo      Done!

REM --- Install Python dependencies ---
echo.
echo [5/6] Installing Matching Engine dependencies...
echo      (this may take a couple of minutes)
cd /d "%~dp0Matching_Engine"
python -m pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo.
    echo  ERROR: Failed to install Python dependencies.
    echo  Please check your internet connection and try again.
    echo.
    pause
    exit /b 1
)
echo      Done!

REM --- Launch the apps ---
echo.
echo [6/6] Starting the apps...
echo.
cd /d "%~dp0"

start "Normalization Server" /min cmd /c "cd /d "%~dp0Normalization\Cursor_Build_Norm" && npm run dev"
start "Matching Engine" /min cmd /c "cd /d "%~dp0Matching_Engine" && python -m streamlit run entity_matcher_v4.py"

echo Waiting for servers to start...
timeout /t 8 /nobreak >nul

start "" http://localhost:3000
start "" http://localhost:8501

echo.
echo ============================================
echo.
echo  Setup complete! Both apps are running:
echo.
echo    Normalization:    http://localhost:3000
echo    Matching Engine:  http://localhost:8501
echo.
echo  Close this window to keep servers running.
echo  To stop, close the server terminal windows.
echo.
echo ============================================
pause
