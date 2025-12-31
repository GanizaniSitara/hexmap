@echo off
REM Visual QA Screenshot Capture for HexMap (Windows)
REM Captures screenshots for Claude Code to analyze

echo HexMap Visual QA - Screenshot Capture
echo ======================================
echo.

REM Activate conda environment
echo Activating conda environment python310...
call conda activate python310
if errorlevel 1 (
    echo ERROR: Failed to activate conda environment 'python310'
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

REM Prevent React from opening browser and set specific port
set BROWSER=none
set PORT=3333
set CI=true

echo Starting dev server on port 3333 and capturing screenshots...
echo.

python with_server.py --server "npm start" --port 3333 --timeout 90 -- python test_visual_qa.py

echo.
echo Screenshots captured! Ask Claude Code to analyze them:
echo   "Please analyze the screenshots in test-screenshots/"
echo.
pause
