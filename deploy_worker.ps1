# ==========================================================================
# BPZILLA - CLOUDFLARE WORKER DEPLOY HELPER (manual/local deploy)
#
# The live site is a Cloudflare Worker named "old-night-b2a3" (static
# assets, not Cloudflare Pages). Since the site's public files live in
# their own public/ folder (nothing else does), there's no need to build a
# separate deploy_dist copy any more — public/ IS the deploy target.
#
# This script is for deploying by hand from your own machine. Once GitHub
# auto-deploy (Workers Builds) is connected, most changes won't need this —
# a normal `git push` deploys on its own.
#
# Usage:  .\deploy_worker.ps1          (dry run by default)
#         .\deploy_worker.ps1 -Real    (actually deploys)
# ==========================================================================

param([switch]$Real)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$public = Join-Path $root 'public'

$fileCount = (Get-ChildItem $public -Recurse -File).Count
$totalBytes = (Get-ChildItem $public -Recurse -File | Measure-Object -Property Length -Sum).Sum
Write-Host ("public/ ready: {0} files, {1:N1} MB" -f $fileCount, ($totalBytes / 1MB)) -ForegroundColor Cyan

Set-Location $root
if ($Real) {
    Write-Host "Deploying to Cloudflare Worker 'old-night-b2a3'..." -ForegroundColor Yellow
    npx wrangler deploy --name=old-night-b2a3 --assets=$public --compatibility-date=2026-08-19
} else {
    Write-Host "Dry run (pass -Real to actually deploy)..." -ForegroundColor Yellow
    npx wrangler deploy --name=old-night-b2a3 --assets=$public --compatibility-date=2026-08-19 --dry-run
}
