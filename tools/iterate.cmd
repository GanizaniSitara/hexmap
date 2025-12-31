@echo off
REM Quick iteration script for continent layout development
REM Usage: iterate.cmd [--num-apps N] [--seed S] [other args]

echo ========================================
echo HexMap Layout Iterator
echo ========================================

REM Activate conda environment
call conda activate python310

REM Run the layout generator (pass through any arguments)
echo.
echo Generating layout...
python "%~dp0continent_layout.py" --generate %*

if errorlevel 1 (
    echo.
    echo ERROR: Layout generation failed
    pause
    exit /b 1
)

echo.
echo Layout written to src/data.json

REM Check if dev server is running on port 3000
netstat -ano | findstr ":3000.*LISTENING" >nul 2>&1
if errorlevel 1 (
    echo.
    echo Dev server not running. Starting it...
    echo (Keep this window open, or run 'npm start' in another terminal)
    echo.
    cd /d "%~dp0.."
    start "HexMap Dev Server" cmd /k "npm start"

    REM Wait for server to start
    echo Waiting for server to start...
    timeout /t 5 /nobreak >nul
)

REM Open browser (or refresh if already open)
echo.
echo Opening browser...
start http://localhost:3000

echo.
echo ========================================
echo Done! Browser should show updated map.
echo Re-run this script to iterate.
echo ========================================
