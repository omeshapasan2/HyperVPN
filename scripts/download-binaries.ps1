# Download and prepare sidecar binaries for HyperVPN on Windows (x86_64)
$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path "$PSScriptRoot\.."
$TargetDirs = @(
    "$ProjectRoot\src-tauri\binaries",
    "$ProjectRoot\binaries"
)

foreach ($dir in $TargetDirs) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "[+] Created directory: $dir" -ForegroundColor Green
    }
}

$TempDir = "$env:TEMP\hypervpn-bin-downloads"
if (-not (Test-Path $TempDir)) {
    New-Item -ItemType Directory -Path $TempDir -Force | Out-Null
}

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "     HyperVPN Windows Sidecar Binaries Downloader     " -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

# 1. Download Xray-core
Write-Host "`n[1/3] Downloading Xray-core (x86_64)..." -ForegroundColor Yellow
$XrayZip = "$TempDir\xray.zip"
$XrayUrl = "https://github.com/XTLS/Xray-core/releases/latest/download/Xray-windows-64.zip"

try {
    Invoke-WebRequest -Uri $XrayUrl -OutFile $XrayZip -UseBasicParsing
    Expand-Archive -Path $XrayZip -DestinationPath "$TempDir\xray_extracted" -Force

    foreach ($dir in $TargetDirs) {
        Copy-Item "$TempDir\xray_extracted\xray.exe" -Destination "$dir\xray.exe" -Force
        if (Test-Path "$TempDir\xray_extracted\geoip.dat") {
            Copy-Item "$TempDir\xray_extracted\geoip.dat" -Destination "$dir\geoip.dat" -Force
        }
        if (Test-Path "$TempDir\xray_extracted\geosite.dat") {
            Copy-Item "$TempDir\xray_extracted\geosite.dat" -Destination "$dir\geosite.dat" -Force
        }
    }
    Write-Host "[OK] xray.exe installed successfully." -ForegroundColor Green
} catch {
    Write-Host "[!] Failed to download Xray-core automatically: $_" -ForegroundColor Red
    Write-Host "    Please download manually from https://github.com/XTLS/Xray-core/releases" -ForegroundColor Gray
}

# 2. Download tun2socks
Write-Host "`n[2/3] Downloading tun2socks (windows-amd64)..." -ForegroundColor Yellow
$Tun2socksZip = "$TempDir\tun2socks.zip"
$Tun2socksUrl = "https://github.com/xjasonlyu/tun2socks/releases/latest/download/tun2socks-windows-amd64.zip"

try {
    Invoke-WebRequest -Uri $Tun2socksUrl -OutFile $Tun2socksZip -UseBasicParsing
    Expand-Archive -Path $Tun2socksZip -DestinationPath "$TempDir\tun2socks_extracted" -Force

    $foundExe = Get-ChildItem "$TempDir\tun2socks_extracted" -Filter "*.exe" -Recurse | Select-Object -First 1
    if ($foundExe) {
        foreach ($dir in $TargetDirs) {
            Copy-Item $foundExe.FullName -Destination "$dir\tun2socks.exe" -Force
        }
        Write-Host "[OK] tun2socks.exe installed successfully." -ForegroundColor Green
    } else {
        Write-Host "[!] tun2socks.exe not found in downloaded zip." -ForegroundColor Red
    }
} catch {
    Write-Host "[!] Failed to download tun2socks automatically: $_" -ForegroundColor Red
    Write-Host "    Please download manually from https://github.com/xjasonlyu/tun2socks/releases" -ForegroundColor Gray
}

# 3. Download Wintun driver (wintun.dll)
Write-Host "`n[3/3] Downloading Wintun Driver (wintun.dll)..." -ForegroundColor Yellow
$WintunZip = "$TempDir\wintun.zip"
$WintunUrl = "https://www.wintun.net/builds/wintun-0.14.1.zip"

try {
    Invoke-WebRequest -Uri $WintunUrl -OutFile $WintunZip -UseBasicParsing
    Expand-Archive -Path $WintunZip -DestinationPath "$TempDir\wintun_extracted" -Force

    $wintunDll = "$TempDir\wintun_extracted\wintun\bin\amd64\wintun.dll"
    if (Test-Path $wintunDll) {
        foreach ($dir in $TargetDirs) {
            Copy-Item $wintunDll -Destination "$dir\wintun.dll" -Force
        }
        Write-Host "[OK] wintun.dll (amd64) installed successfully." -ForegroundColor Green
    } else {
        Write-Host "[!] wintun.dll not found in extracted folder." -ForegroundColor Red
    }
} catch {
    Write-Host "[!] Failed to download Wintun automatically: $_" -ForegroundColor Red
    Write-Host "    Please download manually from https://www.wintun.net/" -ForegroundColor Gray
}

# Cleanup temporary files
Remove-Item -Path $TempDir -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "`n======================================================" -ForegroundColor Cyan
Write-Host " [OK] Binary setup complete! You can now run HyperVPN. " -ForegroundColor Green
Write-Host "======================================================`n" -ForegroundColor Cyan
