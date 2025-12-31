@echo off
REM Start the HexMap development server
REM Usage: start.cmd

echo Starting HexMap dev server...
echo.
echo Once started, open http://localhost:3000 in your browser
echo Press Ctrl+C to stop the server
echo.

cd /d "%~dp0.."
npm start
