# backup.ps1 - make a verifiable, self-contained backup of this archive.
#
# Why this exists, and why it matters more than it looks like it should:
#
# public/data holds 46 files, 34 MB, of which 43 are the fast_*.json record
# exports carrying all 1,357,633 Nissan FAST records.
#
# This used to say those files had no generator anywhere and could never be
# rebuilt. That is no longer true, and the change is worth stating plainly:
# extract_vindat.js now reads VINDAT directly, performs the MDLCODE join and
# writes the exports, and it proves itself by re-deriving eleven chassis the
# site already shipped and reproducing them exactly.
#
# What has NOT changed is why this backup matters. The extractor needs the FAST
# discs mounted at H: to produce anything at all. Without them the repository is
# still the only copy of the database - and it is the only copy of the decoding
# work regardless, since no disc contains the option legends as this site reads
# them, the paint corrections, or the reasoning in the commit history.
#
# So: the data could now be rebuilt by someone holding both this repository AND
# the discs. It cannot be rebuilt from either one alone. Treat it accordingly.
#
# OFF-MACHINE COPY
# A private GitLab mirror is the off-site half of this, and a bundle on a local
# disk is not a backup by itself. Configure it once:
#
#   git remote add gitlab https://gitlab.com/jdm-imports-group/gtr-registry.git
#   git push gitlab master
#
# and thereafter push both: git push origin master; git push gitlab master
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
43 fast_*.json files holding all 1,357,633 Nissan FAST records. Those files
can only be regenerated by extract_vindat.js WITH the FAST discs mounted at H:.
Without the discs this bundle is the only copy; without this repository the
discs are only raw binaries. Neither half is sufficient alone.

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
The private GitLab mirror is the off-site half:
  git push gitlab master
"@
$report | Set-Content "$base.txt" -Encoding utf8

Write-Host ""
Write-Host "Backup written to $Destination" -ForegroundColor Green
Get-ChildItem "$base.*" | ForEach-Object {
  Write-Host ("  {0,-34} {1,8:N1} MB" -f $_.Name, ($_.Length / 1MB))
}
