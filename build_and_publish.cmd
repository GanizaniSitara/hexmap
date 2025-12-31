setlocal

echo Building project...
call npm run build
if errorlevel 1 (
    echo Build failed. Exiting.
    exit /b 1
)

echo Removing previously tracked files under docs...
for /f "delims=" %%f in ('git ls-files docs') do git rm --cached "%%f"

echo Deleting files in docs folder...
for /d %%i in (docs\*) do (
    if /i not "%%~nxi"==".git" rd /s /q "docs\%%i"
)
for %%i in (docs\*) do (
    del /q "docs\%%i"
)

echo Copying new build files to docs folder...
xcopy /e /h /y build\* docs\ >nul

echo Staging changes...
git add docs

echo Committing changes...
git commit -m "Update GitHub Pages build"

echo Pushing to origin...
git push origin main

echo Done.
endlocal
pause
