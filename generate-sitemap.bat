@echo off
setlocal
cd /d "%~dp0"

set "MODE=%~1"
if "%MODE%"=="" set "MODE=validate"

if /i "%MODE%"=="validate" (
    node generate_sitemap_fast.js --validate
) else if /i "%MODE%"=="bootstrap" (
    node generate_sitemap_fast.js --bootstrap
) else if /i "%MODE%"=="daily" (
    node generate_sitemap_fast.js --daily
) else (
    echo Usage: generate-sitemap.bat [validate^|bootstrap^|daily]
    exit /b 2
)

if errorlevel 1 exit /b %errorlevel%
echo Sitemap %MODE% selesai dan lolos validasi.
