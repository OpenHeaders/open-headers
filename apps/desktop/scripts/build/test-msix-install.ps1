# Installs a signed Windows package on this machine, the way a person's PC gets it - through the
# release's own installer program - and asks the installed package whether it starts. The release
# lane runs it on a machine of the package's own arch that never held the tree the package was
# packed from.
#
#   powershell -File scripts/build/test-msix-install.ps1 -Package <file.msix> -Installer <file.exe>
#
# The installer runs without its window, takes the package from this file where a person's run
# downloads it, and does not open the app. It must end with 0 and say in its own log that the
# package's signer is its own: a signed installer installs no other signer's package.
#
# Everything it looks for is read from the package's own manifest: the identity, the logos, the
# launch aliases - the app's is the first the manifest names. Every check runs and reports, so
# one run answers all of them; the package is removed again at the end.
#
# Run by Windows PowerShell, which reads a script without a byte-order mark in the machine's old
# code page: this file stays plain ASCII.
param([Parameter(Mandatory = $true)][string]$Package, [Parameter(Mandatory = $true)][string]$Installer)

$failed = 0
function Report([bool]$ok, [string]$line) {
  if (-not $ok) { $script:failed++ }
  Write-Host ("{0}  {1}" -f $(if ($ok) { 'PASS' } else { 'FAIL' }), $line)
}
function FirstLines($text) { (("$text" -split "`r?`n" | Where-Object { $_.Trim() } | Select-Object -First 6) -join ' / ') }

if (-not (Test-Path -LiteralPath $Package -PathType Leaf)) { Write-Host "no package at $Package"; exit 1 }
$Package = (Resolve-Path -LiteralPath $Package).Path
if (-not (Test-Path -LiteralPath $Installer -PathType Leaf)) { Write-Host "no installer at $Installer"; exit 1 }
$Installer = (Resolve-Path -LiteralPath $Installer).Path

$os = Get-CimInstance Win32_OperatingSystem
$ubr = (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion').UBR
Write-Host "machine: $($os.Caption) $($os.BuildNumber).$ubr $env:PROCESSOR_ARCHITECTURE, user $env:USERNAME, session $([Diagnostics.Process]::GetCurrentProcess().SessionId)"
# What decides whether Windows takes a package that is not from the Store, as this machine has it.
foreach ($key in 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\Appx', 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\AppModelUnlock') {
  $values = Get-ItemProperty -LiteralPath $key -ErrorAction SilentlyContinue
  Write-Host "sideloading: $key AllowAllTrustedApps=[$($values.AllowAllTrustedApps)] AllowDevelopmentWithoutDevLicense=[$($values.AllowDevelopmentWithoutDevLicense)]"
}

# The package's own manifest: what Windows is to make of it.
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::OpenRead($Package)
try {
  $entry = $zip.GetEntry('AppxManifest.xml')
  if (-not $entry) { Write-Host "$Package holds no AppxManifest.xml"; exit 1 }
  $reader = New-Object IO.StreamReader($entry.Open())
  try { [xml]$manifest = $reader.ReadToEnd() } finally { $reader.Dispose() }
} finally { $zip.Dispose() }
$identity = $manifest.Package.Identity
$applications = @($manifest.Package.Applications.Application)
$logos = @($manifest.Package.Properties.Logo) + @($applications | ForEach-Object { $_.VisualElements.Square44x44Logo; $_.VisualElements.Square150x150Logo }) | Select-Object -Unique
$aliases = @($applications | ForEach-Object { $_.Extensions.Extension } | Where-Object { $_.Category -eq 'windows.appExecutionAlias' } | ForEach-Object { $_.AppExecutionAlias.ExecutionAlias.Alias })
Write-Host "package: $($identity.Name) $($identity.Version) $($identity.ProcessorArchitecture), publisher $($identity.Publisher)"
Write-Host "package: logos [$($logos -join ', ')] aliases [$($aliases -join ', ')] size $((Get-Item -LiteralPath $Package).Length)"

$signature = Get-AuthenticodeSignature -LiteralPath $Package
Report ($signature.Status -eq 'Valid') "this machine trusts the package's signature ($($signature.Status), $($signature.SignerCertificate.Subject))"

$earlier = @(Get-AppxPackage -Name $identity.Name)
if ($earlier.Count -gt 0) { Write-Host "a package named $($identity.Name) is already installed ($($earlier[0].PackageFullName)); stop"; exit 1 }

$shown = (Get-Item -LiteralPath $Installer).VersionInfo
Write-Host "installer: $($shown.FileDescription) $($shown.ProductVersion), $((Get-Item -LiteralPath $Installer).Length) bytes, signed by $((Get-AuthenticodeSignature -LiteralPath $Installer).SignerCertificate.Subject)"
$runLog = Join-Path $env:TEMP 'openheaders-installer-test.log'
Remove-Item -LiteralPath $runLog -Force -ErrorAction SilentlyContinue
$watch = [Diagnostics.Stopwatch]::StartNew()
$ended = $false
try {
  $run = Start-Process -FilePath $Installer -ArgumentList ('--silent --no-launch --package "{0}" --log "{1}"' -f $Package, $runLog) -PassThru
  # An exit code is read only from a process whose handle was taken while it ran.
  $null = $run.Handle
  if ($run.WaitForExit(300000)) {
    $ended = $run.ExitCode -eq 0
    Report $ended "the installer installs the package (exit $($run.ExitCode), $($watch.ElapsedMilliseconds) ms)"
  } else {
    Report $false 'the installer installs the package (it did not end in 300 s)'
    Stop-Process -Id $run.Id -Force -ErrorAction SilentlyContinue
  }
} catch {
  Report $false "the installer installs the package: $(FirstLines $_.Exception.Message)"
}
$said = @(Get-Content -LiteralPath $runLog -ErrorAction SilentlyContinue)
foreach ($line in $said) { Write-Host "  installer | $line" }
Report (@($said | Where-Object { $_ -like "*the package's signer is this installer's own*" }).Count -eq 1) "the installer held the package to its own signer"
if (-not $ended) { Write-Host "$failed check(s) failed"; exit 1 }

try {
  $installed = Get-AppxPackage -Name $identity.Name
  Write-Host "installed: $($installed.PackageFullName) at $($installed.InstallLocation)"
  Report ("$($installed.Version)" -eq $identity.Version) "Windows reads the manifest's version ($($installed.Version))"
  Report ("$($installed.Architecture)" -ieq $identity.ProcessorArchitecture) "Windows reads the manifest's arch ($($installed.Architecture))"
  Report ($installed.Publisher -ceq $identity.Publisher) "Windows reads the manifest's publisher ($($installed.Publisher))"

  # A logo as Windows finds it: the manifest's name looked up in the package's index. An index
  # that names its files otherwise packs, signs and installs without a word.
  Add-Type -Namespace OpenHeaders -Name Shell -MemberDefinition '[DllImport("shlwapi.dll", CharSet = CharSet.Unicode)] public static extern int SHLoadIndirectString(string pszSource, System.Text.StringBuilder pszOutBuf, int cchOutBuf, System.IntPtr ppvReserved);'
  foreach ($logo in $logos) {
    $found = New-Object Text.StringBuilder 1024
    $resource = "ms-resource://$($identity.Name)/Files/$($logo -replace '\\', '/')"
    $result = [OpenHeaders.Shell]::SHLoadIndirectString("@{$($installed.PackageFullName)?$resource}", $found, 1024, [IntPtr]::Zero)
    Report ($result -eq 0 -and $found.Length -gt 0) ("the logo $logo resolves (0x{0:X8} -> {1})" -f $result, $found.ToString())
  }

  foreach ($alias in $aliases) {
    $aliasPath = Join-Path $env:LOCALAPPDATA "Microsoft\WindowsApps\$alias"
    $item = Get-Item -LiteralPath $aliasPath -Force -ErrorAction SilentlyContinue
    Report ($null -ne $item) "Windows keeps the launch alias $alias (attributes [$($item.Attributes)])"
  }

  # The app through its alias, in the check mode: its runtime starts, proves the parts a start
  # cannot do without, and ends. It opens no data folder and is not an app instance.
  $out = Join-Path $env:TEMP 'openheaders-package-check-out.txt'
  $err = Join-Path $env:TEMP 'openheaders-package-check-err.txt'
  $watch.Restart()
  try {
    $check = Start-Process -FilePath (Join-Path $env:LOCALAPPDATA "Microsoft\WindowsApps\$($aliases[0])") -ArgumentList '--check-package-start' -PassThru -RedirectStandardOutput $out -RedirectStandardError $err
    # An exit code is read only from a process whose handle was taken while it ran.
    $null = $check.Handle
    if ($check.WaitForExit(60000)) {
      Report ($check.ExitCode -eq 0) "the installed app answers the start check with 0 (exit $($check.ExitCode), $($watch.ElapsedMilliseconds) ms)"
    } else {
      Report $false 'the installed app answers the start check with 0 (it did not end in 60 s)'
      Stop-Process -Id $check.Id -Force -ErrorAction SilentlyContinue
    }
  } catch {
    Report $false "the installed app answers the start check with 0: $(FirstLines $_.Exception.Message)"
  }
  foreach ($file in $out, $err) {
    foreach ($line in @(Get-Content -LiteralPath $file -ErrorAction SilentlyContinue | Where-Object { $_.Trim() } | Select-Object -First 12)) { Write-Host "  $(Split-Path -Leaf $file) | $line" }
  }
} finally {
  Get-AppxPackage -Name $identity.Name | Remove-AppxPackage -ErrorAction SilentlyContinue
  Write-Host "removed: $(@(Get-AppxPackage -Name $identity.Name).Count) package(s) named $($identity.Name) left"
}

if ($failed -gt 0) { Write-Host "$failed check(s) failed"; exit 1 }
Write-Host 'the package installs and starts'
exit 0
