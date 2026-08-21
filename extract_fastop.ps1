# extract_fastop.ps1 — Generate public/data/factoryOptions.json from Nissan's
# own FASTOP option-definition table (H:\AR-JP\JP\FASTOP).
#
# FASTOP is the FAST system's per-chassis decode table for the 5-character
# factory-option block at the end of each model code (build-plate positions
# 13-17 = our exported mc positions 12-16; the plate carries one extra
# leading body-style character the export drops). Each 63-byte record:
#   [0-5]   chassis    ("R33   ", "R34   ", "S14   ", "WC34  ")
#   [6-9]   from YYMM  (validity window start, e.g. 9308)
#   [10-13] to YYMM    (validity window end,   e.g. 9501)
#   [14-18] pattern    (5 chars, one letter + '*' wildcards -> which of the
#                       five option positions this record defines)
#   [19]    seq        (1-3; long descriptions continue across records)
#   [20-55] desc       (36 bytes Shift-JIS)
#   [56-59] flag       ("AB" on airbag-equipped combos; redundant, dropped)
#   [60-62] padding
#
# Letters are REDEFINED across date windows (R33 has five), so the output
# keeps every window and the site matches on build date. Descriptions are
# translated with the phrase map below; the build fails loudly if any
# non-ASCII residue survives, so an untranslated term can never slip onto
# the site silently.

$ErrorActionPreference = "Stop"
$src = "H:\AR-JP\JP\FASTOP"
$out = Join-Path $PSScriptRoot "public\data\factoryOptions.json"
$chassisWanted = @("R33", "R34", "S14", "WC34")

$bytes = [System.IO.File]::ReadAllBytes($src)
$sjis  = [System.Text.Encoding]::GetEncoding(932)
$ascii = [System.Text.Encoding]::ASCII
$text  = $ascii.GetString($bytes)

# ---- collect + merge continuation records --------------------------------
$rx = [regex]'([A-Z][A-Z0-9 ]{5})(\d{4})(\d{4})([A-Z0-9*\-]{5})(\d)'
$merged = [ordered]@{}   # "chassis|from|to|pattern" -> concatenated ja desc
foreach ($m in $rx.Matches($text)) {
  $chassis = $m.Groups[1].Value.Trim()
  if ($chassis -notin $chassisWanted) { continue }
  $key  = "$chassis|$($m.Groups[2].Value)|$($m.Groups[3].Value)|$($m.Groups[4].Value)"
  $desc = $sjis.GetString($bytes, $m.Index + 20, 36).TrimEnd("`0", " ")
  if ($merged.Contains($key)) { $merged[$key] = $merged[$key] + $desc } else { $merged[$key] = $desc }
}
Write-Host "merged option definitions: $($merged.Count)"

# ---- zenkaku -> ascii normalisation --------------------------------------
function Normalize([string]$s) {
  $sb = New-Object System.Text.StringBuilder
  foreach ($ch in $s.ToCharArray()) {
    $c = [int]$ch
    if ($c -ge 0xFF01 -and $c -le 0xFF5E) { [void]$sb.Append([char]($c - 0xFEE0)) }  # fullwidth ASCII
    elseif ($ch -eq [char]0x3000) { [void]$sb.Append(' ') }                          # ideographic space
    else { [void]$sb.Append($ch) }
  }
  $sb.ToString()
}

# ---- phrase translation map (applied longest-first) ----------------------
$map = @(
  @('リヤ中央３点式ベルト', 'rear center 3-point seatbelt'),
  @('ﾘﾔ中央３点式ﾍﾞﾙﾄ', 'rear center 3-point seatbelt'),
  @('ﾘﾔ中央3点式ﾍﾞﾙﾄ', 'rear center 3-point seatbelt'),
  @('ﾘﾔ中央３Ｐﾍﾞﾙﾄ', 'rear center 3-point seatbelt'),
  @('ﾘﾔ中央3Pﾍﾞﾙﾄ', 'rear center 3-point seatbelt'),
  @('ｸﾞﾛｰﾌﾞﾎﾞｯｸｽﾗｲﾄ', 'glovebox light'),
  @('Gﾎﾞｯｸｽﾗｲﾄ', 'glovebox light'),
  @('本革ｽﾃｱﾘﾝｸﾞPKBﾉﾌﾞ,ｼﾌﾄﾉﾌﾞ', 'leather steering wheel, handbrake and shift knobs'),
  @('本革ｽﾃｱﾘﾝｸﾞ', 'leather steering wheel'),
  @('革巻ｽﾃｱﾘﾝｸﾞ', 'leather-wrapped steering wheel'),
  @('ｽﾎﾟｰﾂﾀｲﾌﾟｽﾃｱﾘﾝｸﾞﾚｽ', 'sport steering wheel delete'),
  @('ｳﾚﾀﾝｽﾃｱﾘﾝｸﾞｼﾖｳ', 'urethane steering wheel'),
  @('ｳﾚﾀﾝｽﾃｱﾘﾝｸﾞ', 'urethane steering wheel'),
  @('ﾘﾓｰﾄｺﾝﾄﾛｰﾙｴﾝﾄﾘｰｼｽﾃﾑ', 'remote-control entry'),
  @('ﾘﾓ-ﾄｺﾝﾄﾛ-ﾙｴﾝﾄﾘ-ｼｽﾃﾑ', 'remote-control entry'),
  @('ﾘﾓｰﾄｺﾝﾄﾛｰﾙｼｽﾃﾑ', 'remote-control entry'),
  @('ﾘﾓｺﾝｴﾝﾄﾘｰ', 'remote-control entry'),
  @('ｷｰﾚｽｴﾝﾄﾘｰ', 'keyless entry'),
  @('ﾄﾗﾝｸﾘｯﾄﾞﾄﾘﾑ', 'trunk lid trim'),
  @('ｵｰﾄﾗｲﾄ', 'auto headlights'),
  @('運転席ﾊﾞﾆﾃｨﾐﾗｰ', 'driver vanity mirror'),
  @('DRﾊﾞﾆﾃｨｰﾐﾗｰ', 'driver vanity mirror'),
  @('FRｽﾄﾗｯﾄﾀﾜｰﾊﾞｰ', 'front and rear strut tower bars'),
  @('ﾘﾔｽﾄﾗｯﾄﾀﾜｰﾊﾞｰ', 'rear strut tower bar'),
  @('ﾏﾙﾁﾃﾞｨｽﾌﾟﾚｲﾒｰﾀｰ', 'multi-function display'),
  @('ｱﾄﾞﾊﾞﾝｽﾄﾞｴｱﾛｼｽﾃﾑ', 'advanced aero system'),
  @('GTR/N1ｼﾖｳ', 'GT-R N1 specification'),
  @('GTRN1仕様', 'GT-R N1 specification'),
  @('N1仕様', 'N1 specification'),
  @('ﾋﾞｽｶｽLSD', 'viscous LSD'),
  @('ﾘﾔﾍﾘｶﾙLSD', 'rear helical LSD'),
  @('ﾘﾔﾋﾞｽｶｽLSD', 'rear viscous LSD'),
  @('LSD(ﾘﾐﾃｯﾄﾞｽﾘｯﾌﾟﾃﾞﾌ)', 'limited-slip differential'),
  @('LSD(ﾘﾐﾃｯｯﾄﾞｽﾘｯﾌﾟﾃﾞﾌ)', 'limited-slip differential'),
  @('ｻｲﾄﾞｴｱﾊﾞｯｸﾞ', 'side airbags'),
  @('ｻｲﾄﾞｴｱﾊﾞｯｸ', 'side airbags'),
  @('運転席/助手席ｴｱﾊﾞｯｸﾞ', 'driver and passenger airbags'),
  @('運転席+助手席ｴｱﾊﾞｯｸﾞ', 'driver and passenger airbags'),
  @('運転席･助手席ｴｱﾊﾞｯｸﾞ', 'driver and passenger airbags'),
  @('運転席ｴｱﾊﾞｯｸﾞ', 'driver airbag'),
  @('助手席ｴｱﾊﾞｯｸﾞ', 'passenger airbag'),
  @('助手席ｴｱﾊﾞｯｸ', 'passenger airbag'),
  @('ﾘﾔﾌｫｸﾞﾗﾝﾌﾟ', 'rear fog lamp'),
  @('ﾌｪﾝﾀﾞｰﾐﾗｰ', 'fender mirrors'),
  @('ﾘﾔﾜｲﾊﾟｰ', 'rear wiper'),
  @('2速無段断間欠ﾜｲﾊﾟｰ', '2-speed variable intermittent wipers'),
  @('2速無段間欠ﾜｲﾊﾟｰ', '2-speed variable intermittent wipers'),
  @('無段間欠ﾜｲﾊﾟｰ', 'variable intermittent wipers'),
  @('UVｶｯﾄ断熱ｸﾞﾘｰﾝｶﾞﾗｽ', 'UV-cut insulated green glass'),
  @('UVｶｯﾄ断熱ｶﾞﾗｽ', 'UV-cut insulated glass'),
  @('ﾌﾟﾗｲﾊﾞｼｰｶﾞﾗｽ', 'privacy glass'),
  @('ﾛﾝｸﾞﾗｲﾌ撥水ｶﾞﾗｽ', 'long-life water-repellent glass'),
  @('ｷｾﾉﾝﾍｯﾄﾞﾗﾝﾌﾟ', 'xenon headlamps'),
  @('ﾘﾔｰｽﾎﾟｲﾗｰ2ﾄﾞｱ用', 'rear spoiler (2-door)'),
  @('ﾘﾔｰｽﾎﾟｲﾗｰ4ﾄﾞｱ用', 'rear spoiler (4-door)'),
  @('ﾘﾔｽﾎﾟｲﾗｰ2ﾄﾞｱ用', 'rear spoiler (2-door)'),
  @('ﾘﾔｽﾎﾟｲﾗｰ4ﾄﾞｱ用', 'rear spoiler (4-door)'),
  @('ﾘﾔｽﾎﾟｲﾗｰ(標準ﾀｲﾌﾟ)', 'rear spoiler (standard type)'),
  @('ﾊｲﾏｳﾝﾄｽﾄｯﾌﾟﾗﾝﾌﾟ付ﾘﾔｽﾎﾟｲﾗｰ', 'rear spoiler with high-mount stop lamp'),
  @('ﾊｲﾏｳﾝﾄ付ﾘﾔｽﾎﾟ', 'rear spoiler with high-mount stop lamp'),
  @('ｶｰﾎﾞﾝ水平翼付ﾘﾔｽﾎﾟｲﾗｰ', 'rear spoiler with carbon horizontal wing'),
  @('大型ﾘﾔｽﾎﾟｲﾗｰｴｱﾛﾌｫﾙﾑﾊﾞﾝﾊﾟｰ(ｴｱﾛﾊﾟｯｹｰｼﾞ)', 'large rear spoiler and aero-form bumper (aero package)'),
  @('大型ﾘﾔｽﾎﾟｲﾗｰ', 'large rear spoiler'),
  @('大型ﾌﾛﾝﾄｽﾎﾟｲﾗｰ(Vｽﾍﾟｯｸ用)', 'large front spoiler (V-Spec type)'),
  @('大型ﾌﾛﾝﾄｽﾎﾟｲﾗｰ', 'large front spoiler'),
  @('GTｵｰﾄｽﾎﾟｲﾗｰ&ﾘﾔｽﾎﾟｲﾗｰ', 'GT auto spoiler and rear spoiler'),
  @('GTｵｰﾄｽﾎﾟｲﾗｰ', 'GT auto spoiler'),
  @('ﾘﾔｽﾎﾟｲﾗｰ', 'rear spoiler'),
  @('ｴｱｽﾎﾟｲﾗｰ無し', 'air spoiler delete'),
  @('ｴｱｽﾎﾟｲﾗｰ', 'air spoiler'),
  @('ｽｰﾊﾟｰﾌｧｲﾝｺｰﾄ(ﾌｯ素塗装)', 'Super Fine Coat (fluorine paint)'),
  @('ｽｰﾊﾟｰﾌｧｲﾝｺｰﾃｨﾝｸﾞ', 'Super Fine Coat paint'),
  @('ｽｰﾊﾟｰﾌｧｲﾝｺｰﾄ', 'Super Fine Coat paint'),
  @('ｽｰﾊﾟｰﾌｧｲｺｰﾄ', 'Super Fine Coat paint'),
  @('ｽｰﾊﾟｰﾌｧｲﾝﾊｰﾄﾞｺｰﾄ', 'Super Fine Hard Coat paint'),
  @('ｽｰﾊﾟｰﾊｰﾄﾞｺｰﾄ', 'Super Hard Coat paint'),
  @('SFC', 'Super Fine Coat paint'),
  @('ﾌｯ素樹脂塗装', 'fluorine resin paint'),
  @('電動ｶﾞﾗｽﾂｲﾝｽﾗｲﾄﾞｻﾝﾙｰﾌ', 'electric twin-slide glass sunroof'),
  @('電動ｶﾞﾗｽｻﾝﾙｰﾌ', 'electric glass sunroof'),
  @('ｻﾝﾙｰﾌ', 'sunroof'),
  @('16ｲﾝﾁ鍛造ｱﾙﾐﾎｲｰﾙ', '16-inch forged alloy wheels'),
  @('15ｲﾝﾁｱﾙﾐﾛｰﾄﾞﾎｲｰﾙ(ｷｰ付)', '15-inch alloy wheels (with lock keys)'),
  @('15ｲﾝﾁｱﾙﾐﾛｰﾄﾞﾎｲｰﾙ(ｷｰ無し)', '15-inch alloy wheels (without lock keys)'),
  @('15ｲﾝﾁｽﾁｰﾙﾛｰﾄﾞﾎｲｰﾙ', '15-inch steel wheels'),
  @('16ｲﾝﾁｱﾙﾐﾛｰﾄﾞﾎｲｰﾙ', '16-inch alloy wheels'),
  @('15ｲﾝﾁｱﾙﾐﾎｲｰﾙ', '15-inch alloy wheels'),
  @('16ｲﾝﾁｱﾙﾐﾎｲｰﾙ', '16-inch alloy wheels'),
  @('205/60R15ﾀｲﾔ&15ｲﾝﾁｱﾙﾐﾎｲｰﾙ', '205/60R15 tires and 15-inch alloy wheels'),
  @('205/60R15ﾀｲﾔ&15ｲﾝﾁｱﾙﾐ', '205/60R15 tires and 15-inch alloy wheels'),
  @('205 R15ﾀｲﾔ', '205R15 tires'),
  @('205R15ﾀｲﾔ', '205R15 tires'),
  @('15ｲﾝﾁﾀｲﾔ', '15-inch tires'),
  @('ｱﾙﾐﾎｲｰﾙ', 'alloy wheels'),
  @('ﾌﾙｶﾊﾞｰ', 'full wheel covers'),
  @('ﾀｲﾔ', 'tires'),
  @('ﾐｯﾄﾞﾅｲﾄﾊﾟｰﾌﾟﾙ III 仕様', 'Midnight Purple III edition'),
  @('LMﾘﾐﾃｯﾄﾞ仕様', 'LM Limited edition'),
  @('ﾎﾜｲﾄｴｱﾛｾﾚｸｼｮﾝ仕様', 'White Aero Selection edition'),
  @('(ｴｱﾛｾﾚｸｼｮﾝ)', '(Aero Selection)'),
  @('ｴｱﾛﾌｫﾙﾑﾊﾞﾝﾊﾟｰ', 'aero-form bumper'),
  @('ｴｱｲﾝﾃｰｸ付ﾌﾛﾝﾄﾊﾞﾝﾊﾟｰ', 'front bumper with air intakes'),
  @('ﾌﾛﾝﾄｴｱﾛﾊﾞﾝﾊﾟｰ', 'front aero bumper'),
  @('ﾌｰﾄﾞﾄｯﾌﾟﾓｰﾙ', 'hood top molding'),
  @('ｽﾎﾟｰﾂｸﾞﾘﾙ', 'sports grille'),
  @('ﾘﾐﾃｯﾄﾞ仕様', 'Limited edition'),
  @('ﾌﾟﾗｲﾑｴﾃﾞｨｼｮﾝ(NA系)', 'Prime Edition (NA models)'),
  @('ﾌﾟﾗｲﾑｴﾃﾞｨｼｮﾝ･ﾀｰﾎﾞ系', 'Prime Edition turbo models'),
  @('ｱｰﾊﾞﾝﾗﾝﾅｰS', 'Urban Runner S'),
  @('NAVIｴﾃﾞｨｼｮﾝ', 'Navi Edition'),
  @('TV機能+1DIN+120W6SP+ﾅﾋﾞ', 'TV + single-DIN stereo + 120W amp, 6 speakers + navigation'),
  @('TV機能+1DIN+200W8SP+ﾅﾋﾞ', 'TV + single-DIN stereo + 200W amp, 8 speakers + navigation'),
  @('2DINｵｰﾃﾞｨｵ6SP', '2-DIN audio, 6 speakers'),
  @('2DINｵｰﾃﾞｨｵ', '2-DIN audio'),
  @('2DIN8SP', '2-DIN audio, 8 speakers'),
  @('2DIN CD 6ｽﾋﾟｰｶｰ', '2-DIN CD audio, 6 speakers'),
  @('ｵｰﾃﾞｨｵﾚｽ仕様', 'no audio (stereo delete)'),
  @('ｵｰﾃﾞｨｵﾚｽ', 'no audio (stereo delete)'),
  @('ｹﾝｳｯﾄﾞｻｳﾝﾄﾞｸﾙｰｼﾞﾝｸﾞｼｽﾃﾑﾀｲﾌﾟCD', 'Kenwood Sound Cruising System (CD type)'),
  @('ｹﾝｳｯﾄﾞｻｳﾝﾄﾞｸﾙｰｼﾞﾝｸﾞｼｽﾃﾑ(8ｽﾋﾟｰｶｰ)', 'Kenwood Sound Cruising System (8 speakers)'),
  @('ｹﾝｳｯﾄﾞｻｳﾝﾄﾞｸﾙｰｼﾞﾝｸﾞｼｽﾃﾑ', 'Kenwood Sound Cruising System'),
  @('ｽｶｲﾗｲﾝｽｰﾊﾟｰｻｳﾝﾄﾞｼｽﾃﾑII', 'Skyline Super Sound System II'),
  @('ｽｶｲﾗｲﾝｽｰﾊﾟｰｻｳﾝﾄﾞｼｽﾃﾑ(6SP)', 'Skyline Super Sound System (6 speakers)'),
  @('ｽｶｲﾗｲﾝｻｳﾝﾄﾞｼｽﾃﾑ', 'Skyline Sound System'),
  @('ｽｰﾊﾟｰｻｳﾝﾄﾞｼｽﾃﾑ', 'Super Sound System'),
  @('CDｵｰﾄﾁｪﾝｼﾞｬｰ', 'CD auto-changer'),
  @('MD一体AM/FMﾗｼﾞｵ', 'integrated MD AM/FM radio'),
  @('MDﾌﾟﾚｰﾔｰ', 'MD player'),
  @('ｶｾｯﾄ一体型AM/FMﾗｼﾞｵ', 'integrated cassette AM/FM radio'),
  @('ﾀﾞｲﾊﾞｰｼﾃｨﾚｽ標準ｵｰﾃﾞｨｵ', 'standard audio (no diversity antenna)'),
  @('ｺﾝﾋﾞｽﾃﾚｵ', 'combination stereo'),
  @('AVｼｽﾃﾑ', 'AV system'),
  @('ﾅﾋﾞｹﾞｰｼｮﾝｼｽﾃﾑ+100Vｲﾝﾊﾞｰﾀｰ', 'navigation system + 100V inverter'),
  @('ﾎﾜｲﾄﾒｰﾀｰ', 'white gauges'),
  @('ﾌﾛﾝﾄｳｲﾝﾄﾞｳﾃﾞｨｽﾌﾟﾚｲ', 'front window display'),
  @('ｲﾙﾐﾈｰｼｮﾝｺﾝﾄﾛｰﾙ', 'illumination control'),
  @('ｽﾎﾟｯﾄﾗﾝﾌﾟ', 'spot lamp'),
  @('ｺｰﾅﾘﾝｸﾞﾗﾝﾌﾟ', 'cornering lamps'),
  @('ｺ-ﾅﾘﾝｸﾞﾗﾝﾌﾟ', 'cornering lamps'),
  @('ﾌﾛﾝﾄﾌｫｸﾞﾗﾝﾌﾟ', 'front fog lamps'),
  @('ASCD', 'cruise control (ASCD)'),
  @('ｴｱｺﾝﾚｽ', 'air conditioning delete'),
  @('ﾏﾆｭｱﾙｴｱｺﾝ', 'manual air conditioning'),
  @('ｵｰﾄｴｱｺﾝ', 'automatic climate control'),
  @('ｴｸｾｰﾇｼｰﾄ', 'Excene suede seats'),
  @('ｽﾎﾟｰﾂﾀｲﾌﾟｼｰﾄ', 'sports seats'),
  @('ｽﾎﾟｰﾂｼｰﾄ', 'sports seats'),
  @('ﾄﾘｺｯﾄｼｰﾄｼﾖｳ', 'tricot seat fabric'),
  @('ﾄﾘｺｯﾄｼｰﾄ', 'tricot seat fabric'),
  @('黒ｸﾞﾚｰｼｰﾄ地', 'black/gray seat fabric'),
  @('本皮ｻﾌﾟﾗｰﾚｺﾝﾋﾞｼｰﾄ', 'leather/Suplare combination seats'),
  @('本革ｻﾌﾟﾗｰﾚｺﾝﾋﾞｼｰﾄ', 'leather/Suplare combination seats'),
  @('両席ﾊﾟﾜｰｼｰﾄ', 'dual power seats'),
  @('ﾂｰﾄﾝWﾗｯｾﾙｼﾖｳ', 'two-tone double-raschel upholstery'),
  @('本木目ｺﾝｿｰﾙ', 'real wood console'),
  @('ｴｷｿﾞｰｽﾄﾌｨﾆｯｼｬｰ', 'exhaust finisher'),
  @('ﾃﾞｭｱﾙﾓｰﾄﾞﾏﾌﾗｰ', 'dual-mode muffler'),
  @('ﾒｯｷｲﾝｻｲﾄﾞﾄﾞｱﾊﾝﾄﾞﾙﾚｽ', 'chrome inside door handle delete'),
  @('ﾒｯｷﾄﾞｱﾊﾝﾄﾞﾙﾚｽ(樹脂色)', 'chrome door handle delete (resin color)'),
  @('ﾒｯｷﾄﾞｱﾊﾝﾄﾞﾚｽ(樹脂色)', 'chrome door handle delete (resin color)'),
  @('ｽﾎﾟｰﾂﾀｲﾌﾟｼﾌﾄﾉﾌﾞ(AT車)', 'sport shift knob (AT)'),
  @('(AT車)', ' (AT)'),
  @('(MT車)', ' (MT)'),
  @('GTS25TﾀｲﾌﾟM(ﾘﾔﾜｲﾊﾟｰ付き)', 'GTS25t Type M (with rear wiper)'),
  @('GTS25TﾀｲﾌﾟM1(4ﾄﾞｱ)', 'GTS25t Type M1 (4-door)'),
  @('GTS25TﾀｲﾌﾟM2(4ﾄﾞｱ)', 'GTS25t Type M2 (4-door)'),
  @('GTS25TﾀｲﾌﾟM2(2ﾄﾞｱ)', 'GTS25t Type M2 (2-door)'),
  @('GTS25TﾀｲﾌﾟM', 'GTS25t Type M'),
  @('GTS25ﾀｲﾌﾟS/S(4ﾄﾞｱ)', 'GTS25 Type S/S (4-door)'),
  @('GTS25ﾀｲﾌﾟS(2ﾄﾞｱ)', 'GTS25 Type S (2-door)'),
  @('GTS25ﾀｲﾌﾟX(4ﾄﾞｱ)', 'GTS25 Type X (4-door)'),
  @('GTS25ﾀｲﾌﾟXG', 'GTS25 Type X G'),
  @('GTS-4ﾀｲﾌﾟX(4ﾄﾞｱ)', 'GTS-4 Type X (4-door)'),
  @('GTSｰ4仕様(4ﾄﾞｱ)', 'GTS-4 spec (4-door)'),
  @('GTSﾀｲﾌﾟX(4ﾄﾞｱ)', 'GTS Type X (4-door)'),
  @('GTSﾀｲﾌﾟS(4ﾄﾞｱ)', 'GTS Type S (4-door)'),
  @('GTSﾀｲﾌﾟS(2ﾄﾞｱ)', 'GTS Type S (2-door)'),
  @('GTSﾀｲﾌﾟG', 'GTS Type G'),
  @('GTS-4(2ﾄﾞｱ)', 'GTS-4 (2-door)'),
  @('GTS-4', 'GTS-4'),
  @('GTR除く:', 'non-GT-R: '),
  @('GTR:', 'GT-R: '),
  @('外板色#WK1専用新内装色', 'new interior color exclusive to #WK1 exterior paint'),
  @('仕様', ' spec'),
  @('ｼﾖｳ', ' spec'),
  @('付き', ''),
  @('付', ''),
  @('大型', 'large '),
  @('ﾅﾋﾞ', 'navigation'),
  @('ｽﾋﾟｰｶｰ', ' speakers'),
  @('＋', '+'),
  @('･', '/'),
  # variant spellings + one record where the fixed-width "AB" airbag flag
  # column leaks a stray 'A' into the middle of a continued description
  @('ﾌｪﾝﾀﾞAｰﾐﾗｰ', 'fender mirrors'),
  @('ﾘﾓｰﾄｺﾝﾄﾛｰﾙｴﾝﾄﾘｰ', 'remote-control entry'),
  @('ﾘﾔﾜｲﾊﾟ-', 'rear wiper'),
  @('ﾘﾔｽﾎﾟｲﾗ-', 'rear spoiler'),
  @('ｵｰﾃﾞｨｵ', 'audio'),
  @('ﾌｫｸﾞﾗﾝﾌﾟ', 'fog lamps')
)
# longest-first so partial phrases never pre-empt full ones
$map = $map | Sort-Object { -($_[0].Length) }

function Translate([string]$ja) {
  $s = Normalize $ja
  foreach ($pair in $map) { $s = $s.Replace($pair[0], $pair[1]) }
  # cosmetic cleanup
  $s = $s -replace '\+', ' + '
  $s = $s -replace '\s{2,}', ' '
  $s.Trim()
}

# ---- build output structure ----------------------------------------------
$result = @{}
$untranslated = New-Object System.Collections.ArrayList
foreach ($key in $merged.Keys) {
  $parts = $key.Split('|')
  $chassis = $parts[0]; $from = $parts[1]; $to = $parts[2]; $pattern = $parts[3]
  # locate the single defined position in the 5-char pattern
  $pos = -1; $ch = ''
  for ($i = 0; $i -lt 5; $i++) {
    if ($pattern[$i] -ne '*') {
      if ($pos -ge 0) { $pos = -2; break }  # multi-position pattern: skip
      $pos = $i; $ch = [string]$pattern[$i]
    }
  }
  if ($pos -lt 0) { continue }
  $en = Translate $merged[$key]
  foreach ($c in $en.ToCharArray()) {
    if ([int]$c -gt 126) {
      [void]$untranslated.Add("$key -> $en")
      break
    }
  }
  if (-not $result.ContainsKey($chassis)) { $result[$chassis] = New-Object System.Collections.ArrayList }
  [void]$result[$chassis].Add([ordered]@{ from = [int]$from; to = [int]$to; pos = $pos; char = $ch; text = $en })
}

if ($untranslated.Count -gt 0) {
  Write-Host "UNTRANSLATED RESIDUE ($($untranslated.Count)):"
  $untranslated | ForEach-Object { Write-Host "  $_" }
  throw "translation map incomplete - fix before publishing"
}

$json = $result | ConvertTo-Json -Depth 5 -Compress
[System.IO.File]::WriteAllText($out, $json, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "wrote $out"
$result.Keys | ForEach-Object { Write-Host "  $_ : $($result[$_].Count) entries" }
