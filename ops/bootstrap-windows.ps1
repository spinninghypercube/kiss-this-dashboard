[CmdletBinding()]
param(
    [int]$Port = 8788,
    [string]$Bind = "0.0.0.0",
    [string]$InstallRoot = "$env:ProgramData\KissStartpage",
    [string]$DataDir = "",
    [string]$Branch = "main",
    [string]$RepoUrl = "https://github.com/spinninghypercube/kiss-startpage.git",
    [string]$ServiceName = "kiss-startpage-api",
    [switch]$SkipDependencyInstall,
    [switch]$NoService,
    [switch]$NoAutoStart
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"

function Write-Step {
    param([string]$Message)
    Write-Host "[bootstrap-windows] $Message"
}

function Test-IsWindowsAdmin {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Refresh-Path {
    $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if ([string]::IsNullOrWhiteSpace($machinePath) -and [string]::IsNullOrWhiteSpace($userPath)) {
        return
    }
    $env:Path = "$machinePath;$userPath"
}

function Invoke-External {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [string[]]$Arguments = @(),
        [string]$FailureMessage = "",
        [switch]$SuppressStderr
    )
    if ($SuppressStderr) {
        & $FilePath @Arguments 2>$null
    } else {
        & $FilePath @Arguments
    }
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        if ([string]::IsNullOrWhiteSpace($FailureMessage)) {
            throw "Command failed with exit code ${exitCode}: $FilePath $($Arguments -join ' ')"
        }
        throw "$FailureMessage (exit code $exitCode)"
    }
}

function Install-WingetPackage {
    param(
        [Parameter(Mandatory = $true)][string]$PackageId,
        [Parameter(Mandatory = $true)][string]$DisplayName
    )
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        throw "winget not found. Install $DisplayName manually, or install winget and rerun."
    }
    Write-Step "Installing $DisplayName ($PackageId) via winget"
    Invoke-External -FilePath "winget" -Arguments @(
        "install", "--id", $PackageId, "--exact",
        "--accept-package-agreements", "--accept-source-agreements", "--silent"
    ) -FailureMessage "Failed to install $DisplayName"
}

function Ensure-Command {
    param(
        [Parameter(Mandatory = $true)][string]$Command,
        [Parameter(Mandatory = $true)][string]$PackageId,
        [Parameter(Mandatory = $true)][string]$DisplayName
    )
    if (Get-Command $Command -ErrorAction SilentlyContinue) { return }
    if ($SkipDependencyInstall) {
        throw "Missing required command '$Command'. Install $DisplayName and rerun."
    }
    Install-WingetPackage -PackageId $PackageId -DisplayName $DisplayName
    Refresh-Path
    if (-not (Get-Command $Command -ErrorAction SilentlyContinue)) {
        throw "$DisplayName was installed, but '$Command' is still not available in PATH. Open a new admin PowerShell and rerun."
    }
}

function Test-PathIsLocalhost {
    param([string]$Address)
    $normalized = $Address.Trim().ToLowerInvariant()
    return $normalized -eq "127.0.0.1" -or $normalized -eq "::1" -or $normalized -eq "localhost"
}

function Wait-ForHealth {
    param([int]$HealthPort)
    $healthUrl = "http://127.0.0.1:${HealthPort}/health"
    for ($i = 0; $i -lt 60; $i++) {
        try {
            $null = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 3
            return $true
        }
        catch { Start-Sleep -Seconds 1 }
    }
    return $false
}

function Get-AppVersion {
    param([Parameter(Mandatory = $true)][string]$RepoRoot)
    $mainGo = Join-Path $RepoRoot "backend-go\main.go"
    if (-not (Test-Path $mainGo)) { throw "Unable to detect app version: missing $mainGo" }
    $raw = Get-Content -Path $mainGo -Raw
    $match = [regex]::Match($raw, 'appVersion\s*=\s*"([^"]+)"')
    if (-not $match.Success) { throw "Unable to detect app version in backend-go/main.go" }
    return $match.Groups[1].Value
}

function New-UrlShortcut {
    param([string]$Path, [string]$Url)
    Set-Content -Path $Path -Value "[InternetShortcut]`r`nURL=$Url`r`n" -Encoding Ascii
}

function New-LnkShortcut {
    param([string]$Path, [string]$Target, [string]$Arguments = "", [string]$Description = "")
    $wsh = New-Object -ComObject WScript.Shell
    $lnk = $wsh.CreateShortcut($Path)
    $lnk.TargetPath = $Target
    if ($Arguments) { $lnk.Arguments = $Arguments }
    if ($Description) { $lnk.Description = $Description }
    $lnk.Save()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($wsh) | Out-Null
}

try {
    if ($env:OS -ne "Windows_NT") { throw "This installer only supports Windows." }
    if ($Port -lt 1 -or $Port -gt 65535) { throw "Invalid --Port value: $Port" }
    if (-not (Test-IsWindowsAdmin)) {
        throw "Administrator privileges required. Right-click the EXE and choose 'Run as administrator'."
    }

    Refresh-Path

    Write-Step "Checking required tools"
    Ensure-Command -Command "git"  -PackageId "Git.Git"          -DisplayName "Git"
    Ensure-Command -Command "node" -PackageId "OpenJS.NodeJS.LTS" -DisplayName "Node.js LTS"
    Ensure-Command -Command "npm.cmd" -PackageId "OpenJS.NodeJS.LTS" -DisplayName "Node.js LTS"
    Ensure-Command -Command "go"   -PackageId "GoLang.Go"         -DisplayName "Go"
    if (-not $NoService) {
        Ensure-Command -Command "nssm" -PackageId "NSSM.NSSM" -DisplayName "NSSM"
    }

    $resolvedInstallRoot = [System.IO.Path]::GetFullPath($InstallRoot)
    $appDir              = Join-Path $resolvedInstallRoot "app"
    $resolvedDataDir     = if ([string]::IsNullOrWhiteSpace($DataDir)) { Join-Path $resolvedInstallRoot "data" } else { [System.IO.Path]::GetFullPath($DataDir) }
    $privateIconsDir     = Join-Path $resolvedInstallRoot "private-icons"
    $frontendDir         = Join-Path $appDir "frontend-svelte"
    $backendDir          = Join-Path $appDir "backend-go"
    $backendExe          = Join-Path $backendDir "kissdash-go.exe"
    $appRoot             = Join-Path $frontendDir "dist"
    $defaultConfig       = Join-Path $appDir "startpage-default-config.json"
    $launcherPath        = Join-Path $resolvedInstallRoot "run-kiss-startpage.cmd"
    $uninstallerPath     = Join-Path $resolvedInstallRoot "uninstall.ps1"
    $startMenuDir        = Join-Path $env:ProgramData "Microsoft\Windows\Start Menu\Programs\KISS Startpage"

    Write-Step "Preparing install directories"
    New-Item -ItemType Directory -Path $resolvedInstallRoot -Force | Out-Null
    New-Item -ItemType Directory -Path $resolvedDataDir     -Force | Out-Null
    New-Item -ItemType Directory -Path $privateIconsDir     -Force | Out-Null

    if (Test-Path (Join-Path $appDir ".git")) {
        Write-Step "Reusing existing checkout: $appDir"
        Invoke-External -FilePath "git" -Arguments @("-C", $appDir, "fetch", "--tags", "origin") -FailureMessage "git fetch failed" -SuppressStderr
        Invoke-External -FilePath "git" -Arguments @("-C", $appDir, "checkout", $Branch)         -FailureMessage "git checkout failed" -SuppressStderr
        Invoke-External -FilePath "git" -Arguments @("-C", $appDir, "pull", "--ff-only", "origin", $Branch) -FailureMessage "git pull failed" -SuppressStderr
    }
    elseif (Test-Path $appDir) {
        throw "Install app directory exists but is not a git checkout: $appDir"
    }
    else {
        Write-Step "Cloning $RepoUrl ($Branch)"
        Invoke-External -FilePath "git" -Arguments @("clone", "--depth", "1", "--branch", $Branch, $RepoUrl, $appDir) -FailureMessage "git clone failed" -SuppressStderr
    }

    $appVersion = Get-AppVersion -RepoRoot $appDir
    Write-Step "Detected app version: $appVersion"

    Write-Step "Building frontend"
    Push-Location $frontendDir
    try {
        Invoke-External -FilePath "npm.cmd" -Arguments @("ci")       -FailureMessage "npm ci failed" -SuppressStderr
        Invoke-External -FilePath "npm.cmd" -Arguments @("run", "build") -FailureMessage "npm build failed" -SuppressStderr
    }
    finally { Pop-Location }

    Write-Step "Building backend"
    Push-Location $backendDir
    try {
        Invoke-External -FilePath "go" -Arguments @("build", "-buildvcs=false", "-o", "kissdash-go.exe", ".") -FailureMessage "go build failed"
    }
    finally { Pop-Location }

    $launcherContent = @"
@echo off
setlocal
set "DASH_BIND=$Bind"
set "DASH_PORT=$Port"
set "DASH_DATA_DIR=$resolvedDataDir"
set "DASH_PRIVATE_ICONS_DIR=$privateIconsDir"
set "DASH_DEFAULT_CONFIG=$defaultConfig"
set "DASH_APP_ROOT=$appRoot"
cd /d "$backendDir"
"$backendExe"
"@
    Set-Content -Path $launcherPath -Value $launcherContent -Encoding Ascii

    if (-not (Test-PathIsLocalhost -Address $Bind)) {
        $ruleName = "KISS Startpage ($Port)"
        $existingRule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
        if ($null -eq $existingRule) {
            Write-Step "Creating firewall rule for TCP port $Port"
            New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort $Port | Out-Null
        }
    }

    if ($NoService) {
        Write-Step "Starting app in this console (Ctrl+C to stop)"
        & $launcherPath
    }
    else {
        $cmdExe        = Join-Path $env:SystemRoot "System32\cmd.exe"
        $appParameters = "/c `"$launcherPath`""

        $existingService = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
        if ($null -eq $existingService) {
            Write-Step "Installing Windows service: $ServiceName"
            Invoke-External -FilePath "nssm" -Arguments @("install", $ServiceName, $cmdExe, $appParameters) -FailureMessage "nssm install failed"
        }
        else {
            Write-Step "Updating existing service: $ServiceName"
            try { Stop-Service -Name $ServiceName -Force -ErrorAction Stop }
            catch { Write-Step "Service was not running; continuing" }
        }

        Invoke-External -FilePath "nssm" -Arguments @("set", $ServiceName, "Application",   $cmdExe)        -FailureMessage "nssm set Application failed"
        Invoke-External -FilePath "nssm" -Arguments @("set", $ServiceName, "AppParameters", $appParameters)  -FailureMessage "nssm set AppParameters failed"
        Invoke-External -FilePath "nssm" -Arguments @("set", $ServiceName, "AppDirectory",  $backendDir)     -FailureMessage "nssm set AppDirectory failed"
        Invoke-External -FilePath "nssm" -Arguments @("set", $ServiceName, "DisplayName",   "KISS Startpage API") -FailureMessage "nssm set DisplayName failed"
        Invoke-External -FilePath "nssm" -Arguments @("set", $ServiceName, "Description",   "KISS Startpage web service") -FailureMessage "nssm set Description failed"

        $startType = if ($NoAutoStart) { "SERVICE_DEMAND_START" } else { "SERVICE_AUTO_START" }
        Invoke-External -FilePath "nssm" -Arguments @("set", $ServiceName, "Start", $startType) -FailureMessage "nssm set Start failed"

        Write-Step "Starting service"
        Start-Service -Name $ServiceName

        $healthy = Wait-ForHealth -HealthPort $Port
        $ip = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
            Where-Object { $_.IPAddress -ne "127.0.0.1" -and $_.IPAddress -notlike "169.254.*" } |
            Select-Object -First 1 -ExpandProperty IPAddress)
        if ([string]::IsNullOrWhiteSpace($ip)) { $ip = "127.0.0.1" }

        # ── Uninstaller ──────────────────────────────────────────────────────────
        Write-Step "Writing uninstaller"
        $uninstallerContent = @"
# KISS Startpage Uninstaller — generated by installer v$appVersion
param([switch]`$KeepData)

`$ErrorActionPreference = 'Continue'
`$ServiceName  = '$ServiceName'
`$InstallRoot  = '$resolvedInstallRoot'
`$DataDir      = '$resolvedDataDir'
`$StartMenuDir = '$startMenuDir'
`$FirewallRule = 'KISS Startpage ($Port)'
`$RegPath      = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\KissStartpage'

`$identity  = [Security.Principal.WindowsIdentity]::GetCurrent()
`$principal = New-Object Security.Principal.WindowsPrincipal(`$identity)
if (-not `$principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host 'Requesting administrator privileges...'
    `$args = "-NoProfile -ExecutionPolicy Bypass -File \`"`$(`$MyInvocation.MyCommand.Path)\`""
    if (`$KeepData) { `$args += " -KeepData" }
    Start-Process powershell.exe -ArgumentList `$args -Verb RunAs
    exit
}

try {

Write-Host '[uninstall] Stopping and removing service...'
`$svc = Get-Service -Name `$ServiceName -ErrorAction SilentlyContinue
if (`$null -ne `$svc) {
    Stop-Service -Name `$ServiceName -Force -ErrorAction SilentlyContinue
    & nssm remove `$ServiceName confirm
}

Write-Host '[uninstall] Removing firewall rule...'
Remove-NetFirewallRule -DisplayName `$FirewallRule -ErrorAction SilentlyContinue

Write-Host '[uninstall] Removing Start Menu shortcuts...'
if (Test-Path `$StartMenuDir) { Remove-Item -Recurse -Force `$StartMenuDir }

Write-Host '[uninstall] Removing registry entry...'
if (Test-Path `$RegPath) { Remove-Item -Path `$RegPath -Recurse -Force }

Write-Host '[uninstall] Removing app files...'
`$appPath = Join-Path `$InstallRoot 'app'
if (Test-Path `$appPath) { Remove-Item -Recurse -Force `$appPath }
`$launcher = Join-Path `$InstallRoot 'run-kiss-startpage.cmd'
if (Test-Path `$launcher) { Remove-Item -Force `$launcher }

if (-not `$KeepData) {
    `$answer = Read-Host "Delete data at `$DataDir? This removes your config and icons. (y/N)"
    if (`$answer -match '^[Yy]') {
        Write-Host '[uninstall] Removing data...'
        if (Test-Path `$DataDir) { Remove-Item -Recurse -Force `$DataDir }
        `$iconsDir = Join-Path `$InstallRoot 'private-icons'
        if (Test-Path `$iconsDir) { Remove-Item -Recurse -Force `$iconsDir }
    } else {
        Write-Host "[uninstall] Data kept at: `$DataDir"
    }
}

try {
    if ((Get-ChildItem `$InstallRoot -Force -ErrorAction SilentlyContinue | Measure-Object).Count -eq 0) {
        Remove-Item -Force `$InstallRoot -ErrorAction SilentlyContinue
    }
} catch {}

Remove-Item -LiteralPath `$MyInvocation.MyCommand.Path -Force -ErrorAction SilentlyContinue
Write-Host 'KISS Startpage uninstalled.'
Write-Host ''
Write-Host 'The following tools were installed as dependencies:'
Write-Host '  Git     - version control, used to clone and update the app'
Write-Host '  Node.js - JavaScript runtime, used to build the frontend'
Write-Host '  Go      - programming language, used to build the backend'
Write-Host '  NSSM    - Windows service manager, used to run the app as a service'
Write-Host ''

`$deps = @(
    @{ Name = 'Git';     Id = 'Git.Git';           Desc = 'version control tool' },
    @{ Name = 'Node.js'; Id = 'OpenJS.NodeJS.LTS'; Desc = 'JavaScript runtime' },
    @{ Name = 'Go';      Id = 'GoLang.Go';          Desc = 'programming language runtime' },
    @{ Name = 'NSSM';    Id = 'NSSM.NSSM';          Desc = 'Windows service manager' }
)

`$kept = @()
foreach (`$dep in `$deps) {
    `$answer = Read-Host "Remove `$(`$dep.Name) (`$(`$dep.Desc))? (y/N)"
    if (`$answer -match '^[Yy]') {
        Write-Host "Removing `$(`$dep.Name)..."
        & winget uninstall --id `$dep.Id --exact --silent 2>`$null
    } else {
        `$kept += `$dep.Name
    }
}

if (`$kept.Count -gt 0) {
    Write-Host ''
    Write-Host "Kept: `$(`$kept -join ', '). You can remove them manually via:"
    Write-Host '  Settings > Apps  -or-  winget uninstall --id <PackageId>'
    Write-Host '  IDs: Git.Git  /  OpenJS.NodeJS.LTS  /  GoLang.Go  /  NSSM.NSSM'
}

} catch {
    Write-Host ''
    Write-Host "UNINSTALL ERROR: `$_" -ForegroundColor Red
    Write-Host ''
}

Write-Host ''
Write-Host 'Press any key to close...' -NoNewline
`$null = [Console]::ReadKey(`$true)
"@
        Set-Content -Path $uninstallerPath -Value $uninstallerContent -Encoding UTF8

        # ── Start Menu ───────────────────────────────────────────────────────────
        Write-Step "Creating Start Menu shortcuts"
        New-Item -ItemType Directory -Path $startMenuDir -Force | Out-Null
        $displayHost = if (Test-PathIsLocalhost -Address $Bind) { "127.0.0.1" } else { $ip }
        New-UrlShortcut -Path (Join-Path $startMenuDir "KISS Startpage.url") -Url "http://${displayHost}:${Port}/"
        $uninstallLnk = Join-Path $startMenuDir "Uninstall KISS Startpage.lnk"
        New-LnkShortcut -Path $uninstallLnk `
            -Target "powershell.exe" `
            -Arguments "-NoProfile -ExecutionPolicy Bypass -File `"$uninstallerPath`"" `
            -Description "Uninstall KISS Startpage"
        # Set Run as Administrator flag on the shortcut
        $lnkBytes = [System.IO.File]::ReadAllBytes($uninstallLnk)
        $lnkBytes[0x15] = $lnkBytes[0x15] -bor 0x20
        [System.IO.File]::WriteAllBytes($uninstallLnk, $lnkBytes)"

        # ── Add / Remove Programs ────────────────────────────────────────────────
        Write-Step "Registering in Programs and Features"
        $regPath = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\KissStartpage"
        New-Item -Path $regPath -Force | Out-Null
        Set-ItemProperty -Path $regPath -Name "DisplayName"     -Value "KISS Startpage"
        Set-ItemProperty -Path $regPath -Name "DisplayVersion"  -Value $appVersion
        Set-ItemProperty -Path $regPath -Name "Publisher"       -Value "spinninghypercube"
        Set-ItemProperty -Path $regPath -Name "InstallLocation" -Value $resolvedInstallRoot
        Set-ItemProperty -Path $regPath -Name "UninstallString" -Value "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$uninstallerPath`""
        Set-ItemProperty -Path $regPath -Name "NoModify"        -Value 1 -Type DWord
        Set-ItemProperty -Path $regPath -Name "NoRepair"        -Value 1 -Type DWord

        # ── Summary ──────────────────────────────────────────────────────────────
        Write-Host ""
        Write-Host "Install complete."
        Write-Host "App version:  $appVersion"
        Write-Host ""
        Write-Host "Open (this PC only, always works):  http://127.0.0.1:$Port/"
        Write-Host "Open (local network, dynamic IP):   http://${ip}:$Port/"
        Write-Host "  Note: the network IP above depends on DHCP and may change."
        Write-Host "  For a stable network URL, set a static IP on this machine."
        Write-Host ""
        Write-Host "Service:      $ServiceName"
        if ($NoAutoStart) { Write-Host "Auto-start:   disabled (start manually: Start-Service $ServiceName)" }
        Write-Host "Install root: $resolvedInstallRoot"
        Write-Host "Data dir:     $resolvedDataDir"
        Write-Host "Uninstall:    Settings > Apps, or Start Menu > KISS Startpage > Uninstall"
        if (-not $healthy) { Write-Host "WARNING: health check timed out — verify with: nssm status $ServiceName" }
    }


} catch {
    Write-Host ""
    Write-Host "INSTALL FAILED: $_" -ForegroundColor Red
    Write-Host ""
} finally {
    Write-Host ""
    Write-Host "Press any key to close..." -NoNewline
    $null = [Console]::ReadKey($true)
}
