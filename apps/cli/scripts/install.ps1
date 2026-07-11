# Installs the standalone oh.exe from the latest GitHub release,
# verified against SHA256SUMS.txt.
#
#   powershell -c "irm https://github.com/OpenHeaders/open-headers-releases/releases/latest/download/install-oh.ps1 | iex"
#
# Environment:
#   OH_INSTALL_DIR    install directory (default: %LOCALAPPDATA%\OpenHeaders\bin)
#   OH_RELEASE_TAG    release tag to install (default: latest)
$ErrorActionPreference = 'Stop'

$repo = 'OpenHeaders/open-headers-releases'
$tag = if ($env:OH_RELEASE_TAG) { $env:OH_RELEASE_TAG } else { 'latest' }
$installDir = if ($env:OH_INSTALL_DIR) { $env:OH_INSTALL_DIR } else { Join-Path $env:LOCALAPPDATA 'OpenHeaders\bin' }

$baseUrl = if ($tag -eq 'latest') {
  "https://github.com/$repo/releases/latest/download"
} else {
  "https://github.com/$repo/releases/download/$tag"
}

if ($env:PROCESSOR_ARCHITECTURE -ne 'AMD64') {
  Write-Error "install-oh: only win-x64 binaries are published (this machine: $env:PROCESSOR_ARCHITECTURE) - use the Node channel instead: npm install -g @openheaders/cli"
}

# Resolve the asset name and checksum from the release manifest.
$sums = (Invoke-WebRequest -Uri "$baseUrl/SHA256SUMS.txt" -UseBasicParsing).Content
$line = $sums -split "`n" | Where-Object { $_ -match '^\s*([0-9a-f]{64})\s+(oh-[0-9]\S*-win-x64\.exe)\s*$' } | Select-Object -First 1
if (-not $line) {
  Write-Error 'install-oh: release has no oh binary for win-x64'
}
$null = $line -match '^\s*([0-9a-f]{64})\s+(oh-[0-9]\S*-win-x64\.exe)\s*$'
$expected = $Matches[1]
$asset = $Matches[2]

$tmpFile = Join-Path ([System.IO.Path]::GetTempPath()) $asset
Write-Host "install-oh: downloading $asset"
Invoke-WebRequest -Uri "$baseUrl/$asset" -OutFile $tmpFile -UseBasicParsing

$actual = (Get-FileHash -Path $tmpFile -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actual -ne $expected) {
  Remove-Item $tmpFile -Force
  Write-Error "install-oh: checksum mismatch for $asset (expected $expected, got $actual)"
}

New-Item -ItemType Directory -Path $installDir -Force | Out-Null
Move-Item -Path $tmpFile -Destination (Join-Path $installDir 'oh.exe') -Force
Write-Host "install-oh: installed $installDir\oh.exe ($asset)"

# Put the install dir on the user PATH so new shells find `oh`.
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if (($userPath -split ';') -notcontains $installDir) {
  [Environment]::SetEnvironmentVariable('Path', "$userPath;$installDir", 'User')
  Write-Host "install-oh: added $installDir to your user PATH - open a new terminal to use 'oh'"
}

Write-Host ''
Write-Host 'Note: oh.exe is not code-signed yet; SmartScreen may warn on first run (More info -> Run anyway).'
& (Join-Path $installDir 'oh.exe') --version
