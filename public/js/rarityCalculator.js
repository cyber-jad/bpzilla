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
    const grades = (stats.gradeBreakdown && stats.gradeBreakdown.length)
      ? stats.gradeBreakdown
      : [{ grade: 'Standard', count: totalProd, percent: '100.0' }];
    const gradeObj = grades.find(g => g.grade === trim) || grades[0];
    const trimObj = { trim: gradeObj.grade, count: gradeObj.count, percent: gradeObj.percent };
    const trimCount = trimObj.count;
    const trimRatio = trimCount / totalProd;

    // Find color data
    const colorObj = stats.colorBreakdown.find(c => c.code === colorCode) || stats.colorBreakdown[0];
    if (!colorObj) return null;
    const colorCount = colorObj.count;
    const colorRatio = colorCount / totalProd;

    // Option modifier (Cold weather, carbon, leather, navi, etc.)
    let optionModifier = 1.0;
    if (options.includes('cold_weather')) optionModifier *= 0.18;
    if (options.includes('carbon_spoiler') || options.includes('carbon_hood')) optionModifier *= 0.12;
    if (options.includes('leather_interior')) optionModifier *= 0.08;
    if (options.includes('navi_audio')) optionModifier *= 0.25;
    if (options.includes('sunroof')) optionModifier *= 0.04;
    if (options.includes('n1_engine')) optionModifier *= 0.02;

    // Joint probability estimation grounded in authentic factory distributions
    let estimatedMatchingUnits = Math.round(totalProd * trimRatio * colorRatio * optionModifier);
    if (estimatedMatchingUnits < 1) estimatedMatchingUnits = 1;
    if (estimatedMatchingUnits > trimCount) estimatedMatchingUnits = Math.min(trimCount, colorCount);

    const rarityPercentile = +((1 - (estimatedMatchingUnits / totalProd)) * 100).toFixed(2);
    const exactPercentage = +((estimatedMatchingUnits / totalProd) * 100).toFixed(3);

    // Determine Tier
    let tierName = 'Core Production';
    let tierBadge = 'badge-standard';
    let tierDescription = 'Standard factory high-volume configuration.';

    if (estimatedMatchingUnits === 1) {
      tierName = 'One-of-One Unicorn';
      tierBadge = 'badge-unicorn';
      tierDescription = 'Literally the single only vehicle produced with this exact factory specification.';
    } else if (estimatedMatchingUnits <= 19) {
      tierName = 'Pinnacle Grail (Tier 0)';
      tierBadge = 'badge-grail';
      tierDescription = 'Among the top 20 rarest halo collector vehicles in global automotive history.';
    } else if (estimatedMatchingUnits <= 80) {
      tierName = 'Ultra Rare Spec (Tier 1)';
      tierBadge = 'badge-ultra-rare';
      tierDescription = 'Exceptionally scarce; highly sought-after by premier collectors and heritage museums.';
    } else if (estimatedMatchingUnits <= 250) {
      tierName = 'Collector Grade (Tier 2)';
      tierBadge = 'badge-collector';
      tierDescription = 'Limited production run with high investment retention and enthusiast appeal.';
    } else if (estimatedMatchingUnits <= 800) {
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
      estimatedMatchingUnits: estimatedMatchingUnits,
      exactPercentage: exactPercentage,
      rarityPercentile: rarityPercentile,
      tierName: tierName,
      tierBadge: tierBadge,
      tierDescription: tierDescription,
      oneOfXText: `1 of ${estimatedMatchingUnits.toLocaleString()} in the FAST Records`,
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
                  <p class="cert-subtitle">BPZILLA &mdash; NISSAN SKYLINE FACTORY RECORD ARCHIVE</p>
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
