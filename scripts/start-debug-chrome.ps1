param(
  [string]$Url = "",
  [int]$Port = 9222,
  [switch]$KeepExistingChrome
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($Url)) {
  $Url = "https://12345.gsdmsj.cn/?bypass=1&cacheBust=$([DateTimeOffset]::Now.ToUnixTimeMilliseconds())"
}

$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
if (!(Test-Path -LiteralPath $chrome)) {
  $chrome = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
}
if (!(Test-Path -LiteralPath $chrome)) {
  throw "Chrome executable not found."
}

$profile = Join-Path $env:LOCALAPPDATA "Google\Chrome\User Data Codex Debug"
$codexExtension = Join-Path $env:LOCALAPPDATA "Codex\ChromeExtensions\Codex"

if (!(Test-Path -LiteralPath $codexExtension)) {
  throw "Codex unpacked Chrome extension is missing: $codexExtension"
}

if (!$KeepExistingChrome) {
  Get-Process chrome -ErrorAction SilentlyContinue | Stop-Process -Force
  Start-Sleep -Seconds 2
}

$args = @(
  "--remote-debugging-address=127.0.0.1",
  "--remote-debugging-port=$Port",
  "--user-data-dir=$profile",
  "--load-extension=$codexExtension",
  "--disable-background-timer-throttling",
  "--disable-renderer-backgrounding",
  "--disable-backgrounding-occluded-windows",
  "--no-first-run",
  "--new-window",
  $Url
)

Start-Process -FilePath $chrome -ArgumentList $args
Start-Sleep -Seconds 3

$version = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/json/version" -TimeoutSec 8
[pscustomobject]@{
  ok = $true
  port = $Port
  url = $Url
  browser = $version.Browser
  protocolVersion = $version.'Protocol-Version'
  webSocketDebuggerUrl = $version.webSocketDebuggerUrl
} | ConvertTo-Json -Depth 4
