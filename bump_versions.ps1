$ErrorActionPreference = 'Stop'
$PSScriptRoot = Split-Path -Parent -Path $MyInvocation.MyCommand.Definition
if (-not $PSScriptRoot) { $PSScriptRoot = Get-Location }

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

Write-Host ""
Write-Host "============================================"
Write-Host "  kumpulenak Smart Cache Buster / Version Bumper"
Write-Host "============================================"
Write-Host ""

# Get all HTML files in the project root
$htmlFiles = Get-ChildItem -Path $PSScriptRoot -Filter "*.html"

# Cache of computed hashes so we don't re-read the same asset multiple times
$hashCache = @{}

function Get-FileHashShort {
    param (
        [string]$filePath
    )
    if ($hashCache.ContainsKey($filePath)) {
        return $hashCache[$filePath]
    }
    if (Test-Path $filePath) {
        $hashAlg = [System.Security.Cryptography.HashAlgorithm]::Create("MD5")
        $fileBytes = [System.IO.File]::ReadAllBytes($filePath)
        $hashBytes = $hashAlg.ComputeHash($fileBytes)
        $fullHash = -join ($hashBytes | ForEach-Object { $_.ToString("x2") })
        $shortHash = $fullHash.Substring(0, 8)
        $hashCache[$filePath] = $shortHash
        return $shortHash
    }
    return $null
}

$anyUpdated = $false

foreach ($file in $htmlFiles) {
    $filePath = $file.FullName
    $content = [System.IO.File]::ReadAllText($filePath)
    $newContent = $content
    $fileUpdated = $false

    # Regex to find links to CSS/JS under assets/ with a version parameter
    # Matches: href="assets/css/gallery.css?v=2.9" or src='/assets/js/gallery.js?v=3.3'
    # Double single-quotes ('') are used to escape single quotes inside the PowerShell string.
    $regex = [regex]'(?i)(href|src)=(["''])(?<Path>\/?assets\/(?<SubDir>css|js)\/(?<FileName>[^?#"''>]+))\?v=(?<Ver>[^"''\s>]+)\2'
    $matches = $regex.Matches($content)

    foreach ($match in $matches) {
        $fullMatch = $match.Value
        $pathVal = $match.Groups['Path'].Value
        $fileName = $match.Groups['FileName'].Value
        $currentVer = $match.Groups['Ver'].Value
        $quote = $match.Groups[2].Value

        # Map to local asset file path
        $cleanPath = $pathVal.TrimStart('/')
        $assetLocalPath = Join-Path $PSScriptRoot $cleanPath

        if (Test-Path $assetLocalPath) {
            $newVer = Get-FileHashShort -filePath $assetLocalPath
            if ($newVer -and $newVer -ne $currentVer) {
                # Construct the replacement string preserving the exact quotes used
                $attr = $match.Groups[1].Value # href or src
                $target = "$attr=$quote$pathVal`?v=$currentVer$quote"
                $replacement = "$attr=$quote$pathVal`?v=$newVer$quote"
                
                # Replace in the content
                $newContent = $newContent.Replace($target, $replacement)
                
                Write-Host "[BUMP] In $($file.Name): $fileName ($currentVer -> $newVer)"
                $fileUpdated = $true
                $anyUpdated = $true
            }
        } else {
            Write-Warning "Asset file not found on disk: $assetLocalPath (referenced in $($file.Name))"
        }
    }

    if ($fileUpdated) {
        # Preserve original line endings (PowerShell Replace preserves them, WriteAllText writes the string)
        [System.IO.File]::WriteAllText($filePath, $newContent, $utf8NoBom)
        Write-Host "[SAVED] Updated versions in $($file.Name)" -ForegroundColor Green
    }
}

if (-not $anyUpdated) {
    Write-Host "[INFO] Semua file asset sudah sinkron dengan versi cache terbaru. Tidak ada perubahan." -ForegroundColor Cyan
} else {
    Write-Host "[SUCCESS] Selesai memperbarui versi cache buster!" -ForegroundColor Green
}
Write-Host ""
