# Installs the standalone oh.exe, verified against the release's
# SHA256SUMS.txt. Everything resolves through the update feed
# (updates.openheaders.com): the current release from versions/stable.json,
# the binary from the feed's dl/<tag>/ path - one first-party domain,
# no GitHub reachability needed.
#
#   powershell -c "irm https://updates.openheaders.com/install.ps1 | iex"
#
# Environment:
#   OH_INSTALL_DIR    install directory (default: %LOCALAPPDATA%\OpenHeaders\bin)
#   OH_RELEASE_TAG    release tag to install (default: current stable)
$ErrorActionPreference = 'Stop'

$feed = 'https://updates.openheaders.com'
$installDir = if ($env:OH_INSTALL_DIR) { $env:OH_INSTALL_DIR } else { Join-Path $env:LOCALAPPDATA 'OpenHeaders\bin' }

$tag = if ($env:OH_RELEASE_TAG) {
  $env:OH_RELEASE_TAG
} else {
  $versions = Invoke-RestMethod -Uri "$feed/versions/stable.json" -UseBasicParsing
  if (-not $versions.cli.tag) {
    Write-Error "install-oh: could not resolve the current release from $feed/versions/stable.json"
  }
  $versions.cli.tag
}
$baseUrl = "$feed/dl/$tag"

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
  Write-Host "install-oh: added $installDir to your user PATH - open a new terminal to use 'oh.exe'"
}

Write-Host ''
Write-Host "Note: PowerShell aliases 'oh' to its Out-Host cmdlet - run 'oh.exe' there, or add 'Remove-Item Alias:oh' to your PowerShell profile. Other shells (cmd) can use plain 'oh'."
& (Join-Path $installDir 'oh.exe') --version
