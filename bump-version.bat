@echo off
setlocal enabledelayedexpansion
title kumpulenak - Asset Version Bumper
color 0F

echo ====================================================
echo   kumpulenak Asset Version Bumper
echo ====================================================
echo.

:: Cek apakah Node.js terinstal
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo [ERROR] Node.js tidak ditemukan di komputer Anda!
    echo Silakan instal Node.js terlebih dahulu untuk menjalankan script ini.
    echo.
    pause
    exit /b 1
)

:: Tanya versi baru dari user
set /p NEW_VERSION="Masukkan versi baru (contoh: 3.4.0): "

if "%NEW_VERSION%"=="" (
    color 0C
    echo [ERROR] Versi tidak boleh kosong!
    echo.
    pause
    exit /b 1
)

echo.
:: Jalankan script node
node bump-version.js !NEW_VERSION!
set NODE_ERROR=%ERRORLEVEL%

if %NODE_ERROR% NEQ 0 (
    color 0C
    echo.
    echo [ERROR] Gagal memperbarui versi.
    echo.
    pause
    exit /b %NODE_ERROR%
)

echo.
:: Git Auto-Push
where git >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    set /p CHOICE="Apakah Anda ingin langsung commit dan push ke GitHub? (Y/N): "
    if /i "!CHOICE!"=="Y" (
        echo.
        echo [*] Menambahkan file ke git staging...
        git add *.html
        if exist "sw.js" git add sw.js
        git add bump-version.js
        git add bump-version.bat
        
        echo [*] Membuat commit...
        git commit -m "chore(cache): bump version to !NEW_VERSION!"
        
        echo [*] Melakukan push ke GitHub...
        git push origin main
        
        if !ERRORLEVEL! EQU 0 (
            echo.
            echo [SUCCESS] Versi cache baru berhasil di-push ke GitHub!
        ) else (
            color 0C
            echo.
            echo [WARNING] Gagal push ke GitHub. Silakan lakukan secara manual.
        )
    )
)

echo.
echo Selesai! Menutup dalam 5 detik...
timeout /t 5 >nul
