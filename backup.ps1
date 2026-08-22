# backup.ps1 - make a verifiable, self-contained backup of this archive.
#
# Why this exists, and why it matters more than it looks like it should:
#
# Only three of the 43 files in public/data can be regenerated from anything in
# this repository - models.json, paint.json and factoryOptions.json, by the
# extract_*.js / extract_fastop.ps1 scripts. The forty fast_*.json files, 33 MB
# holding all 1,284,067 records, have NO generator here. Nothing in version
# control reads VINDAT or performs the MDLCODE join, the columnar packing or the
# dictionary encoding; database.js only describes that provenance in comments.
#
# So this repository is not merely the deployment. It is the only copy of the
# database, and it could not be rebuilt from the FAST discs either, because the
# program that read them is gone. Treat it accordingly.
#
# What this produces:
#   bpzilla-<stamp>.bundle   a git bundle - the COMPLETE history in one file.
#                            Restore with: git clone bpzilla-<stamp>.bundle
#   bpzilla-<stamp>.sha256   SHA-256 of the bundle and of every data file, so a
#                            copy can be proven intact years later.
#   bpzilla-<stamp>.txt      what was backed up, from which commit, and how to
#                            restore it, in plain text next to the data.
#
# A bundle is used rather than a zip because it carries every commit, branch and
# tag, verifies itself, and clones back into a working repository. A zip of the
# working tree would lose the history and with it the reasoning - which, for an
# archive assembled by inference, is a substantial part of the value.
#
# NOTE: keep this file ASCII-only. Windows PowerShell 5.1 reads .ps1 as ANSI
# unless there is a BOM, so a stray em-dash becomes a parse error.

param(
  # Default to a sibling of the repo so the backup is never inside the thing it
  # is backing up, and never accidentally committed.
  [string]$Destination = (Join-Path (Split-Path $PSScriptRoot -Parent) 'bpzilla-backups')
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

# ---- refuse to back up a working tree that does not match a commit ----------
# A backup of uncommitted work is a backup of something no commit describes,
# which defeats the point of bundling history.
$dirty = git status --porcelain
if ($dirty) {
  Write-Host "Working tree has uncommitted changes:" -ForegroundColor Yellow
  $dirty | ForEach-Object { Write-Host "  $_" }
  throw "Commit or stash first. A bundle only captures committed history."
}

if (-not (Test-Path $Destination)) { New-Item -ItemType Directory -Path $Destination | Out-Null }

$stamp   = Get-Date -Format 'yyyyMMdd-HHmmss'
$commit  = (git rev-parse HEAD).Trim()
$short   = $commit.Substring(0,7)
$subject = (git log -1 --pretty=%s).Trim()
$base    = Join-Path $Destination "bpzilla-$stamp"
$bundle  = "$base.bundle"

# ---- the bundle: every branch, every tag, all history -----------------------
Write-Host "Bundling full history..." -ForegroundColor Cyan
git bundle create $bundle --all
git bundle verify $bundle | Out-Null
Write-Host "  verified OK" -ForegroundColor Green

# ---- checksums: the bundle, and each data file individually -----------------
# Per-file hashes as well as the bundle's, so a single corrupted JSON can be
# identified rather than only "something changed".
Write-Host "Hashing..." -ForegroundColor Cyan
$lines = New-Object System.Collections.ArrayList
[void]$lines.Add((Get-FileHash $bundle -Algorithm SHA256).Hash + "  " + (Split-Path $bundle -Leaf))
Get-ChildItem 'public/data' -File | Sort-Object Name | ForEach-Object {
  [void]$lines.Add((Get-FileHash $_.FullName -Algorithm SHA256).Hash + "  public/data/" + $_.Name)
}
$lines | Set-Content "$base.sha256" -Encoding utf8

# ---- a plain-text record that outlives any tooling --------------------------
$dataCount  = (Get-ChildItem 'public/data' -File).Count
$dataSize   = '{0:N1} MB' -f ((Get-ChildItem 'public/data' -File | Measure-Object Length -Sum).Sum / 1MB)
$bundleSize = '{0:N1} MB' -f ((Get-Item $bundle).Length / 1MB)

$report = @"
BPZILLA ARCHIVE BACKUP
======================
Taken      : $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
Commit     : $commit
Subject    : $subject
Bundle     : bpzilla-$stamp.bundle  ($bundleSize)
Data files : $dataCount files, $dataSize

WHAT THIS IS
This bundle contains the complete git history of bpzilla.com, including the
forty fast_*.json files holding all 1,284,067 Nissan FAST records. Those files
cannot be regenerated: no extractor for them exists in the repository, and the
FAST discs alone are not enough without one. This is the only copy.

RESTORE
  git clone bpzilla-$stamp.bundle bpzilla
  cd bpzilla
  git log --oneline -1          # should read $short

VERIFY
  Compare against bpzilla-$stamp.sha256 using:
    Get-FileHash <path> -Algorithm SHA256
  The first line is the bundle; the rest are the data files individually, so a
  single damaged JSON can be pinpointed rather than merely detected.

KEEP AT LEAST ONE COPY OFF THIS MACHINE.
"@
$report | Set-Content "$base.txt" -Encoding utf8

Write-Host ""
Write-Host "Backup written to $Destination" -ForegroundColor Green
Get-ChildItem "$base.*" | ForEach-Object {
  Write-Host ("  {0,-34} {1,8:N1} MB" -f $_.Name, ($_.Length / 1MB))
}
