@echo off
REM Fast regenerate - just runs layout, assumes server already running
REM Usage: regen.cmd [--num-apps N] [--seed S] [--water-gap N] [other args]

call conda activate python310
python "%~dp0continent_layout.py" --generate %*

if errorlevel 1 (
    echo ERROR: Layout generation failed
    exit /b 1
)

echo.
echo Done! Refresh browser (F5) to see changes.
echo (React doesn't hot-reload JSON changes)
