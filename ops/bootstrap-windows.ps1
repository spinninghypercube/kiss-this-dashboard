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
    [switch]$NoService
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

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
        [string]$FailureMessage = ""
    )

    & $FilePath @Arguments
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
        "install",
        "--id", $PackageId,
        "--exact",
        "--accept-package-agreements",
        "--accept-source-agreements",
        "--silent"
    ) -FailureMessage "Failed to install $DisplayName"
}

function Ensure-Command {
    param(
        [Parameter(Mandatory = $true)][string]$Command,
        [Parameter(Mandatory = $true)][string]$PackageId,
        [Parameter(Mandatory = $true)][string]$DisplayName
    )

    if (Get-Command $Command -ErrorAction SilentlyContinue) {
        return
    }

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
        catch {
            Start-Sleep -Seconds 1
        }
    }
    return $false
}

function Get-AppVersion {
    param([Parameter(Mandatory = $true)][string]$RepoRoot)

    $mainGo = Join-Path $RepoRoot "backend-go\main.go"
    if (-not (Test-Path $mainGo)) {
        throw "Unable to detect app version: missing $mainGo"
    }

    $raw = Get-Content -Path $mainGo -Raw
    $match = [regex]::Match($raw, 'appVersion\s*=\s*"([^"]+)"')
    if (-not $match.Success) {
        throw "Unable to detect app version in backend-go/main.go"
    }
    return $match.Groups[1].Value
}

if ($env:OS -ne "Windows_NT") {
    throw "This installer only supports Windows."
}

if ($Port -lt 1 -or $Port -gt 65535) {
    throw "Invalid --Port value: $Port"
}

if (-not (Test-IsWindowsAdmin)) {
    throw "Run PowerShell as Administrator before starting this installer."
}

Refresh-Path

Write-Step "Checking required tools"
Ensure-Command -Command "git" -PackageId "Git.Git" -DisplayName "Git"
Ensure-Command -Command "node" -PackageId "OpenJS.NodeJS.LTS" -DisplayName "Node.js LTS"
Ensure-Command -Command "npm" -PackageId "OpenJS.NodeJS.LTS" -DisplayName "Node.js LTS"
Ensure-Command -Command "go" -PackageId "GoLang.Go" -DisplayName "Go"
if (-not $NoService) {
    Ensure-Command -Command "nssm" -PackageId "NSSM.NSSM" -DisplayName "NSSM"
}

$resolvedInstallRoot = [System.IO.Path]::GetFullPath($InstallRoot)
$appDir = Join-Path $resolvedInstallRoot "app"
if ([string]::IsNullOrWhiteSpace($DataDir)) {
    $resolvedDataDir = Join-Path $resolvedInstallRoot "data"
}
else {
    $resolvedDataDir = [System.IO.Path]::GetFullPath($DataDir)
}
$privateIconsDir = Join-Path $resolvedInstallRoot "private-icons"

$frontendDir = Join-Path $appDir "frontend-svelte"
$backendDir = Join-Path $appDir "backend-go"
$backendExe = Join-Path $backendDir "kissdash-go.exe"
$appRoot = Join-Path $frontendDir "dist"
$defaultConfig = Join-Path $appDir "startpage-default-config.json"
$launcherPath = Join-Path $resolvedInstallRoot "run-kiss-startpage.cmd"

Write-Step "Preparing install directories"
New-Item -ItemType Directory -Path $resolvedInstallRoot -Force | Out-Null
New-Item -ItemType Directory -Path $resolvedDataDir -Force | Out-Null
New-Item -ItemType Directory -Path $privateIconsDir -Force | Out-Null

if (Test-Path (Join-Path $appDir ".git")) {
    Write-Step "Reusing existing checkout: $appDir"
    Invoke-External -FilePath "git" -Arguments @("-C", $appDir, "fetch", "--tags", "origin") -FailureMessage "git fetch failed"
    Invoke-External -FilePath "git" -Arguments @("-C", $appDir, "checkout", $Branch) -FailureMessage "git checkout failed"
    Invoke-External -FilePath "git" -Arguments @("-C", $appDir, "pull", "--ff-only", "origin", $Branch) -FailureMessage "git pull failed"
}
elseif (Test-Path $appDir) {
    throw "Install app directory exists but is not a git checkout: $appDir"
}
else {
    Write-Step "Cloning $RepoUrl ($Branch)"
    Invoke-External -FilePath "git" -Arguments @("clone", "--depth", "1", "--branch", $Branch, $RepoUrl, $appDir) -FailureMessage "git clone failed"
}

$appVersion = Get-AppVersion -RepoRoot $appDir
Write-Step "Detected app version: $appVersion"

Write-Step "Building frontend"
Push-Location $frontendDir
try {
    Invoke-External -FilePath "npm" -Arguments @("ci") -FailureMessage "npm ci failed"
    Invoke-External -FilePath "npm" -Arguments @("run", "build") -FailureMessage "npm build failed"
}
finally {
    Pop-Location
}

Write-Step "Building backend"
Push-Location $backendDir
try {
    Invoke-External -FilePath "go" -Arguments @("build", "-buildvcs=false", "-o", "kissdash-go.exe", ".") -FailureMessage "go build failed"
}
finally {
    Pop-Location
}

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
    exit 0
}

$cmdExe = Join-Path $env:SystemRoot "System32\cmd.exe"
$appParameters = "/c `"$launcherPath`""

$existingService = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($null -eq $existingService) {
    Write-Step "Installing Windows service: $ServiceName"
    Invoke-External -FilePath "nssm" -Arguments @("install", $ServiceName, $cmdExe, $appParameters) -FailureMessage "nssm install failed"
}
else {
    Write-Step "Updating existing service: $ServiceName"
    try {
        Stop-Service -Name $ServiceName -Force -ErrorAction Stop
    }
    catch {
        Write-Step "Service was not running; continuing"
    }
}

Invoke-External -FilePath "nssm" -Arguments @("set", $ServiceName, "Application", $cmdExe) -FailureMessage "nssm set Application failed"
Invoke-External -FilePath "nssm" -Arguments @("set", $ServiceName, "AppParameters", $appParameters) -FailureMessage "nssm set AppParameters failed"
Invoke-External -FilePath "nssm" -Arguments @("set", $ServiceName, "AppDirectory", $backendDir) -FailureMessage "nssm set AppDirectory failed"
Invoke-External -FilePath "nssm" -Arguments @("set", $ServiceName, "DisplayName", "KISS Startpage API") -FailureMessage "nssm set DisplayName failed"
Invoke-External -FilePath "nssm" -Arguments @("set", $ServiceName, "Description", "KISS Startpage web service") -FailureMessage "nssm set Description failed"
Invoke-External -FilePath "nssm" -Arguments @("set", $ServiceName, "Start", "SERVICE_AUTO_START") -FailureMessage "nssm set Start failed"

Write-Step "Starting service"
Start-Service -Name $ServiceName

$healthy = Wait-ForHealth -HealthPort $Port
$ip = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -ne "127.0.0.1" -and $_.IPAddress -notlike "169.254.*" } |
    Select-Object -First 1 -ExpandProperty IPAddress)
if ([string]::IsNullOrWhiteSpace($ip)) {
    $ip = "127.0.0.1"
}

Write-Host ""
Write-Host "One Shot Install (Windows) complete."
Write-Host "App version: $appVersion"
if (Test-PathIsLocalhost -Address $Bind) {
    Write-Host "Backend bind: $Bind (local-only)"
    Write-Host "Open via your reverse proxy URL, or local URL below."
}
Write-Host "Open:  http://${ip}:$Port/"
Write-Host "Edit:  http://${ip}:$Port/edit"
Write-Host "Service: $ServiceName"
Write-Host "Install root: $resolvedInstallRoot"
Write-Host "Data dir: $resolvedDataDir"
if (-not $healthy) {
    Write-Host "Health endpoint check timed out. Verify service logs with: nssm status $ServiceName"
}
