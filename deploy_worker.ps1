# ==========================================================================
# BPZILLA - CLOUDFLARE WORKER DEPLOY HELPER
#
# The live site is a Cloudflare Worker named "old-night-b2a3" (static
# assets, not Cloudflare Pages — deployment history confirmed this via
# `wrangler deployments list --name old-night-b2a3`). Same safety pattern
# as jdm-car-finder's deploy script: build a deploy_dist/ folder by
# explicitly copying only the files that should be public, rather than
# deploying the project root directly and risking .claude/, .git/, or the
# PowerShell dev scripts ending up served to visitors.
#
# Usage:  .\deploy_worker.ps1          (dry run by default)
#         .\deploy_worker.ps1 -Real    (actually deploys)
# ==========================================================================

param([switch]$Real)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$dist = Join-Path $root 'deploy_dist'

if (Test-Path $dist) { Remove-Item $dist -Recurse -Force }
New-Item -ItemType Directory -Path $dist | Out-Null

Write-Host "Building public deploy folder..." -ForegroundColor Cyan

$rootFiles = @(
    'index.html', '_headers', 'robots.txt', 'sitemap.xml',
    'favicon.ico', 'favicon-32.png', 'apple-touch-icon.png', 'icon-512.png',
    'og-image.png'
)
foreach ($f in $rootFiles) {
    $src = Join-Path $root $f
    if (Test-Path $src) { Copy-Item $src $dist }
    else { Write-Warning "missing $f (skipped)" }
}

foreach ($dir in @('css', 'js', 'data', 'assets')) {
    Copy-Item (Join-Path $root $dir) (Join-Path $dist $dir) -Recurse
}

$fileCount = (Get-ChildItem $dist -Recurse -File).Count
$totalBytes = (Get-ChildItem $dist -Recurse -File | Measure-Object -Property Length -Sum).Sum
Write-Host ("Deploy folder ready: {0} files, {1:N1} MB" -f $fileCount, ($totalBytes / 1MB)) -ForegroundColor Cyan

Set-Location $root
if ($Real) {
    Write-Host "Deploying to Cloudflare Worker 'old-night-b2a3'..." -ForegroundColor Yellow
    npx wrangler deploy --name=old-night-b2a3 --assets=$dist --compatibility-date=2026-08-19
} else {
    Write-Host "Dry run (pass -Real to actually deploy)..." -ForegroundColor Yellow
    npx wrangler deploy --name=old-night-b2a3 --assets=$dist --compatibility-date=2026-08-19 --dry-run
}
