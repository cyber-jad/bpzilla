Add-Type -AssemblyName System.Drawing

# Stats are read from models.json rather than typed in, because typed-in was
# exactly how these went stale before: this file, index.html and src/index.js
# all hardcoded the same three numbers separately, R31 added 285,676 records
# and 5 chassis, and none of the three updated. "Chassis" here is the count of
# distinct `stamp` values (the real chassis-code prefix, e.g. BNR34, HR31) -
# document the definition because there's more than one plausible one (a
# grade-split model like ER34_GT/ER34_GTT/HR34 all share one stamp, ER34).
$modelsPath = Join-Path $PSScriptRoot '..\public\data\models.json'
$modelsJson = Get-Content $modelsPath -Raw | ConvertFrom-Json
$total = $modelsJson.total
$modelObjs = $modelsJson.models.PSObject.Properties.Value
$chassisCount = ($modelObjs | ForEach-Object { $_.stamp } | Where-Object { $_ } | Select-Object -Unique).Count
$yearNums = $modelObjs | ForEach-Object { $_.years } | Where-Object { $_ } |
  ForEach-Object { [regex]::Matches($_, '\d{4}') } | ForEach-Object { [int]$_.Value }
$dateRange = "$(($yearNums | Measure-Object -Minimum).Minimum)-$(($yearNums | Measure-Object -Maximum).Maximum)"
$recordsFormatted = '{0:N0}' -f $total

$W = 1200; $H = 630
$bmp = New-Object System.Drawing.Bitmap($W, $H)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

function C([string]$hex) {
  return [System.Drawing.ColorTranslator]::FromHtml($hex)
}
function SB([string]$hex) {
  return New-Object System.Drawing.SolidBrush (C $hex)
}

# --- palette, taken from the site's own CSS custom properties
$paper    = '#f6f4f0'   # --bg-primary
$red      = '#bd1620'   # --gtr-red
$plateHi  = '#23262b'   # .brand-logo-badge.brand-gtr gradient start
$plateLo  = '#0b0d10'   # ...and end
$gtrR     = '#e6232a'   # .gtr-r  - Nissan's GT-R red
$ink      = '#1a1d21'
$muted    = '#5c636c'
$blue     = '#1c4f7c'   # --plate-blue
$rule     = '#e2ddd5'

$g.FillRectangle((SB $paper), 0, 0, $W, $H)
$g.FillRectangle((SB $red), 0, 0, $W, 10)

# --- the plate badge -------------------------------------------------------
$px = 80; $py = 92; $pw = 452; $ph = 120; $r = 14
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$path.AddArc($px, $py, 2*$r, 2*$r, 180, 90)
$path.AddArc($px + $pw - 2*$r, $py, 2*$r, 2*$r, 270, 90)
$path.AddArc($px + $pw - 2*$r, $py + $ph - 2*$r, 2*$r, 2*$r, 0, 90)
$path.AddArc($px, $py + $ph - 2*$r, 2*$r, 2*$r, 90, 90)
$path.CloseFigure()

$grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  (New-Object System.Drawing.Point($px, $py)),
  (New-Object System.Drawing.Point(($px + $pw), ($py + $ph))),
  (C $plateHi), (C $plateLo))
$g.FillPath($grad, $path)
$g.DrawPath((New-Object System.Drawing.Pen((C '#000000'), 2)), $path)

# plate contents: rivet | GT + R | REGISTRY | rivet, measured then centred
$fEmblem = New-Object System.Drawing.Font('Arial', 40, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$fTag    = New-Object System.Drawing.Font('Arial', 30, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$fmt = [System.Drawing.StringFormat]::GenericTypographic

$wGT  = $g.MeasureString('GT', $fEmblem, 1000, $fmt).Width
$wR   = $g.MeasureString('R',  $fEmblem, 1000, $fmt).Width
$wTag = $g.MeasureString('REGISTRY', $fTag, 1000, $fmt).Width
$rivet = 11; $gapRivet = 22; $gapTag = 16
$groupW = $rivet + $gapRivet + $wGT + $wR + $gapTag + $wTag + $gapRivet + $rivet
$cx = $px + ($pw - $groupW) / 2
$cyMid = $py + $ph / 2

$g.FillEllipse((SB '#c9ccd1'), $cx, ($cyMid - $rivet/2), $rivet, $rivet)
$x = $cx + $rivet + $gapRivet
$yEmblem = $cyMid - 26
$g.DrawString('GT', $fEmblem, (SB '#ffffff'), $x, $yEmblem, $fmt)
$x = $x + $wGT
$g.DrawString('R', $fEmblem, (SB $gtrR), $x, $yEmblem, $fmt)
$x = $x + $wR + $gapTag
$g.DrawString('REGISTRY', $fTag, (SB '#ffffff'), $x, ($cyMid - 19), $fmt)
$x = $x + $wTag + $gapRivet
$g.FillEllipse((SB '#c9ccd1'), $x, ($cyMid - $rivet/2), $rivet, $rivet)

# --- headline and standfirst ----------------------------------------------
$fHead = New-Object System.Drawing.Font('Arial', 62, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$fSub  = New-Object System.Drawing.Font('Arial', 27, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$g.DrawString('Nissan factory records', $fHead, (SB $ink), 78, 258, $fmt)
$g.DrawString('Every chassis number, build month, paint code and factory', $fSub, (SB $muted), 80, 348, $fmt)
$g.DrawString('model code held in the Nissan FAST microfiche.', $fSub, (SB $muted), 80, 388, $fmt)

# --- stats -----------------------------------------------------------------
$fNum = New-Object System.Drawing.Font('Consolas', 42, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$fLab = New-Object System.Drawing.Font('Arial', 17, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$stats = @(
  @{ n = $recordsFormatted; l = 'RECORDS' },
  @{ n = "$chassisCount";   l = 'CHASSIS' },
  @{ n = $dateRange;        l = 'BUILD DATES' }
)
$sx = 80.0
foreach ($s in $stats) {
  $g.DrawString($s.n, $fNum, (SB $blue), $sx, 468, $fmt)
  $g.DrawString($s.l, $fLab, (SB $muted), $sx, 522, $fmt)
  $wn = $g.MeasureString($s.n, $fNum, 1000, $fmt).Width
  $wl = $g.MeasureString($s.l, $fLab, 1000, $fmt).Width
  $step = [Math]::Max($wn, $wl) + 60
  $sx = $sx + $step
}

# --- footer ----------------------------------------------------------------
$g.DrawLine((New-Object System.Drawing.Pen((C $rule), 2)), 80, 566, ($W - 80), 566)
$fFoot = New-Object System.Drawing.Font('Arial', 20, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$g.DrawString([char]0x53 + 'kyline  ' + [char]0x00B7 + '  Silvia  ' + [char]0x00B7 + '  180SX  ' + [char]0x00B7 + '  Stagea  ' + [char]0x00B7 + '  300ZX',
              $fFoot, (SB $muted), 80, 585, $fmt)

$out = $args[0]
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Output ("wrote " + $out + " (" + [Math]::Round((Get-Item $out).Length / 1KB, 1) + " KB)")
