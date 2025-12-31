@echo off
REM Visual Testing Runner for HexMap (Windows)
REM This script runs Playwright tests against the local dev server

echo HexMap Visual Testing
echo =======================
echo.

REM Activate conda environment
echo Activating conda environment python310...
call conda activate python310
if errorlevel 1 (
    echo ERROR: Failed to activate conda environment 'python310'
    echo Make sure conda is initialized and the environment exists.
    pause
    exit /b 1
)

REM Check if playwright is installed
python -c "import playwright" 2>nul
if errorlevel 1 (
    echo Installing Playwright...
    pip install playwright
    python -m playwright install chromium
)

echo Starting dev server and running visual tests...
echo.

REM Prevent React from opening browser and set specific port
set BROWSER=none
set PORT=3333
set CI=true

REM Run tests with server management (90s timeout for React compilation)
python with_server.py --server "npm start" --port 3333 --timeout 90 -- python test_hexmap_visual.py

echo.
echo Tests complete! Check test-screenshots/ for visual results
pause
