/**
 * BPZILLA - FACTORY MODEL CODE DECODER
 *
 * This decoder does not carry a hand-written table of character meanings.
 * The previous one did, and it was wrong: it claimed position 1 was the body
 * shell (G = coupe, A = sedan), but every single R33 and R34 record in the
 * archive has G there, four-door cars included. It also applied one positional
 * scheme to every generation, when the FAST data plainly holds two different
 * code layouts:
 *
 *   R33 / R34   GJPRQFR33ZDA-J---R33     positional option string, dash filler
 *   R32         BNR32RXFSLMZG    R32     chassis code first, space filler
 *
 * So the meanings here are derived at runtime from all 1,271,066 records. For a
 * given character at a given position, we look at which chassis actually carry
 * it, and if every one of those chassis shares the same engine, drivetrain or
 * body style, that is reported as the meaning — with the evidence attached.
 * Where the data does not support a claim, none is made.
 */

const MODEL_DECODER = {

  // Which generations use which code layout, keyed by the 3-character suffix
  // that ends every code in the archive. 'S13' covers the Silvia coupe family
  // (S13/PS13/KS13 share the suffix); the 180SX hatchback on the same
  // platform carries its own distinct suffix, 'RS1', in the real FAST data.
  LAYOUTS: {
    'R33': 'positional',
    'R34': 'positional',
    'R32': 'chassis-led',
    'S13': 'chassis-led',
    'RS1': 'chassis-led',
    'S14': 'positional',
    // Stagea's suffix carries the chassis fragment ("WC3") embedded
    // mid-code, same shape as R33/R34 — option string first, chassis marker
    // in the middle, not chassis-first the way R32/Silvia/Z32 are.
    // (An 'M35' rule sat here for the M35-generation Stagea. That chassis is
    // no longer loaded — see the scope note in database.js — and since these
    // meanings are derived at runtime from the loaded records, the rule had
    // nothing left to derive from. Restore it alongside the data.)
    'WC3': 'positional',
    // Z32's codes open with the chassis fragment itself (e.g. "RZ32JA...",
    // "RGZ32JA...") the same way R32's do.
    'Z32': 'chassis-led'
  },

  LAYOUT_NOTES: {
    'positional': 'This generation’s codes are a fixed-width option string. Each position carries its own field and unused fields are filled with a dash.',
    'chassis-led': 'This generation’s codes start with the chassis code itself, followed by a variable-length option string padded with spaces. Positions do not line up with a positional-layout generation, so they are described separately.'
  },

  _index: null,

  // ---- Build the evidence index once, from the loaded database -------------
  buildIndex: function() {
    if (this._index) return this._index;
    const DB = window.JDM_DATABASE;
    if (!DB || !DB._cols) return null;

    const gens = {};        // 'R34' -> { total, positions: [ {char: {n, chassis:Set}} ], codes: Map }
    const codeInfo = new Map();

    Object.keys(DB._cols).forEach(modelId => {
      const col = DB._cols[modelId];
      const counts = new Int32Array(col.dict.mc.length);
      for (let i = 0; i < col.n; i++) counts[col.mci[i]]++;

      col.dict.mc.forEach((code, ci) => {
        const n = counts[ci];
        if (!n || !code) return;

        const gen = code.slice(-3);
        if (!gens[gen]) gens[gen] = { total: 0, positions: [], codes: new Map() };
        const G = gens[gen];
        G.total += n;
        G.codes.set(code, (G.codes.get(code) || 0) + n);

        for (let p = 0; p < code.length; p++) {
          if (!G.positions[p]) G.positions[p] = {};
          const ch = code[p];
          if (!G.positions[p][ch]) G.positions[p][ch] = { n: 0, chassis: new Set() };
          G.positions[p][ch].n += n;
          G.positions[p][ch].chassis.add(modelId);
        }

        if (!codeInfo.has(code)) codeInfo.set(code, { n: 0, chassis: new Map() });
        const info = codeInfo.get(code);
        info.n += n;
        info.chassis.set(modelId, (info.chassis.get(modelId) || 0) + n);
      });
    });

    this._index = { gens, codeInfo };
    return this._index;
  },

  layoutFor: function(code) {
    return this.LAYOUTS[String(code || '').slice(-3)] || 'positional';
  },

  generationOf: function(code) {
    return String(code || '').slice(-3);
  },

  // ---- Describe one character using only what the records prove ----------
  //
  // An earlier attempt here tried to name each position after a vehicle
  // attribute (engine, body style, drivetrain). That reads well but does not
  // survive scrutiny: within one generation there are only a handful of
  // chassis, and their attributes are strongly correlated, so a position that
  // merely identifies the chassis will "agree" with whichever attribute is
  // tested first. It labelled the grade position "Body style".
  //
  // What follows states facts instead of inferences:
  //   Chassis code   the character is part of the chassis id written into
  //                  the code (the R32 layout does this)
  //   Grade          the archive decodes a grade from this position
  //   Chassis marker only certain chassis ever carry this character here,
  //                  so it narrows down which car this is
  //   Option field   the character varies between cars of the same chassis,
  //                  so it records equipment rather than identity
  //   Constant       every car of this generation shares it
  _deriveMeaning: function(gen, pos, ch, code) {
    const idx = this.buildIndex();
    if (!idx || !idx.gens[gen]) return null;
    const G = idx.gens[gen];
    const slot = G.positions[pos];
    if (!slot || !slot[ch]) return null;

    const here = slot[ch];
    const distinct = Object.keys(slot);
    const chassisList = [...here.chassis].sort();
    const shown = ch === ' ' ? 'blank' : ch;

    const span = this._chassisSpan(code, gen);
    if (span && pos >= span.start && pos < span.end) {
      return {
        kind: 'derived',
        label: 'Chassis code',
        detail: `Character ${pos - span.start + 1} of "${span.text}". ${gen} codes open with the chassis itself rather than an option field.`,
        chassis: chassisList,
        records: here.n
      };
    }

    // R33/R34 codes carry the generation string in the middle of the option
    // block. Those characters are constant within the generation, but calling
    // them "no information" hides what they plainly are.
    const genAt = code.indexOf(gen);
    if (genAt >= 0 && pos >= genAt && pos < genAt + gen.length && genAt + gen.length < code.length - 3) {
      return {
        kind: 'derived',
        label: 'Generation marker',
        detail: `Character ${pos - genAt + 1} of "${gen}", written into the middle of the code as well as at the end.`,
        chassis: chassisList,
        records: here.n
      };
    }

    if (distinct.length === 1) {
      return {
        kind: 'constant',
        label: 'Always ' + shown,
        detail: `Every one of the ${G.total.toLocaleString()} ${gen} records has this character here, so the position separates nothing.`,
        chassis: chassisList,
        records: here.n
      };
    }

    const grades = this._gradeFor(gen, pos, ch, chassisList);
    if (grades && grades.length === 1) {
      return {
        kind: 'derived',
        label: 'Grade',
        detail: `${shown} is how the archive reads ${grades[0]} on this chassis.`,
        chassis: chassisList,
        records: here.n
      };
    }

    const allChassis = new Set();
    distinct.forEach(c => slot[c].chassis.forEach(x => allChassis.add(x)));

    // Does this character pick out a subset of the generation's chassis?
    if (allChassis.size > 1 && chassisList.length < allChassis.size) {
      return {
        kind: 'derived',
        label: 'Chassis marker',
        detail: `Within ${gen}, only ${chassisList.join(', ')} ever carries ${shown} here` +
                ` — ${here.n.toLocaleString()} records.`,
        chassis: chassisList,
        records: here.n
      };
    }

    // Otherwise it varies inside a single chassis, so it is recording equipment.
    return {
      kind: 'observed',
      label: 'Option field',
      detail: `Varies between cars of the same chassis. ${distinct.length} different characters appear at this position across ${gen}; ` +
              `${here.n.toLocaleString()} records use ${shown}.`,
      chassis: chassisList,
      records: here.n
    };
  },

  // Where, if anywhere, the chassis code is written into the code string.
  _chassisSpan: function(code, gen) {
    const idx = this.buildIndex();
    if (!idx || !code) return null;
    const info = idx.codeInfo.get(code);
    if (!info) return null;

    for (const chassis of info.chassis.keys()) {
      // try the whole chassis id first, then progressively shorter tails
      for (let cut = 0; cut <= chassis.length - 3; cut++) {
        const needle = chassis.slice(cut);
        const at = code.indexOf(needle);
        if (at >= 0 && at <= 2) {
          return { start: at, end: at + needle.length, text: needle, chassis: chassis };
        }
      }
    }
    return null;
  },

  // Grade tables are per-chassis (ER34's T/E for engine grade means something
  // completely different from a stray 'E' in an HR34 or ENR34 code that just
  // happens to land on the same character at the same position). Matching by
  // "some chassis in this generation defines this character" — the old test —
  // let ER34's grade meaning leak onto other R34 chassis that share the same
  // letter for an unrelated reason. So this only trusts a grade meaning when
  // the character belongs to exactly one chassis in the real data (chassisList,
  // built from the actual records) and that chassis is the one whose table
  // defines it — never a different chassis that merely ends in the same gen.
  _gradeFor: function(gen, pos, ch, chassisList) {
    const DB = window.JDM_DATABASE;
    if (!DB) return null;
    if (!chassisList || chassisList.length !== 1) return null;
    const modelId = chassisList[0];
    const expectedPos = (DB.gradePositions || {})[modelId] || 4;
    if (pos !== expectedPos) return null;
    const table = DB.gradeCodes[modelId];
    if (!table) return null;
    const g = table[ch];
    return g ? [g] : null;
  },

  // ---- Decode a code into labelled segments -------------------------------
  decode: function(codeStr) {
    const code = String(codeStr || '').toUpperCase().trim();
    if (!code) return null;

    const idx = this.buildIndex();
    const gen = this.generationOf(code);
    const layout = this.layoutFor(code);
    const known = !!(idx && idx.gens[gen]);
    const info = idx ? idx.codeInfo.get(code) : null;

    const chars = [];
    const body = code.length > 3 ? code.slice(0, code.length - 3) : code;

    for (let p = 0; p < body.length; p++) {
      const ch = body[p];
      const meaning = known ? this._deriveMeaning(gen, p, ch, code) : null;
      chars.push({
        pos: p + 1,
        char: ch,
        blank: ch === ' ' || ch === '-',
        meaning: meaning
      });
    }

    return {
      rawCode: code,
      generation: gen,
      layout: layout,
      layoutNote: this.LAYOUT_NOTES[layout],
      knownGeneration: known,
      suffix: code.slice(-3),
      chars: chars,
      records: info ? info.n : 0,
      chassis: info ? [...info.chassis.entries()].sort((a, b) => b[1] - a[1]) : []
    };
  },

  // ==========================================================================
  // CHARACTER KEY
  // --------------------------------------------------------------------------
  // What each letter means, worked out from the records rather than asserted.
  //
  // For every position and character we count the cars that carry it and test
  // whether they share a chassis, grade, interior code or build year far more
  // often than the generation does as a whole. A claim is only kept when it
  // covers at least 90% of the cars carrying that character AND beats the
  // generation's own base rate by 25 points, on a sample of at least 25 cars.
  // That threshold is what keeps coincidences out: without the lift test,
  // "interior code 5" looks meaningful everywhere, because almost every
  // Skyline has it.
  //
  // Where the chassis carrying a character all share an engine or drivetrain,
  // that is reported in plain language, since it is the thing an owner
  // actually wants to read.
  // ==========================================================================
  MIN_SAMPLE: 25,
  MIN_SHARE: 0.90,
  MIN_LIFT: 0.25,

  _keys: {},

  buildKey: function(gen) {
    if (this._keys[gen]) return this._keys[gen];
    const DB = window.JDM_DATABASE;
    if (!DB || !DB._cols) return null;

    const models = Object.keys(DB._cols).filter(m => {
      const c = DB._cols[m];
      return c.dict.mc.some(x => x && x.slice(-3) === gen);
    });
    if (!models.length) return null;

    // 1. aggregate every record onto its code
    const agg = new Map();          // code -> {n, chassis, grade, trim:{}, year:{}, dmin, dmax}
    let total = 0;
    const base = { chassis: {}, grade: {}, trim: {}, year: {} };
    const bump = (o, k) => { if (k) o[k] = (o[k] || 0) + 1; };

    models.forEach(modelId => {
      const col = DB._cols[modelId];
      for (let i = 0; i < col.n; i++) {
        const code = col.dict.mc[col.mci[i]];
        if (!code || code.slice(-3) !== gen) continue;
        let a = agg.get(code);
        if (!a) {
          a = { n: 0, chassis: modelId, grade: DB._decodeGrade(modelId, code) || '',
                trim: {}, year: {}, dmin: null, dmax: null };
          agg.set(code, a);
        }
        const trim = col.dict.t[col.ti[i]] || '';
        const date = col.dict.d[col.di[i]] || '';
        const year = date.slice(0, 4);
        a.n++; total++;
        bump(a.trim, trim); bump(a.year, year);
        if (!a.dmin || date < a.dmin) a.dmin = date;
        if (!a.dmax || date > a.dmax) a.dmax = date;
        bump(base.chassis, modelId); bump(base.grade, a.grade);
        bump(base.trim, trim); bump(base.year, year);
      }
    });

    // 2. fold the codes into per-position, per-character buckets
    const positions = [];
    agg.forEach((a, code) => {
      const bodyLen = code.length - 3;
      for (let p = 0; p < bodyLen; p++) {
        if (!positions[p]) positions[p] = {};
        const ch = code[p];
        let b = positions[p][ch];
        if (!b) {
          b = { n: 0, chassis: {}, grade: {}, trim: {}, year: {}, dmin: null, dmax: null, codes: 0 };
          positions[p][ch] = b;
        }
        b.n += a.n; b.codes++;
        b.chassis[a.chassis] = (b.chassis[a.chassis] || 0) + a.n;
        if (a.grade) b.grade[a.grade] = (b.grade[a.grade] || 0) + a.n;
        for (const k in a.trim) b.trim[k] = (b.trim[k] || 0) + a.trim[k];
        for (const k in a.year) b.year[k] = (b.year[k] || 0) + a.year[k];
        if (!b.dmin || a.dmin < b.dmin) b.dmin = a.dmin;
        if (!b.dmax || a.dmax > b.dmax) b.dmax = a.dmax;
      }
    });

    // 3. test each bucket for a real association
    const sum = o => Object.values(o).reduce((x, y) => x + y, 0);
    const top = o => Object.entries(o).sort((x, y) => y[1] - x[1])[0];

    positions.forEach(slot => {
      Object.keys(slot).forEach(ch => {
        const b = slot[ch];
        b.best = null;
        if (b.n < this.MIN_SAMPLE) return;
        ['chassis', 'grade', 'trim', 'year'].forEach(kind => {
          const tot = sum(b[kind]);
          if (!tot) return;
          const [val, cnt] = top(b[kind]);
          const share = cnt / tot;
          const baseTot = sum(base[kind]) || 1;
          const baseline = (base[kind][val] || 0) / baseTot;
          const lift = share - baseline;
          if (share >= this.MIN_SHARE && lift >= this.MIN_LIFT) {
            if (!b.best || lift > b.best.lift) b.best = { kind, value: val, share, lift };
          }
        });
      });
    });

    this._keys[gen] = { gen, total, positions, base, models };
    return this._keys[gen];
  },

  // Turn a bucket into the sentence an owner would want to read.
  explainChar: function(gen, pos, ch) {
    const K = this.buildKey(gen);
    if (!K || !K.positions[pos] || !K.positions[pos][ch]) return null;
    const b = K.positions[pos][ch];
    const MODELS = (window.JDM_DATABASE || {}).models || {};
    const chassisList = Object.keys(b.chassis).sort();
    const shown = ch === ' ' ? '(blank)' : ch;

    let headline = null, kind = 'observed';

    // Even where no single chassis dominates, the cars carrying this character
    // may still all share an engine family — every R33 car with K at position 2
    // is an RB25 car, across three different chassis. That is a real finding.
    if (!b.best && chassisList.length > 1) {
      const K = this.buildKey(gen);
      const allChassis = K ? Object.keys(K.base.chassis) : [];
      if (allChassis.length > chassisList.length) {
        const eng = chassisList.map(c => (MODELS[c] || {}).engine).filter(Boolean);
        const fam = new Set(eng.map(e => (e.match(/^[A-Z]{2}\d{2}/) || [''])[0]).filter(Boolean));
        const others = allChassis.filter(c => !chassisList.includes(c));
        const otherFam = new Set(others.map(c => (MODELS[c] || {}).engine || '')
                                       .map(e => (e.match(/^[A-Z]{2}\d{2}/) || [''])[0]).filter(Boolean));
        if (fam.size === 1 && eng.length === chassisList.length && !otherFam.has([...fam][0])) {
          headline = `Engine family: ${[...fam][0]} (${chassisList.join(', ')})`;
          kind = 'derived';
        }
      }
    }

    if (!headline && b.best) {
      const { value, share } = b.best;
      const pct = Math.round(share * 100);
      if (b.best.kind === 'chassis') {
        // If every chassis here shares an engine, say so. If they only share
        // the engine family — RB25DET and RB25DE are both RB25 — say that
        // instead of giving up, but do not overstate it as one engine.
        const eng = new Set(chassisList.map(c => (MODELS[c] || {}).engine).filter(Boolean));
        const fam = new Set([...eng].map(e => (e.match(/^[A-Z]{2}\d{2}/) || [''])[0]).filter(Boolean));
        const drv = new Set(chassisList.map(c => (MODELS[c] || {}).drivetrain).filter(Boolean));
        if (eng.size === 1) headline = 'Engine: ' + [...eng][0];
        else if (fam.size === 1) headline = `Engine family: ${[...fam][0]} (${chassisList.join(', ')})`;
        else if (drv.size === 1) headline = 'Drivetrain: ' + [...drv][0];
        else headline = 'Chassis: ' + chassisList.join(', ');
        kind = 'derived';
      } else if (b.best.kind === 'grade') {
        headline = 'Grade: ' + value;
        kind = 'derived';
      } else if (b.best.kind === 'trim') {
        headline = 'Interior trim code ' + value + (value === 'M' ? ' (leather)' : '');
        kind = 'derived';
      } else if (b.best.kind === 'year') {
        headline = 'Built ' + value + (pct < 100 ? ` (${pct}% of them)` : '');
        kind = 'derived';
      }
    }

    // Last resort, and the only finding available for a generation with a
    // single chassis: a character confined to part of the production run is a
    // running change. Reported only when the window is clearly narrower than
    // the generation's own span.
    if (!headline && b.dmin && b.dmax) {
      const K = this.buildKey(gen);
      let gmin = null, gmax = null;
      if (K) {
        K.positions.forEach(slot => Object.values(slot).forEach(x => {
          if (x.dmin && (!gmin || x.dmin < gmin)) gmin = x.dmin;
          if (x.dmax && (!gmax || x.dmax > gmax)) gmax = x.dmax;
        }));
      }
      const months = s => { const [y, m] = s.split('-').map(Number); return y * 12 + m; };
      if (gmin && gmax) {
        const span = months(b.dmax) - months(b.dmin);
        const full = months(gmax) - months(gmin);
        if (full > 0 && span / full <= 0.55 && b.n >= this.MIN_SAMPLE) {
          headline = `Running change: only on cars built ${b.dmin} to ${b.dmax}`;
          kind = 'derived';
        }
      }
    }

    return {
      char: ch,
      shown: shown,
      records: b.n,
      codes: b.codes,
      chassis: chassisList,
      span: b.dmin && b.dmax ? `${b.dmin} to ${b.dmax}` : '',
      headline: headline,
      kind: headline ? kind : 'observed',
      note: headline
        ? `${b.n.toLocaleString()} cars, ${b.dmin} to ${b.dmax}.`
        : `${b.n.toLocaleString()} cars across ${chassisList.join(', ')}, ${b.dmin} to ${b.dmax}. No single chassis, grade, interior or year accounts for them, so this character is not pinned down yet.`
    };
  },

  // Every position and character for one generation, for the key table.
  keyTable: function(gen) {
    const K = this.buildKey(gen);
    if (!K) return [];
    return K.positions.map((slot, p) => ({
      pos: p + 1,
      chars: Object.keys(slot).sort()
        .map(ch => this.explainChar(gen, p, ch))
        .filter(Boolean)
        .sort((a, b) => b.records - a.records)
    }));
  },

  generations: function() {
    const idx = this.buildIndex();
    return idx ? Object.keys(idx.gens).sort().reverse() : [];
  },

  // How common is this interior code within the generation?
  _explainTrim: function(gen, code) {
    if (!code) return '—';
    const K = this.buildKey(gen);
    if (!K || !K.base.trim) return code;
    const n = K.base.trim[code] || 0;
    const total = Object.values(K.base.trim).reduce((a, b) => a + b, 0) || 1;
    const share = n / total * 100;
    if (!n) return code;
    const pct = share >= 99.5 ? 'nearly every car'
              : share >= 1 ? share.toFixed(0) + '% of ' + gen + ' cars'
              : share.toFixed(2) + '% of ' + gen + ' cars';
    return `${code} — ${n.toLocaleString()} cars, ${pct}`;
  },

  // ---- Plain-English build summary for one car ----------------------------
  explainBuild: function(record) {
    const DB = window.JDM_DATABASE;
    if (!DB || !record) return null;
    const M = DB.models[record.modelId] || {};
    const gen = this.generationOf(record.modelCode);
    const stats = DB.getModelStats(record.modelId);
    const prof = this.profile(record.modelCode);

    // Chassis codes that cover more than one real engine (ER34: NA 25GT vs
    // turbo 25GT-t) are split into separate browsable models (ER34_GT /
    // ER34_GTT — see database.js), each with its own correct static engine
    // spec, so no per-record override is needed here any more.
    const engineSpec = M.engine || '—';

    // how unusual is this paint on this chassis
    let paintShare = null;
    if (stats) {
      const hit = stats.colorBreakdown.find(c => c.code === record.colorCode);
      if (hit) paintShare = hit;
    }

    // Characters the key can pin down. Positions whose only finding is the
    // chassis are counted, not listed — the engine and drivetrain are already
    // in the spec table above, and repeating "RB26DETT" six times is noise.
    const opts = [];
    const seenText = new Set();
    const optionedPositions = new Set();
    let confirmModel = 0;

    // Authoritative per-position factory options first (cold weather
    // package, glass/audio packages, etc.) — decoded in database.js from
    // real photographed build plates and Nissan's own SPECDSC option
    // glossary, so they outrank the statistically-derived findings below
    // and claim their positions before the generic pass reaches them.
    const physical = DB._resolvePhysical ? DB._resolvePhysical(record.modelId) : null;
    if (physical && DB._decodeOptions) {
      DB._decodeOptions(physical.physicalId, record.modelCode || '', record.buildDate).forEach(o => {
        opts.push({ pos: o.pos + 1, char: o.char, text: o.text, records: 0 });
        seenText.add(o.text);
        optionedPositions.add(o.pos);
      });
    }

    if (record.modelCode) {
      const body = record.modelCode.slice(0, -3);
      for (let p = 0; p < body.length; p++) {
        if (optionedPositions.has(p)) continue;
        const e = this.explainChar(gen, p, body[p]);
        if (!e || !e.headline || e.kind !== 'derived') continue;
        const isModelRestatement = /^(Engine|Drivetrain|Chassis)/.test(e.headline);
        if (isModelRestatement) { confirmModel++; continue; }
        // A statistically-derived grade claim is a >=90% association, not a
        // certainty — the record's own decoded grade is authoritative. Skip
        // any derived "Grade:" row that contradicts it (e.g. one of the 6
        // rare Standard-GT-R BNR34s carrying the letter that means V-Spec
        // on the other 4,172 cars) rather than showing both.
        if (/^Grade: /.test(e.headline) && record.grade && e.headline !== 'Grade: ' + record.grade) continue;
        if (seenText.has(e.headline)) continue;
        seenText.add(e.headline);
        opts.push({ pos: p + 1, char: e.shown, text: e.headline, records: e.records });
      }
    }

    const sentence = [
      record.buildDate ? `Built ${record.buildDate}` : null,
      M.name || record.modelName,
      record.grade ? `in ${record.grade} trim` : null,
      record.colorName ? `finished in ${record.colorName}${
        record.colorCode && record.colorName !== record.colorCode ? ` (${record.colorCode})` : ''}` : null
    ].filter(Boolean).join(', ') + '.';

    return {
      sentence,
      spec: [
        ['Chassis', record.plateNumber || record.chassisNumber],
        ['Model', M.name || record.modelName],
        ['Engine', engineSpec],
        ['Drivetrain', M.drivetrain || '—'],
        ['Gearbox', M.transmission || '—'],
        ['Body', M.bodyStyle || '—'],
        ['Grade', record.grade || 'not recorded in the code'],
        ['Built', record.buildDate || '—'],
        ['Series', record.series || '—'],
        ['Paint', `${record.colorCode}${record.colorName !== record.colorCode ? ' — ' + record.colorName : ''}`],
        // The colour field as the plate actually reads it: paint code with the
        // trim character in front. Only worth a row where the record carries
        // one — the R32/R33/R34 discs leave it blank, so the plate and the
        // paint code are the same string there.
        ...(record.colorTrimCode
          ? [['Plate colour field', `${record.colorTrimCode}${record.colorCode}`]]
          : []),
        ['Interior code', this._explainTrim(gen, record.interiorCode)],
        ['Factory code', record.modelCode || '—']
      ],
      paintShare,
      sharedCode: prof ? prof.records : 0,
      options: opts,
      confirmModel: confirmModel,
      generation: gen
    };
  },

  // ---- Codes that differ in exactly one position --------------------------
  siblings: function(codeStr, limit = 12) {
    const idx = this.buildIndex();
    const code = String(codeStr || '').toUpperCase().trim();
    if (!idx) return [];
    const gen = this.generationOf(code);
    const G = idx.gens[gen];
    if (!G) return [];

    const out = [];
    G.codes.forEach((n, other) => {
      if (other === code || other.length !== code.length) return;
      let diff = -1, count = 0;
      for (let i = 0; i < code.length; i++) {
        if (code[i] !== other[i]) { count++; diff = i; if (count > 1) break; }
      }
      if (count === 1) out.push({ code: other, pos: diff + 1, from: code[diff], to: other[diff], records: n });
    });

    out.sort((a, b) => b.records - a.records);
    return out.slice(0, limit);
  },

  // ---- The most common real codes for a chassis ---------------------------
  topCodesFor: function(modelId, limit = 8) {
    const DB = window.JDM_DATABASE;
    const col = DB && DB._cols ? DB._cols[modelId] : null;
    if (!col) return [];
    const counts = new Int32Array(col.dict.mc.length);
    for (let i = 0; i < col.n; i++) counts[col.mci[i]]++;
    return col.dict.mc
      .map((code, i) => ({ code, records: counts[i] }))
      .filter(x => x.code && x.records)
      .sort((a, b) => b.records - a.records)
      .slice(0, limit);
  },

  // ---- Everything the archive knows about one code ------------------------
  profile: function(codeStr) {
    const DB = window.JDM_DATABASE;
    const code = String(codeStr || '').toUpperCase().trim();
    if (!DB || !DB._cols) return null;

    let records = 0, dMin = null, dMax = null;
    const colors = new Map(), grades = new Map(), chassis = new Map(), examples = [];

    Object.keys(DB._cols).forEach(modelId => {
      const col = DB._cols[modelId];
      const ci = col.dict.mc.indexOf(code);
      if (ci < 0) return;
      for (let i = 0; i < col.n; i++) {
        if (col.mci[i] !== ci) continue;
        records++;
        chassis.set(modelId, (chassis.get(modelId) || 0) + 1);
        const d = col.dict.d[col.di[i]];
        if (d) {
          if (!dMin || d < dMin) dMin = d;
          if (!dMax || d > dMax) dMax = d;
        }
        const c = col.dict.c[col.ci[i]] || '';
        colors.set(c, (colors.get(c) || 0) + 1);
        const g = DB._decodeGrade(modelId, code, d);
        if (g) grades.set(g, (grades.get(g) || 0) + 1);
        // _materialize needs the BROWSABLE model id, not the physical file
        // id this loop iterates. On a grade-split chassis the physical id
        // ('ER34', 'ECR33', 'PS13', 'RS13', 'WGNC34') isn't a key in
        // DB.models at all, so the example records came back with the raw
        // id as their name and an em-dash for engine and every other spec.
        if (examples.length < 6) {
          examples.push(DB._materialize(DB._virtualModelFor(modelId, code), i));
        }
      }
    });

    if (!records) return null;

    const paint = [...colors.entries()].sort((a, b) => b[1] - a[1]).map(([c, n]) => {
      const name = DB._paint[c] || (DB.colorNames[c] || {}).name || c;
      return {
        code: c,
        name,
        hex: (DB.colorNames[c] || {}).hex || DB._swatchFor(c, name),
        count: n,
        percent: (n / records * 100).toFixed(1)
      };
    });

    return {
      code, records,
      firstBuild: dMin, lastBuild: dMax,
      chassis: [...chassis.entries()].sort((a, b) => b[1] - a[1]),
      paint,
      grades: [...grades.entries()].sort((a, b) => b[1] - a[1]),
      examples
    };
  }
};

if (typeof window !== 'undefined') {
  window.MODEL_DECODER = MODEL_DECODER;
}
