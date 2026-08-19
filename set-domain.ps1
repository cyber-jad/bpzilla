# Sets the site's public address everywhere it appears.
# Run once after you register the domain, before deploying:
#
#   .\set-domain.ps1 gtr.blue
#
param([Parameter(Mandatory=$true)][string]$Domain)

$Domain = $Domain -replace '^https?://', '' -replace '/$', ''
$files = @('index.html', 'robots.txt', 'sitemap.xml')
$root = $PSScriptRoot
if (-not $root) { $root = '.' }

$total = 0
foreach ($f in $files) {
    $path = Join-Path $root $f
    if (-not (Test-Path $path)) { Write-Warning "missing $f"; continue }
    $text = Get-Content $path -Raw
    $hits = ([regex]::Matches($text, 'SITE_URL')).Count
    if ($hits -eq 0) { Write-Host "$f - already set"; continue }
    ($text -replace 'SITE_URL', $Domain) | Set-Content $path -NoNewline -Encoding UTF8
    Write-Host "$f - $hits replaced"
    $total += $hits
}
Write-Host ""
Write-Host "Done. $total references now point at https://$Domain/" -ForegroundColor Green
