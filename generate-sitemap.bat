@echo off
setlocal enabledelayedexpansion
title kumpulenak - Smart Sitemap Generator v5.0
color 0F

echo ====================================================
echo   kumpulenak Smart Sitemap Generator v5.0
echo ====================================================
echo.

:: 1. Verifikasi File Script
if not exist ".\generate_sitemap.ps1" (
    color 0C
    echo [ERROR] File 'generate_sitemap.ps1' tidak ditemukan di direktori aktif!
    echo Silakan pastikan Anda menjalankan file batch ini dari direktori proyek.
    echo.
    pause
    exit /b 1
)

:: 2. Cek apakah Git terinstal jika nanti ingin auto-push
where git >nul 2>nul
set GIT_AVAILABLE=%ERRORLEVEL%

echo [*] Memulai proses crawling sitemap (No Delay)...
echo [*] Waktu Mulai: %TIME%
echo.

:: Jalankan PowerShell script
powershell -ExecutionPolicy Bypass -File .\generate_sitemap.ps1
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
echo   [SUCCESS] Pembuatan sitemap selesai dengan sukses!
echo ====================================================
echo Waktu Selesai: %TIME%
echo.

:: 3. Auto Git Commit & Push (SMART FEATURE)
if %GIT_AVAILABLE% EQU 0 (
    echo [SMART] Terdeteksi instalasi Git di komputer Anda.
    set /p CHOICE="Apakah Anda ingin meng-upload sitemap secara otomatis ke GitHub? (Y/N): "
    
    if /i "!CHOICE!"=="Y" (
        echo.
        echo [*] Menambahkan file sitemap ke git staging...
        git add sitemap_index.xml sitemaps/ sitemap_state.json sitemap_index.xml.gz sitemaps/*.xml
        
        echo [*] Membuat commit...
        git commit -m "chore(sitemap): auto-update sitemaps via smart script"
        
        echo [*] Melakukan push ke GitHub...
        git push origin main
        
        if !ERRORLEVEL! EQU 0 (
            echo.
            echo [SUCCESS] Sitemap berhasil di-upload! Vercel akan otomatis men-deploy.
        ) else (
            color 0C
            echo.
            echo [WARNING] Gagal melakukan push ke GitHub. Silakan push manual nanti.
        )
    ) else (
        echo [*] Lewati proses upload otomatis.
    )
) else (
    echo [INFO] Git tidak ditemukan di PATH sistem Anda.
    echo Silakan commit dan push file sitemap baru secara manual jika diperlukan.
)

echo.
echo Selesai! Menutup jendela dalam 5 detik...
timeout /t 5 >nul
