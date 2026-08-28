param(
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

function Require-Env($Name) {
  $Value = [Environment]::GetEnvironmentVariable($Name, "Process")
  if ([string]::IsNullOrWhiteSpace($Value)) {
    $Value = [Environment]::GetEnvironmentVariable($Name, "User")
  }
  if ([string]::IsNullOrWhiteSpace($Value)) {
    $Value = [Environment]::GetEnvironmentVariable($Name, "Machine")
  }
  if ([string]::IsNullOrWhiteSpace($Value)) {
    throw "Missing required environment variable: $Name"
  }
  return $Value
}

function Get-Env($Name, $Default = "") {
  $Value = [Environment]::GetEnvironmentVariable($Name, "Process")
  if ([string]::IsNullOrWhiteSpace($Value)) {
    $Value = [Environment]::GetEnvironmentVariable($Name, "User")
  }
  if ([string]::IsNullOrWhiteSpace($Value)) {
    $Value = [Environment]::GetEnvironmentVariable($Name, "Machine")
  }
  if ([string]::IsNullOrWhiteSpace($Value)) { return $Default }
  return $Value
}

function Assert-SafeRemotePath($Path) {
  $Trimmed = $Path.Trim()
  if ($Trimmed -eq "/" -or $Trimmed -eq "." -or $Trimmed -eq "~" -or $Trimmed.Length -lt 8) {
    throw "Refusing to deploy to unsafe DEPLOY_PATH: $Path"
  }
  if ($Trimmed -notmatch "^/") {
    throw "DEPLOY_PATH must be an absolute Linux path: $Path"
  }
}

$Root = Split-Path -Parent $PSScriptRoot
$Dist = Join-Path $Root "dist"
$DeployHost = Require-Env "DEPLOY_HOST"
$DeployUser = Require-Env "DEPLOY_USER"
$DeployPath = Require-Env "DEPLOY_PATH"
$DeployPort = Get-Env "DEPLOY_PORT" "22"
$DeployIdentity = Get-Env "DEPLOY_IDENTITY" ""

Assert-SafeRemotePath $DeployPath

if (-not $SkipBuild) {
  Push-Location $Root
  try {
    npm run lint
    npm run predeploy:safe
  } finally {
    Pop-Location
  }
}

if (-not (Test-Path -LiteralPath (Join-Path $Dist "index.html"))) {
  throw "dist/index.html not found. Run npm run build first."
}

$Timestamp = Get-Date -Format "yyyyMMddHHmmss"
$Archive = Join-Path $env:TEMP "12345-dist-$Timestamp.tar.gz"
$RemoteArchive = "/tmp/12345-dist-$Timestamp.tar.gz"
$RemoteScript = Join-Path $env:TEMP "12345-deploy-$Timestamp.sh"
$RemoteScriptPath = "/tmp/12345-deploy-$Timestamp.sh"
$Target = "${DeployUser}@${DeployHost}"

if (Test-Path -LiteralPath $Archive) {
  Remove-Item -LiteralPath $Archive -Force
}
if (Test-Path -LiteralPath $RemoteScript) {
  Remove-Item -LiteralPath $RemoteScript -Force
}

Push-Location $Dist
try {
  tar -czf $Archive .
} finally {
  Pop-Location
}

$SshArgs = @("-p", $DeployPort)
$ScpArgs = @("-P", $DeployPort)
if ($DeployIdentity) {
  $SshArgs += @("-i", $DeployIdentity)
  $ScpArgs += @("-i", $DeployIdentity)
}

Write-Host "[deploy-server] uploading dist archive to ${Target}:$RemoteArchive"
scp @ScpArgs $Archive "${Target}:${RemoteArchive}"

$RemoteCommand = @"
set -e
mkdir -p '$DeployPath'
rm -rf '$DeployPath'/*
rm -rf '$DeployPath'/.[!.]* '$DeployPath'/..?* 2>/dev/null || true
tar -xzf '$RemoteArchive' -C '$DeployPath'
rm -f '$RemoteArchive'
rm -f '$RemoteScriptPath'
find '$DeployPath' -maxdepth 3 \( -name '.env' -o -name '.git' -o -name 'node_modules' -o -name 'dist_prev' -o -name 'dist_temp' -o -name '_archive' -o -name '_recycle' -o -name '*.max' -o -name '*.zip' -o -name '*.pem' -o -name '*.key' \) -print -quit | grep -q . && exit 17 || true
"@
[System.IO.File]::WriteAllText(
  $RemoteScript,
  ($RemoteCommand -replace "`r`n", "`n"),
  [System.Text.UTF8Encoding]::new($false)
)

Write-Host "[deploy-server] extracting archive into $DeployPath"
scp @ScpArgs $RemoteScript "${Target}:${RemoteScriptPath}"
ssh @SshArgs $Target "bash '$RemoteScriptPath'"

Remove-Item -LiteralPath $Archive -Force
Remove-Item -LiteralPath $RemoteScript -Force
Write-Host "[deploy-server] deployed dist to ${DeployHost}:${DeployPath}"
