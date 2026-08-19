# Lightweight Local Static Web Server for GTR-Registry
$port = 5588
$root = $PSScriptRoot
if (-not $root) { $root = "C:\Users\cyber\.gemini\antigravity\scratch\gtr-registry" }
# Site files live in public/ — the only folder Cloudflare Workers Builds
# deploys from, so serving anything outside it locally would mask a file
# that's actually missing in production.
$path = Join-Path $root "public"

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
try {
    $listener.Start()
    Write-Host "========================================================" -ForegroundColor Cyan
    Write-Host " GTR-REGISTRY REVIVAL & JDM DATABASE IS RUNNING" -ForegroundColor Green
    Write-Host " URL: http://localhost:$port/" -ForegroundColor Yellow
    Write-Host " Press Ctrl+C in this terminal to stop the server." -ForegroundColor Gray
    Write-Host "========================================================" -ForegroundColor Cyan

    while ($listener.IsListening) {
        $context = $listener.GetContext()
        try {
            $request = $context.Request
            $response = $context.Response

            $localPath = $request.Url.LocalPath
            if ($localPath -eq "/" -or $localPath -eq "") { $localPath = "/index.html" }
            $filePath = Join-Path $path ($localPath.TrimStart("/").Replace("/", "\"))

            if (Test-Path $filePath -PathType Leaf) {
                $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
                $mime = "text/plain"
                switch ($ext) {
                    ".html" { $mime = "text/html; charset=utf-8" }
                    ".css"  { $mime = "text/css; charset=utf-8" }
                    ".js"   { $mime = "application/javascript; charset=utf-8" }
                    ".json" { $mime = "application/json; charset=utf-8" }
                    ".jpg"  { $mime = "image/jpeg" }
                    ".jpeg" { $mime = "image/jpeg" }
                    ".png"  { $mime = "image/png" }
                    ".svg"  { $mime = "image/svg+xml" }
                    ".ico"  { $mime = "image/x-icon" }
                }

                $response.ContentType = $mime
                $buffer = [System.IO.File]::ReadAllBytes($filePath)
                $response.ContentLength64 = $buffer.Length
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
            } else {
                $response.StatusCode = 404
                $buffer = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
            }
            $response.OutputStream.Close()
        } catch {
            # One bad request (client disconnect, locked file, etc.) must
            # never take the whole listener down.
            Write-Host "Request error: $_" -ForegroundColor Red
        }
    }
} finally {
    $listener.Stop()
    $listener.Close()
}
