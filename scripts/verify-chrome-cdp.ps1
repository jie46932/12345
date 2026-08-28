param(
  [string]$Url = "",
  [int]$Port = 9222,
  [int]$TimeoutSeconds = 45,
  [switch]$ReuseExistingTarget
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($Url)) {
  $Url = "https://hefurniture.gsdmsj.cn/?bypass=1&cacheBust=$([DateTimeOffset]::Now.ToUnixTimeMilliseconds())"
}

function ConvertFrom-CdpJson([string]$Text) {
  if ([string]::IsNullOrWhiteSpace($Text)) { return $null }
  return $Text | ConvertFrom-Json -Depth 64
}

function Send-CdpCommand {
  param(
    [System.Net.WebSockets.ClientWebSocket]$Socket,
    [int]$Id,
    [string]$Method,
    [hashtable]$Params = @{}
  )

  $payload = @{
    id = $Id
    method = $Method
    params = $Params
  } | ConvertTo-Json -Depth 64 -Compress

  $bytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
  $segment = [ArraySegment[byte]]::new($bytes)
  $Socket.SendAsync($segment, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, [Threading.CancellationToken]::None).GetAwaiter().GetResult() | Out-Null
}

function Receive-CdpMessage {
  param(
    [System.Net.WebSockets.ClientWebSocket]$Socket,
    [int]$TimeoutMilliseconds = 10000
  )

  $buffer = New-Object byte[] 1048576
  $segment = [ArraySegment[byte]]::new($buffer)
  $cts = [Threading.CancellationTokenSource]::new($TimeoutMilliseconds)
  $builder = [System.Text.StringBuilder]::new()

  do {
    $result = $Socket.ReceiveAsync($segment, $cts.Token).GetAwaiter().GetResult()
    if ($result.MessageType -eq [System.Net.WebSockets.WebSocketMessageType]::Close) {
      return $null
    }
    $chunk = [System.Text.Encoding]::UTF8.GetString($buffer, 0, $result.Count)
    [void]$builder.Append($chunk)
  } while (!$result.EndOfMessage)

  $message = ConvertFrom-CdpJson $builder.ToString()
  if ($message -and !$message.id) {
    $script:CdpEvents.Add($message) | Out-Null
  }
  return $message
}

function Wait-CdpResponse {
  param(
    [System.Net.WebSockets.ClientWebSocket]$Socket,
    [int]$Id,
    [int]$TimeoutMilliseconds = 15000
  )

  $deadline = [DateTime]::UtcNow.AddMilliseconds($TimeoutMilliseconds)
  while ([DateTime]::UtcNow -lt $deadline) {
    $remaining = [Math]::Max(500, [int]($deadline - [DateTime]::UtcNow).TotalMilliseconds)
    $message = Receive-CdpMessage -Socket $Socket -TimeoutMilliseconds $remaining
    if ($null -eq $message) { continue }
    if ($message.id -eq $Id) { return $message }
  }
  throw "Timed out waiting for CDP response id=$Id"
}

$target = $null
if ($ReuseExistingTarget) {
  $tabs = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/json" -TimeoutSec 8
  $target = $tabs |
    Where-Object { $_.type -eq "page" -and $_.url -like "https://hefurniture.gsdmsj.cn*" } |
    Select-Object -First 1
}

if (!$target) {
  $encoded = [uri]::EscapeDataString($Url)
  $target = Invoke-RestMethod -Method Put -Uri "http://127.0.0.1:$Port/json/new?$encoded" -TimeoutSec 8
}

if (!$target.webSocketDebuggerUrl) {
  throw "No page target with webSocketDebuggerUrl found on port $Port."
}

$socket = [System.Net.WebSockets.ClientWebSocket]::new()
$socket.ConnectAsync([Uri]$target.webSocketDebuggerUrl, [Threading.CancellationToken]::None).GetAwaiter().GetResult() | Out-Null

try {
  $script:CdpEvents = [System.Collections.Generic.List[object]]::new()
  $id = 1
  Send-CdpCommand $socket $id "Page.enable"; Wait-CdpResponse $socket $id | Out-Null
  $id++
  Send-CdpCommand $socket $id "Runtime.enable"; Wait-CdpResponse $socket $id | Out-Null
  $id++
  Send-CdpCommand $socket $id "Log.enable"; Wait-CdpResponse $socket $id | Out-Null
  $id++
  Send-CdpCommand $socket $id "Network.enable"; Wait-CdpResponse $socket $id | Out-Null
  $id++
  Send-CdpCommand $socket $id "Page.bringToFront"; Wait-CdpResponse $socket $id | Out-Null
  $id++
  Send-CdpCommand $socket $id "Page.navigate" @{ url = $Url }; Wait-CdpResponse $socket $id | Out-Null
  $id++
  Send-CdpCommand $socket $id "Page.bringToFront"; Wait-CdpResponse $socket $id | Out-Null
  $script:CdpEvents.Clear()

  Start-Sleep -Seconds 1
  $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
  $last = $null
  $script = @"
(async () => {
  await new Promise(r => setTimeout(r, 8000));
  const allResources = performance.getEntriesByType('resource').map(r => ({
    name: r.name,
    initiatorType: r.initiatorType,
    transferSize: r.transferSize,
    decodedBodySize: r.decodedBodySize
  }));
  const canvases = Array.from(document.querySelectorAll('canvas')).map((canvas, index) => ({
    index,
    id: canvas.id || '',
    className: String(canvas.className || ''),
    width: canvas.width,
    height: canvas.height,
    clientWidth: canvas.clientWidth,
    clientHeight: canvas.clientHeight
  }));
  const r3f = document.querySelector('#r3f-canvas');
  const resources = allResources.map(r => r.name).filter(n => n.includes('/assets/'));
  const mediaResources = allResources.map(r => r.name).filter(n => n.includes('/media/') || n.includes('/basis_transcoder/'));
  return {
    url: location.href,
    readyState: document.readyState,
    loadingText: document.body.innerText.includes('92%'),
    bodyText: document.body.innerText.slice(0, 1200),
    sceneReady: document.documentElement.dataset.viewerSceneReady,
    envReady: document.documentElement.dataset.viewerEnvReady,
    meshCount: document.documentElement.dataset.viewerMeshCount,
    rendererMode: document.documentElement.dataset.viewerRenderer,
    canvasCount: document.querySelectorAll('canvas').length,
    canvases,
    r3fExists: !!r3f,
    r3fRect: r3f ? (() => { const rect = r3f.getBoundingClientRect(); return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }; })() : null,
    rootChildCount: document.querySelector('#root')?.children.length ?? null,
    loginVisible: document.body.innerText.includes('访问验证') || document.body.innerText.includes('请选择登录方式'),
    threeScene: !!window.__threeScene,
    renderer: !!window.__threeRenderer,
    resources,
    mediaResources
  };
})()
"@

  while ([DateTime]::UtcNow -lt $deadline) {
    $id++
    Send-CdpCommand $socket $id "Runtime.evaluate" @{
      expression = $script
      awaitPromise = $true
      returnByValue = $true
    }
    $response = Wait-CdpResponse $socket $id 25000
    $last = $response.result.result.value
    if (
      $last.readyState -eq "complete" -and
      $last.loadingText -eq $false -and
      $last.sceneReady -eq "true" -and
      [int]$last.meshCount -gt 0 -and
      [int]$last.canvasCount -ge 1 -and
      $last.threeScene -eq $true
    ) {
      break
    }
    Start-Sleep -Seconds 2
  }

  $expectedBundle = "index-f_BDLFdQ.js"
  $distIndex = Join-Path (Split-Path -Parent $PSScriptRoot) "dist/index.html"
  if (Test-Path -LiteralPath $distIndex) {
    $indexHtml = Get-Content -LiteralPath $distIndex -Raw
    $match = [regex]::Match($indexHtml, 'assets/(index-[^"''>]+\.js)')
    if ($match.Success) {
      $expectedBundle = $match.Groups[1].Value
    }
  }
  $oldBundle = "index-DhY7TrT0.js"
  $resourceText = ($last.resources -join "`n")
  $result = [pscustomobject]@{
    ok = (
      $last.loadingText -eq $false -and
      $last.sceneReady -eq "true" -and
      [int]$last.meshCount -gt 0 -and
      $last.threeScene -eq $true -and
      $resourceText.Contains($expectedBundle) -and
      !$resourceText.Contains($oldBundle)
    )
    expectedBundle = $expectedBundle
    oldBundlePresent = $resourceText.Contains($oldBundle)
    state = $last
    console = @(
      $script:CdpEvents |
        Where-Object {
          $_.method -in @(
            "Runtime.exceptionThrown",
            "Log.entryAdded",
            "Runtime.consoleAPICalled",
            "Network.requestWillBeSent",
            "Network.responseReceived",
            "Network.loadingFailed",
            "Network.loadingFinished"
          )
        } |
        Where-Object {
          $eventText = ($_ | ConvertTo-Json -Depth 8 -Compress)
          $eventText -match "12345\\.gltf|12345\\.bin|basis_transcoder|Texture|S8S|useModel|AudioContext|exception|error|failed"
        } |
        Select-Object -Last 120
    )
  }

  $result | ConvertTo-Json -Depth 64
}
finally {
  $socket.Dispose()
}
