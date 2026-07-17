param(
  [switch]$Serve,
  [int]$Port = 4324
)

$ErrorActionPreference = "Stop"

$ProjectRoot = $PSScriptRoot
if (-not $ProjectRoot) {
  $ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
}

$SiteRoot = Join-Path $ProjectRoot "dist"
$HostName = "127.0.0.1"
$Url = "http://${HostName}:$Port/index.html"

function Get-ContentType {
  param([string]$Path)

  switch ([System.IO.Path]::GetExtension($Path).ToLowerInvariant()) {
    ".css" { "text/css; charset=utf-8"; break }
    ".html" { "text/html; charset=utf-8"; break }
    ".ico" { "image/x-icon"; break }
    ".jpeg" { "image/jpeg"; break }
    ".jpg" { "image/jpeg"; break }
    ".js" { "application/javascript; charset=utf-8"; break }
    ".json" { "application/json; charset=utf-8"; break }
    ".png" { "image/png"; break }
    ".svg" { "image/svg+xml"; break }
    ".webp" { "image/webp"; break }
    ".woff" { "font/woff"; break }
    ".woff2" { "font/woff2"; break }
    default { "application/octet-stream" }
  }
}

function Send-Text {
  param(
    [System.Net.HttpListenerResponse]$Response,
    [int]$StatusCode,
    [string]$Text
  )

  $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
  $Response.StatusCode = $StatusCode
  $Response.ContentType = "text/plain; charset=utf-8"
  $Response.ContentLength64 = $bytes.Length
  $Response.OutputStream.Write($bytes, 0, $bytes.Length)
}

function Send-File {
  param(
    [System.Net.HttpListenerResponse]$Response,
    [string]$Path,
    [bool]$HeadersOnly = $false
  )

  $bytes = [System.IO.File]::ReadAllBytes($Path)
  $Response.StatusCode = 200
  $Response.ContentType = Get-ContentType -Path $Path
  $Response.ContentLength64 = $bytes.Length
  $Response.Headers["Cache-Control"] = "no-store"

  if (-not $HeadersOnly) {
    $Response.OutputStream.Write($bytes, 0, $bytes.Length)
  }
}

if ($Serve) {
  if (-not (Test-Path -LiteralPath $SiteRoot -PathType Container)) {
    throw "A dist mappa nem található: $SiteRoot"
  }

  $resolvedRoot = [System.IO.Path]::GetFullPath($SiteRoot)
  $listener = [System.Net.HttpListener]::new()
  $listener.Prefixes.Add("http://${HostName}:$Port/")
  $listener.Start()

  while ($listener.IsListening) {
    $context = $listener.GetContext()

    try {
      $requestPath = [System.Uri]::UnescapeDataString($context.Request.Url.AbsolutePath)
      if ($requestPath -eq "/" -or $requestPath.EndsWith("/")) {
        $requestPath = "${requestPath}index.html"
      }

      $relativePath = $requestPath.TrimStart("/").Replace("/", [System.IO.Path]::DirectorySeparatorChar)
      $filePath = [System.IO.Path]::GetFullPath((Join-Path $resolvedRoot $relativePath))

      if (-not $filePath.StartsWith($resolvedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        Send-Text -Response $context.Response -StatusCode 403 -Text "Forbidden"
      } elseif (-not (Test-Path -LiteralPath $filePath -PathType Leaf)) {
        Send-Text -Response $context.Response -StatusCode 404 -Text "Not found"
      } else {
        Send-File -Response $context.Response -Path $filePath -HeadersOnly ($context.Request.HttpMethod -eq "HEAD")
      }
    } catch {
      Send-Text -Response $context.Response -StatusCode 500 -Text "Server error"
    } finally {
      $context.Response.OutputStream.Close()
    }
  }

  return
}

if (-not (Test-Path -LiteralPath $SiteRoot -PathType Container)) {
  throw "A dist mappa nem található. Előbb szükséges a build futtatása: pnpm build"
}

$isRunning = $false
try {
  $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 1
  $isRunning = $response.StatusCode -lt 500 -and $response.Content -like "*Sacred Veil*"

  if (-not $isRunning -and $response.StatusCode -lt 500) {
    throw "A $Port port foglalt, de nem a Sacred Veil helyi oldalt szolgálja ki."
  }
} catch {
  if ($_.Exception.Message -like "*nem a Sacred Veil*") {
    throw
  }

  $isRunning = $false
}

if (-not $isRunning) {
  $scriptPath = $MyInvocation.MyCommand.Path
  $arguments = @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", "`"$scriptPath`"",
    "-Serve",
    "-Port", $Port
  )

  Start-Process -FilePath "powershell.exe" -ArgumentList $arguments -WorkingDirectory $ProjectRoot -WindowStyle Hidden
  Start-Sleep -Milliseconds 900
}

Start-Process $Url
