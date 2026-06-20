@echo off
setlocal enabledelayedexpansion
title kumpulenak - Smart Version Bumper v1.0
color 0F

echo ====================================================
echo   kumpulenak Smart Version Bumper v1.0
echo ====================================================
echo.

:: 1. Verify Script File
if not exist ".\bump_versions.ps1" (
    color 0C
    echo [ERROR] File 'bump_versions.ps1' tidak ditemukan di direktori aktif!
    echo Silakan pastikan Anda menjalankan file batch ini dari direktori proyek.
    echo.
    pause
    exit /b 1
)

:: 2. Check for Git
where git >nul 2>nul
set GIT_AVAILABLE=%ERRORLEVEL%

echo [*] Memulai proses pembaruan cache buster...
echo.

:: Run PowerShell script
powershell -ExecutionPolicy Bypass -File .\bump_versions.ps1
set PS_ERROR=%ERRORLEVEL%

echo.
if %PS_ERROR% NEQ 0 (
    color 0C
    echo ====================================================
    echo   [ERROR] Terjadi kesalahan saat menjalankan script!
    echo ====================================================
    echo.
    pause
    exit /b %PS_ERROR%
)

color 0A
echo ====================================================
echo   [SUCCESS] Pembaruan versi cache buster selesai!
echo ====================================================
echo.

:: 3. Optional Auto Git Commit & Push
if %GIT_AVAILABLE% EQU 0 (
    echo [SMART] Terdeteksi instalasi Git di komputer Anda.
    set /p CHOICE="Apakah Anda ingin membuat commit dan push perubahan versi ke GitHub secara otomatis? (Y/N): "
    
    if /i "!CHOICE!"=="Y" (
        echo.
        echo [*] Menambahkan perubahan ke git staging...
        git add *.html
        
        echo [*] Membuat commit...
        git commit -m "chore(cache): auto-bump asset version query strings via smart script"
        
        echo [*] Melakukan push ke GitHub...
        git push origin main
        
        if !ERRORLEVEL! EQU 0 (
            echo.
            echo [SUCCESS] Versi cache berhasil di-push! Vercel akan otomatis men-deploy.
        ) else (
            color 0C
            echo.
            echo [WARNING] Gagal melakukan push ke GitHub. Silakan lakukan secara manual.
        )
    ) else (
        echo [*] Lewati proses upload otomatis.
    )
)

echo.
echo Selesai! Menutup jendela dalam 5 detik...
timeout /t 5 >nul
