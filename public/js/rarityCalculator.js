/**
 * BPZILLA - RARITY & "1 OF X" CALCULATION ENGINE
 * Computes exact statistical rarity percentages, survival tiers,
 * and generates official Registry Certificates of Authenticity.
 */

const RARITY_CALCULATOR = {
  calculateRarity: function(params) {
    const { modelId, trim, colorCode, options = [], year, transmission } = params;
    const modelData = JDM_DATABASE.models[modelId];
    if (!modelData) return null;

    // Counts come from the loaded FAST records. The previous version read
    // modelData.totalProduction / .trimBreakdown / .colors — fields from an
    // older schema that no longer exist, so `.find` threw on undefined and
    // killed App.init() before the database was ever fetched.
    const stats = JDM_DATABASE.getModelStats(modelId);
    if (!stats || !stats.totalCount) return null;

    const totalProd = stats.totalCount;

    // Find trim (FAST "grade") data. Many models carry no grade field, in
    // which case the whole model is one bucket.
    //
    // That bucket is a DISPLAY label and must never be used as a filter. It was:
    // "Standard" went into countMatching below, no record anywhere carries that
    // string, so every car on a chassis without decoded grades matched zero
    // records and was reported "1 of 0 in the FAST records — No Record of This
    // Build". That is every HCR32, HR32, HNR32, FR32, ECR32 and ER32 — around
    // 270,000 real cars told they did not exist, on a page whose whole job is
    // saying how many were built like this one.
    const hasRealGrades = !!(stats.gradeBreakdown && stats.gradeBreakdown.length);
    const grades = hasRealGrades
      ? stats.gradeBreakdown
      : [{ grade: 'Standard', count: totalProd, percent: '100.0' }];
    // Falls back to the top grade rather than erroring on an unrecognized
    // `trim`. runRarityCalculation's UI defaults ('V-Spec II', 'TV2') are
    // BNR34-specific and get passed through unchanged if the model select
    // changes without a matching trim/color update, so this has to degrade
    // gracefully rather than blank the whole card on a mismatch.
    const gradeObj = grades.find(g => g.grade === trim) || grades[0];
    const trimObj = { trim: gradeObj.grade, count: gradeObj.count, percent: gradeObj.percent };
    const trimCount = trimObj.count;
    const trimRatio = trimCount / totalProd;

    // Find color data
    // Same fallback reasoning as gradeObj above: a stale colorCode from the
    // UI degrades to the model's top color rather than returning null.
    const colorObj = stats.colorBreakdown.find(c => c.code === colorCode) || stats.colorBreakdown[0];
    if (!colorObj) return null;
    const colorCount = colorObj.count;
    const colorRatio = colorCount / totalProd;

    // Count the actual cars, don't model them.
    //
    // This was a joint-probability estimate: grade share x colour share x a
    // table of invented per-option coefficients (cold weather 0.18, leather
    // 0.08, and so on — numbers with no source behind them). On a BNR34
    // V-Spec II Nür in Bayside Blue it returned 178 where the factory records
    // hold 119, and printed that figure onto a certificate of authenticity.
    //
    // Every record is already in memory, so the combination is counted.
    const optionTexts = (options || []).filter(Boolean);
    const match = JDM_DATABASE.countMatching(modelId, {
      // null, not the placeholder — countMatching skips the grade filter
      // entirely when it is null, which is exactly right for a chassis whose
      // grades this archive cannot read.
      grade: hasRealGrades ? trimObj.trim : null,
      colorCode: colorObj.code,
      options: optionTexts
    });
    // A real combination can legitimately have been built zero times; saying so
    // is the honest answer, and far more interesting than rounding it up to 1.
    const matchingUnits = match ? match.count : 0;

    const rarityPercentile = +((1 - (matchingUnits / totalProd)) * 100).toFixed(2);
    const exactPercentage = +((matchingUnits / totalProd) * 100).toFixed(3);

    // Determine Tier
    // The breakpoints below (19, 80, 250, 800) are editorial cutoffs for the
    // certificate's tier badge, not a statistical test the way modelDecoder's
    // MIN_SAMPLE/MIN_SHARE/MIN_LIFT are - matchingUnits itself is the real,
    // counted number and is what should be trusted; the tier is just a label
    // on top of it.
    let tierName = 'Core Production';
    let tierBadge = 'badge-standard';
    let tierDescription = 'Standard factory high-volume configuration.';

    if (matchingUnits === 0) {
      tierName = 'No Record of This Build';
      tierBadge = 'badge-grail';
      tierDescription = 'No car in the factory records was built to this exact combination. Either it was never offered together, or this specification is not what the plate actually reads.';
    } else if (matchingUnits === 1) {
      tierName = 'One-of-One Unicorn';
      tierBadge = 'badge-unicorn';
      tierDescription = 'Literally the single only vehicle produced with this exact factory specification.';
    } else if (matchingUnits <= 19) {
      tierName = 'Pinnacle Grail (Tier 0)';
      tierBadge = 'badge-grail';
      tierDescription = 'Among the top 20 rarest halo collector vehicles in global automotive history.';
    } else if (matchingUnits <= 80) {
      tierName = 'Ultra Rare Spec (Tier 1)';
      tierBadge = 'badge-ultra-rare';
      tierDescription = 'Exceptionally scarce; highly sought-after by premier collectors and heritage museums.';
    } else if (matchingUnits <= 250) {
      tierName = 'Collector Grade (Tier 2)';
      tierBadge = 'badge-collector';
      tierDescription = 'Limited production run with high investment retention and enthusiast appeal.';
    } else if (matchingUnits <= 800) {
      tierName = 'Desirable Spec (Tier 3)';
      tierBadge = 'badge-desirable';
      tierDescription = 'Uncommon specification featuring distinctive paint or performance options.';
    } else {
      tierName = 'Enthusiast Core (Tier 4)';
      tierBadge = 'badge-enthusiast';
      tierDescription = 'Standard production variant with great historic pedigree.';
    }

    return {
      modelName: modelData.name,
      modelId: modelId,
      trim: trimObj ? trimObj.trim : trim,
      colorName: colorObj.name,
      colorCode: colorObj.code,
      colorHex: colorObj.hex,
      totalModelProduction: totalProd,
      totalInColor: colorCount,
      colorPercentage: colorObj.percent,
      totalInTrim: trimCount,
      trimPercentage: trimObj ? trimObj.percent : 0,
      matchingUnits: matchingUnits,
      estimatedMatchingUnits: matchingUnits,  // retained for older callers
      exactPercentage: exactPercentage,
      rarityPercentile: rarityPercentile,
      tierName: tierName,
      tierBadge: tierBadge,
      tierDescription: tierDescription,
      // "1 of 0" is not a sentence. Zero is a real answer — a combination the
      // factory never built — but it has to read as one.
      oneOfXText: matchingUnits === 0
        ? `No car in the FAST records was built to this exact specification`
        : matchingUnits === 1
          ? `The only one in the FAST records`
          : `1 of ${matchingUnits.toLocaleString()} in the FAST records`,
      optionsApplied: options
    };
  },

  generateCertificateHTML: function(calcResult, chassisNumber = 'UNREGISTERED') {
    const certNumber = `BP-${Math.floor(100000 + Math.random() * 900000)}`;
    const issueDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    return `
      <div class="certificate-container" id="registry-certificate">
        <div class="certificate-border">
          <div class="certificate-inner">
            <div class="cert-watermark">JDM REGISTRY</div>
            
            <div class="cert-header">
              <div class="cert-logo-section">
                <span class="cert-japanese-seal">公認記録</span>
                <div class="cert-title-group">
                  <h2 class="cert-main-title">OFFICIAL REGISTRY CERTIFICATE</h2>
                  <p class="cert-subtitle">BPZILLA &mdash; NISSAN FACTORY RECORD ARCHIVE</p>
                </div>
              </div>
              <div class="cert-meta">
                <span class="cert-number">CERTIFICATE NO: <strong>${certNumber}</strong></span>
                <span class="cert-date">DATE OF ISSUE: <strong>${issueDate}</strong></span>
              </div>
            </div>

            <div class="cert-divider"></div>

            <div class="cert-body">
              <p class="cert-statement">
                This document certifies that the vehicle specification detailed below has been formally analyzed and indexed against the official Japanese factory production archives.
              </p>

              <div class="cert-grid">
                <div class="cert-field">
                  <label>VEHICLE MODEL</label>
                  <div class="cert-val highlight">${calcResult.modelName}</div>
                </div>
                <div class="cert-field">
                  <label>CHASSIS / VIN IDENTIFIER</label>
                  <div class="cert-val mono">${chassisNumber}</div>
                </div>
                <div class="cert-field">
                  <label>FACTORY TRIM / GRADE</label>
                  <div class="cert-val">${calcResult.trim}</div>
                </div>
                <div class="cert-field">
                  <label>FACTORY EXTERIOR PAINT</label>
                  <div class="cert-val">
                    <span class="cert-color-dot" style="background-color: ${calcResult.colorHex};"></span>
                    ${calcResult.colorCode} - ${calcResult.colorName}
                  </div>
                </div>
              </div>

              <div class="cert-rarity-box">
                <div class="rarity-stat-block">
                  <div class="rarity-label">PRODUCTION RARITY RANK</div>
                  <div class="rarity-big-number">${calcResult.oneOfXText}</div>
                  <div class="rarity-sub-badge ${calcResult.tierBadge}">${calcResult.tierName}</div>
                </div>
                <div class="rarity-details-list">
                  <div class="rarity-line"><span>Total FAST Records for Model:</span> <strong>${calcResult.totalModelProduction.toLocaleString()} Units</strong></div>
                  <div class="rarity-line"><span>Total in ${calcResult.colorCode} Paint:</span> <strong>${calcResult.totalInColor.toLocaleString()} Units (${calcResult.colorPercentage}%)</strong></div>
                  <div class="rarity-line"><span>Rarity Percentile:</span> <strong>Top ${(100 - calcResult.rarityPercentile).toFixed(2)}% Rarest Specification</strong></div>
                </div>
              </div>
            </div>

            <div class="cert-footer">
              <div class="cert-stamp">
                <div class="hanko-seal">
                  <span>登録</span>
                  <span>済証</span>
                </div>
                <div class="stamp-text">AUTHENTICATED BY THE BPZILLA ARCHIVE</div>
              </div>
              <div class="cert-signature-block">
                <div class="cert-sig-line"></div>
                <div class="cert-sig-title">Official Registry Archivist</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
};

if (typeof window !== 'undefined') {
  window.RARITY_CALCULATOR = RARITY_CALCULATOR;
}
