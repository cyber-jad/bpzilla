/**
 * BPZILLA - MAIN APPLICATION CONTROLLER
 * Comprehensive Nissan Skyline Routing, Filtering, Universal FAST VIN Resolution, FAST Decoding, and Charts
 */

document.addEventListener('DOMContentLoaded', () => {
  const App = {
    currentModel: 'BCNR33',
    currentLegendsModel: 'S14',
    currentTab: 'database-view',
    dbPage: 1,
    legendsPage: 1,
    dbPageSize: 25,
    dbSortField: 'chassis',
    dbSortAsc: true,
    colorChartInstance: null,
    timelineChartInstance: null,

    init: async function() {
      // 1. Load the genuine Nissan FAST records FIRST. Every view below reads
      //    JDM_DATABASE._byPrefix, so initialising them before the fetch left
      //    the model strip on "Loading...", the filters empty, and the rarity
      //    calculator dividing into thin air.
      try {
        if (JDM_DATABASE.loadFastData) await JDM_DATABASE.loadFastData();
      } catch (e) {
        console.error('BPZILLA: FAST data failed to load —', e);
      }

      // 2. Initialise each view in isolation. Previously a single throw in any
      //    one of these aborted init() entirely and took the whole page down.
      const step = (name, fn) => {
        try { fn.call(this); }
        catch (e) { console.error(`BPZILLA: ${name}() failed —`, e); }
      };

      step('renderTicker', this.renderTicker);
      step('showLoadError', this.showLoadError);
      step('populateModelSelects', this.populateModelSelects);
      step('renderModelQuickStrip', this.renderModelQuickStrip);
      step('renderLegendsModelStrip', () => this.renderModelStrip('legends'));
      step('initNavigation', this.initNavigation);
      step('initToolsSubNav', this.initToolsSubNav);
      step('initGlobalSearch', this.initGlobalSearch);
      step('initDatabaseView', this.initDatabaseView);
      step('initLegendsView', this.initLegendsView);
      step('initStatsView', this.initStatsView);
      step('initFastDecoderView', this.initFastDecoderView);
      step('initRarityCalculatorView', this.initRarityCalculatorView);
      step('initPaintIndexView', this.initPaintIndexView);
      step('initCompareView', this.initCompareView);
      step('initModals', this.initModals);
      step('renderDatabaseTable', this.renderDatabaseTable);

      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
    },

    // -------------------------------------------------------------------------
    // HEADER TICKER — real figures, computed from what actually loaded
    // -------------------------------------------------------------------------
    renderTicker: function() {
      const total = JDM_DATABASE._totalRecords || 0;
      const el = document.getElementById('ticker-total');
      if (el) el.textContent = total ? total.toLocaleString() + ' chassis records' : 'none loaded';
    },

    // -------------------------------------------------------------------------
    // LOAD FAILURE BANNER
    // -------------------------------------------------------------------------
    // If the FAST records could not be fetched, say so on the page instead of
    // leaving every counter stuck on "Loading..." with the reason buried in
    // the console.
    showLoadError: function() {
      if (!JDM_DATABASE.loadError) return;

      const banner = document.createElement('div');
      banner.id = 'db-load-error';
      banner.setAttribute('role', 'alert');
      banner.style.cssText =
        'margin:16px 24px;padding:14px 18px;border:1px solid var(--gtr-red);border-left-width:4px;' +
        'border-radius:var(--radius-md, 8px);background:var(--gtr-red-soft, rgba(189,22,32,0.08));' +
        'color:var(--text-primary, #191c20);' +
        'font-family:var(--font-mono, monospace);font-size:0.85rem;line-height:1.55;';
      banner.innerHTML =
        '<strong style="display:block;margin-bottom:6px;color:var(--gtr-red);">FACTORY RECORDS NOT LOADED</strong>' +
        JDM_DATABASE.loadError;

      const host = document.querySelector('main') || document.body;
      host.insertBefore(banner, host.firstChild);
    },

    // -------------------------------------------------------------------------
    // MODEL DROPDOWNS — built from the live database, never hardcoded
    // -------------------------------------------------------------------------
    // The markup used to ship a static option list containing chassis codes that
    // no longer exist in JDM_DATABASE.models (ER34_COUPE, ER33_ENR33, KPGC10,
    // R35, ...). Selecting one resolved to no model and silently produced an
    // empty view. Generating them here keeps every dropdown in sync with the
    // 17 models that actually have FAST records.
    populateModelSelects: function() {
      const byGeneration = (isLegend) => {
        const out = {};
        Object.keys(JDM_DATABASE.models).forEach(key => {
          if (isLegend !== null && JDM_DATABASE.isLegend(key) !== isLegend) return;
          const m = JDM_DATABASE.models[key];
          const gen = m.generation || 'Other';
          (out[gen] = out[gen] || []).push(key);
        });
        return out;
      };

      const optionsHTML = (groups, allValue, allLabel) => {
        let html = allValue ? `<option value="${allValue}">${allLabel}</option>` : '';
        Object.keys(groups).forEach(gen => {
          html += `<optgroup label="${gen}">`;
          groups[gen].forEach(key => {
            const m = JDM_DATABASE.models[key];
            const n = (JDM_DATABASE._byPrefix[key] || []).length;
            const label = n ? `${m.shortName || key} — ${n.toLocaleString()} VINs` : (m.shortName || key);
            html += `<option value="${key}">${label}</option>`;
          });
          html += '</optgroup>';
        });
        return html;
      };

      [
        { id: 'filter-model',          groups: byGeneration(false), allValue: 'ALL_SKYLINE', allLabel: 'All Skyline Generations', preferred: this.currentModel },
        { id: 'legends-filter-model',  groups: byGeneration(true),  allValue: 'ALL_LEGENDS',  allLabel: 'All Nissan Legends',      preferred: this.currentLegendsModel },
        { id: 'stats-model-selector',  groups: byGeneration(null),  allValue: null,           allLabel: '',                        preferred: this.currentModel },
        { id: 'calc-model-select',     groups: byGeneration(null),  allValue: null,           allLabel: '',                        preferred: 'BNR34' }
      ].forEach(({ id, groups, allValue, allLabel, preferred }) => {
        const sel = document.getElementById(id);
        if (!sel) return;
        sel.innerHTML = optionsHTML(groups, allValue, allLabel);
        if (JDM_DATABASE.models[preferred]) sel.value = preferred;
      });
    },

    // -------------------------------------------------------------------------
    // MODEL QUICK STRIP & HERO BANNER
    // -------------------------------------------------------------------------
    // Skyline VIN Database and the Nissan Legends tab are two separate
    // browsing contexts (own model strip, own current model, own page
    // state) that otherwise behave identically — this config is what lets
    // one set of functions drive both instead of duplicating them.
    _dbViewConfig: {
      skyline: { prefix: '', pageProp: 'dbPage', modelProp: 'currentModel', stripId: 'model-strip', allScope: 'ALL_SKYLINE', isLegend: false },
      legends: { prefix: 'legends-', pageProp: 'legendsPage', modelProp: 'currentLegendsModel', stripId: 'legends-model-strip', allScope: 'ALL_LEGENDS', isLegend: true }
    },

    renderModelStrip: function(which) {
      const cfg = this._dbViewConfig[which];
      const container = document.getElementById(cfg.stripId);
      if (!container) return;

      // Grouped by generation and collapsed by default — only the group
      // holding the current model opens automatically, so switching models
      // doesn't dump every chassis card on screen at once.
      const byGeneration = {};
      Object.keys(JDM_DATABASE.models).forEach(modelKey => {
        if (JDM_DATABASE.isLegend(modelKey) !== cfg.isLegend) return;
        const m = JDM_DATABASE.models[modelKey];
        const gen = m.generation || 'Other';
        (byGeneration[gen] = byGeneration[gen] || []).push(modelKey);
      });
      const currentModel = this[cfg.modelProp];
      const currentGen = JDM_DATABASE.models[currentModel]?.generation;

      container.innerHTML = '';
      Object.keys(byGeneration).forEach(gen => {
        const keys = byGeneration[gen];

        const details = document.createElement('details');
        details.className = 'model-gen-group';
        details.setAttribute('data-gen', gen);
        // On a phone, auto-opening the current generation still means
        // scrolling past 5-6 cards before reaching any real VIN data — so
        // the strip starts fully collapsed there, and only auto-opens on
        // wider screens where that's a convenience rather than an obstacle.
        if (gen === currentGen && window.innerWidth > 768) details.open = true;

        const summary = document.createElement('summary');
        summary.innerHTML = `
          <span class="model-gen-label">${gen}</span>
          <span class="model-gen-count">${keys.length} model${keys.length === 1 ? '' : 's'}</span>
        `;
        details.appendChild(summary);

        const grid = document.createElement('div');
        grid.className = 'model-quick-strip';

        keys.forEach(modelKey => {
          const m = JDM_DATABASE.models[modelKey];
          const btn = document.createElement('div');
          btn.className = `model-card-btn ${modelKey === currentModel ? 'active' : ''}`;
          const recCount = JDM_DATABASE._byPrefix[modelKey] ? JDM_DATABASE._byPrefix[modelKey].length : 0;
          btn.innerHTML = `
            <span class="m-code">${m.shortName || modelKey}</span>
            <span class="m-name">${m.generation || m.name}</span>
            <span class="m-count">${recCount > 0 ? recCount.toLocaleString() + ' VINs' : (JDM_DATABASE._loaded ? 'No data' : 'Loading...')}</span>
          `;
          btn.addEventListener('click', () => {
            this.switchCurrentModel(modelKey, which);
          });
          grid.appendChild(btn);
        });

        details.appendChild(grid);
        container.appendChild(details);
      });
    },

    // Back-compat name — Stats & Rarity / Tools always show every model
    // regardless of which VIN tab is active, so they still need the full
    // populateModelSelects() pass; this is just the Skyline strip specifically.
    renderModelQuickStrip: function() {
      this.renderModelStrip('skyline');
    },

    switchCurrentModel: function(modelKey, which) {
      which = which || (JDM_DATABASE.isLegend(modelKey) ? 'legends' : 'skyline');
      const cfg = this._dbViewConfig[which];
      this[cfg.modelProp] = modelKey;
      const modelData = JDM_DATABASE.models[modelKey];

      // Update this context's own model strip active state + open group —
      // the other context's strip (Skyline vs Legends) is untouched.
      const strip = document.getElementById(cfg.stripId);
      if (strip) {
        strip.querySelectorAll('.model-card-btn').forEach(btn => {
          const code = btn.querySelector('.m-code').textContent;
          btn.classList.toggle('active', code === (modelData?.shortName || modelKey));
        });
        if (modelData?.generation) {
          strip.querySelectorAll('.model-gen-group').forEach(d => {
            d.open = d.getAttribute('data-gen') === modelData.generation;
          });
        }
      }

      // Update Hero Banner
      const heroTitle = document.getElementById('hero-model-title');
      const heroSub = document.getElementById('hero-model-subtitle');
      if (heroTitle && modelData) {
        const recCount = JDM_DATABASE._byPrefix[modelKey] ? JDM_DATABASE._byPrefix[modelKey].length : 0;
        heroTitle.textContent = `${modelData.name} Database`;
        heroSub.textContent = `${modelData.description} ${recCount > 0 ? recCount.toLocaleString() + ' confirmed VINs' : ''} (${modelData.years}).`;
      }

      // Sync this context's own VIN Database filter + table
      const filterModel = document.getElementById(cfg.prefix + 'filter-model');
      if (filterModel) {
        filterModel.value = modelKey;
        this.updateDbFiltersForModel(which, modelKey);
        this[cfg.pageProp] = 1;
        this.renderDbTable(which);
      }

      // Sync Stats View
      const statsModelSelector = document.getElementById('stats-model-selector');
      if (statsModelSelector) {
        statsModelSelector.value = modelKey;
        this.renderStatsView(modelKey);
      }

      // Sync Rarity Calculator
      const calcModelSelect = document.getElementById('calc-model-select');
      if (calcModelSelect) {
        calcModelSelect.value = modelKey;
        this.updateRarityOptionsForModel(modelKey);
      }
    },

    // -------------------------------------------------------------------------
    // NAVIGATION TABS
    // -------------------------------------------------------------------------
    initNavigation: function() {
      const tabButtons = document.querySelectorAll('.nav-tab-btn, .tab-link');
      tabButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const targetTabId = btn.getAttribute('data-tab');
          if (targetTabId) {
            this.switchTab(targetTabId);
          }
        });
      });

      document.getElementById('hero-explore-btn')?.addEventListener('click', () => this.switchTab('database-view'));
      document.getElementById('hero-stats-btn')?.addEventListener('click', () => this.switchTab('stats-view'));
      document.getElementById('hero-calc-btn')?.addEventListener('click', () => {
        this.switchTab('stats-view');
        document.getElementById('rarity-calculator-block')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      document.getElementById('brand-home-btn')?.addEventListener('click', () => this.switchTab('database-view'));
    },

    switchTab: function(tabId) {
      this.currentTab = tabId;

      document.querySelectorAll('.nav-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
      });

      document.querySelectorAll('.view-section').forEach(sec => {
        sec.classList.toggle('active', sec.id === tabId);
      });

      // The hero banner and Skyline model strip sit above every view-section
      // by default, so the VIN Database tab always has quick model-switching
      // at hand. They don't belong on tabs that aren't primarily about
      // picking a car from that strip: Stats & Rarity and FAST Decoder have
      // their own in-section model selector/lookup, History is curated
      // general content, and Tools is reference material (paint index,
      // spotter's guide, compare). The Legends tab hides just the Skyline
      // strip (it has its own, inside the section) but keeps the hero, since
      // it stays usefully synced to whichever Legends model was last picked.
      const noModelContextTabs = ['stats-view', 'fast-decoder-view', 'history-view', 'tools-view'];
      const heroBanner = document.getElementById('hero-banner');
      const skylineStrip = document.getElementById('model-strip');
      const hideAll = noModelContextTabs.includes(tabId);
      if (heroBanner) heroBanner.style.display = hideAll ? 'none' : '';
      if (skylineStrip) skylineStrip.style.display = (hideAll || tabId === 'legends-view') ? 'none' : '';

      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }

      if (tabId === 'stats-view') {
        this.renderStatsView(this.currentModel);
      }

      // Hero banner reflects whichever model was synced last, Skyline or
      // Legends — re-sync it to this tab's own current model so switching
      // tabs doesn't leave a Skyline (or Legends) car showing in the hero.
      if (tabId === 'legends-view') {
        this.switchCurrentModel(this.currentLegendsModel, 'legends');
      } else if (tabId === 'database-view') {
        this.switchCurrentModel(this.currentModel, 'skyline');
      }
    },

    // -------------------------------------------------------------------------
    // TOOLS SUB-NAV — Paint Index / Spotter's Guide / Compare share one top-
    // level tab, switched independently of the main nav-tab-bar.
    // -------------------------------------------------------------------------
    initToolsSubNav: function() {
      const buttons = document.querySelectorAll('.tool-subtab-btn');
      buttons.forEach(btn => {
        btn.addEventListener('click', () => {
          const target = btn.getAttribute('data-toolview');
          buttons.forEach(b => b.classList.toggle('active', b === btn));
          document.querySelectorAll('.tool-subview').forEach(sec => {
            sec.classList.toggle('active', sec.id === target);
          });
          if (typeof lucide !== 'undefined') lucide.createIcons();
        });
      });
    },

    // -------------------------------------------------------------------------
    // GLOBAL SEARCH WITH INSTANT FAST VIN RESOLVER
    // -------------------------------------------------------------------------
    initGlobalSearch: function() {
      const searchInput = document.getElementById('global-search-input');
      if (!searchInput) return;

      window.addEventListener('keydown', (e) => {
        if (e.key === '/' && document.activeElement !== searchInput && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
          e.preventDefault();
          searchInput.focus();
        }
      });

      // Typing always just live-filters the table — it never pops the "not
      // found" modal mid-keystroke, since every VIN is "not found" until the
      // last digit is typed. Exact resolution only fires on Enter, when the
      // user has actually finished typing and means to jump to that record.
      // Silvia/Stagea/300ZX live in the separate Legends tab now, so a typed
      // chassis prefix has to route to whichever tab actually holds it.
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim().toUpperCase();
        if (query.length === 0) return;
        const which = this._whichForQuery(query);
        const cfg = this._dbViewConfig[which];
        this.switchTab(which === 'legends' ? 'legends-view' : 'database-view');
        const filterSearch = document.getElementById(cfg.prefix + 'filter-chassis-search');
        if (filterSearch) {
          filterSearch.value = query;
          this[cfg.pageProp] = 1;
          this.renderDbTable(which);
        }
      });

      searchInput.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        const query = e.target.value.trim().toUpperCase();
        // Just a minimum-length guard against firing on a query the user
        // obviously hasn't finished typing yet — the actual shape
        // validation (dash or no dash, JDM chassis+serial or a real
        // dash-less export VIN) belongs to resolveChassis/findChassis, not
        // here. An earlier version of this check required either a dash or
        // an 11-17 char string, which silently dropped valid dash-less JDM
        // lookups shorter than 11 characters (e.g. "ER34013961", 10 chars)
        // on the floor before resolveChassis ever ran.
        if (query.length < 6) return;
        const rec = JDM_DATABASE.resolveChassis(query);
        const which = rec ? (JDM_DATABASE.isLegend(rec.modelId) ? 'legends' : 'skyline') : this._whichForQuery(query);
        this.switchTab(which === 'legends' ? 'legends-view' : 'database-view');
        if (rec) {
          this.openChassisDetailModal(rec);
        } else {
          this.showVinNotFound(query);
        }
      });
    },

    // Best-effort guess of which VIN tab a partially-typed chassis prefix
    // belongs to, for routing the live search-filter before the number is
    // complete enough for resolveChassis to actually find a record.
    _whichForQuery: function(query) {
      const prefixMatch = query.match(/^[A-Z]+/);
      const prefix = prefixMatch ? prefixMatch[0] : '';
      const isLegendPrefix = Object.keys(JDM_DATABASE.models).some(k =>
        JDM_DATABASE.isLegend(k) && prefix && k.startsWith(prefix));
      return isLegendPrefix ? 'legends' : 'skyline';
    },

    // -------------------------------------------------------------------------
    // VIEW 1: VIN DATABASE EXPLORER WITH NISSAN FAST VIRTUAL GENERATOR
    // -------------------------------------------------------------------------
    initDatabaseView: function() {
      this.initDbView('skyline');
    },

    initLegendsView: function() {
      this.initDbView('legends');
    },

    initDbView: function(which) {
      const cfg = this._dbViewConfig[which];
      const p = cfg.prefix;
      const filterModel = document.getElementById(p + 'filter-model');
      const filterYear = document.getElementById(p + 'filter-year');
      const filterSeries = document.getElementById(p + 'filter-series');
      const filterTrim = document.getElementById(p + 'filter-trim');
      const filterTransmission = document.getElementById(p + 'filter-transmission');
      const filterColor = document.getElementById(p + 'filter-color');
      const filterMarket = document.getElementById(p + 'filter-market');
      const filterSearch = document.getElementById(p + 'filter-chassis-search');

      const refreshHandler = () => {
        this[cfg.pageProp] = 1;
        this.renderDbTable(which);
      };

      filterModel?.addEventListener('change', (e) => {
        const selected = e.target.value;
        if (selected !== cfg.allScope) {
          this[cfg.modelProp] = selected;
          this.updateDbFiltersForModel(which, selected);
        }
        refreshHandler();
      });

      filterYear?.addEventListener('change', refreshHandler);
      filterSeries?.addEventListener('change', refreshHandler);
      filterTrim?.addEventListener('change', refreshHandler);
      filterTransmission?.addEventListener('change', refreshHandler);
      filterColor?.addEventListener('change', refreshHandler);
      filterMarket?.addEventListener('change', refreshHandler);
      filterSearch?.addEventListener('input', refreshHandler);

      document.getElementById(p + 'btn-prev-page')?.addEventListener('click', () => {
        if (this[cfg.pageProp] > 1) {
          this[cfg.pageProp]--;
          this.renderDbTable(which);
        }
      });

      document.getElementById(p + 'btn-next-page')?.addEventListener('click', () => {
        this[cfg.pageProp]++;
        this.renderDbTable(which);
      });

      this.updateDbFiltersForModel(which, this[cfg.modelProp]);
      this.renderDbTable(which);
    },

    // Back-compat name — used by switchCurrentModel and elsewhere for the
    // Skyline VIN Database specifically.
    updateDatabaseFiltersForModel: function(modelKey) {
      this.updateDbFiltersForModel('skyline', modelKey);
    },

    updateDbFiltersForModel: function(which, modelKey) {
      const cfg = this._dbViewConfig[which];
      const p = cfg.prefix;
      const filterYear = document.getElementById(p + 'filter-year');
      const filterSeries = document.getElementById(p + 'filter-series');
      const filterTrim = document.getElementById(p + 'filter-trim');
      const filterTransmission = document.getElementById(p + 'filter-transmission');
      const filterColor = document.getElementById(p + 'filter-color');
      const filterMarket = document.getElementById(p + 'filter-market');

      // Filter values come from the database's own dictionaries rather than a
      // scan of every record — the store is columnar now, not an array.
      const vals = JDM_DATABASE.getFilterValues(modelKey);
      const stats = JDM_DATABASE.getModelStats(modelKey);

      // Build years, from the real dates actually present on this chassis —
      // works for every model, not just the ones with a known grade table.
      if (filterYear) {
        filterYear.innerHTML = '<option value="ALL">Any Build Year</option>';
        (stats ? stats.productionByYear : []).forEach(y => {
          if (y.year === 'Unknown') return;
          filterYear.innerHTML += `<option value="${y.year}">${y.year} — ${y.count.toLocaleString()}</option>`;
        });
      }

      // Series options, from the FAST series blocks actually present
      if (filterSeries) {
        filterSeries.innerHTML = '<option value="ALL">All Series</option>';
        (stats ? stats.seriesBreakdown : []).forEach(s => {
          filterSeries.innerHTML +=
            `<option value="${s.block}">${s.label} — ${s.count.toLocaleString()}</option>`;
        });
      }

      // Grade options, decoded from the factory model codes
      if (filterTrim) {
        filterTrim.innerHTML = '<option value="ALL">All Grades</option>';
        vals.grades.forEach(g => {
          filterTrim.innerHTML += `<option value="${g}">${g}</option>`;
        });
      }

      // Transmission options, decoded from the factory model code — empty on
      // chassis where it isn't confirmed (see _decodeTransmission), which
      // just leaves this dropdown at its default "All Transmissions".
      if (filterTransmission) {
        filterTransmission.innerHTML = '<option value="ALL">All Transmissions</option>';
        vals.transmissions.forEach(t => {
          filterTransmission.innerHTML += `<option value="${t}">${t}</option>`;
        });
      }

      // Paint options, ordered by how common each colour actually is on this
      // chassis, carrying its real share of the records.
      if (filterColor) {
        filterColor.innerHTML = '<option value="ALL">All Exterior Colors</option>';
        (stats ? stats.colorBreakdown : []).forEach(c => {
          filterColor.innerHTML +=
            `<option value="${c.code}">${c.code} — ${c.name} (${c.percent}%)</option>`;
        });
      }

      if (filterMarket) {
        filterMarket.innerHTML = '<option value="ALL">All Destinations</option><option value="JDM">Japan Domestic Market (JDM)</option>';
      }
    },

    // Back-compat name — used by switchCurrentModel, search handlers, and
    // elsewhere for the Skyline VIN Database specifically.
    renderDatabaseTable: function() {
      this.renderDbTable('skyline');
    },

    renderDbTable: function(which) {
      const cfg = this._dbViewConfig[which];
      const p = cfg.prefix;
      const tbody = document.getElementById(p + 'chassis-table-body');
      const countEl = document.getElementById(p + 'db-records-count');
      const pageInfo = document.getElementById(p + 'pagination-info');
      const btnPrev = document.getElementById(p + 'btn-prev-page');
      const btnNext = document.getElementById(p + 'btn-next-page');

      if (!tbody) return;

      const modelVal = document.getElementById(p + 'filter-model')?.value || this[cfg.modelProp];
      const yearVal = document.getElementById(p + 'filter-year')?.value || 'ALL';
      const seriesVal = document.getElementById(p + 'filter-series')?.value || 'ALL';
      const trimVal = document.getElementById(p + 'filter-trim')?.value || 'ALL';
      const transmissionVal = document.getElementById(p + 'filter-transmission')?.value || 'ALL';
      const colorVal = document.getElementById(p + 'filter-color')?.value || 'ALL';
      const marketVal = document.getElementById(p + 'filter-market')?.value || 'ALL';
      const searchVal = document.getElementById(p + 'filter-chassis-search')?.value.trim().toUpperCase() || '';

      const virtualData = JDM_DATABASE.getVirtualPage({
        modelId: modelVal,
        page: this[cfg.pageProp],
        pageSize: this.dbPageSize,
        search: searchVal,
        seriesFilter: seriesVal,
        gradeFilter: trimVal,
        transmissionFilter: transmissionVal,
        colorFilter: colorVal,
        yearFilter: yearVal
      });

      const records = virtualData.records;
      const totalRecords = virtualData.totalRecords;
      const totalPages = virtualData.totalPages;
      this[cfg.pageProp] = virtualData.page;

      const startIndex = (this[cfg.pageProp] - 1) * this.dbPageSize;

      if (countEl) {
        countEl.textContent = `Showing ${records.length > 0 ? startIndex + 1 : 0} - ${startIndex + records.length} of ${totalRecords.toLocaleString()} Nissan FAST records`;
      }
      if (pageInfo) {
        pageInfo.textContent = `Page ${this[cfg.pageProp].toLocaleString()} of ${totalPages.toLocaleString()}`;
      }
      if (btnPrev) btnPrev.disabled = this[cfg.pageProp] <= 1;
      if (btnNext) btnNext.disabled = this[cfg.pageProp] >= totalPages;

      if (records.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="5" style="text-align: center; padding: 40px; color: var(--text-muted);">
              <i data-lucide="search-x" style="width: 32px; height: 32px; margin-bottom: 8px; display: block; margin: 0 auto 8px;"></i>
              No chassis records matched. Type any valid VIN format like <strong>ER34-012345</strong> or <strong>BNR34-001234</strong> for instant resolution!
            </td>
          </tr>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
      }

      tbody.innerHTML = '';
      records.forEach(rec => {
        const tr = document.createElement('tr');
        const isGTR = rec.chassisNumber.includes('BNR') || rec.chassisNumber.includes('BCNR');

        tr.innerHTML = `
          <td>
            <span class="chassis-link" title="FAST key ${rec.chassisNumber}">
              ${isGTR ? '<span class="gtr-fin" title="GT-R"></span>'
                      : '<i data-lucide="file-text" style="width: 13px; height: 13px;"></i>'}
              ${rec.plateNumber || rec.chassisNumber}
            </span>
          </td>
          <td>
            <span style="font-weight: 500;">${rec.modelName}</span><br>
            <span style="font-size: 0.72rem; color: var(--text-muted);">${rec.series || ''}</span>
          </td>
          <td class="mono" style="font-size: 0.78rem;">${rec.buildDate || '—'}</td>
          <td>
            <span class="color-swatch-badge">
              <span class="color-dot" style="background-color: ${rec.colorHex || '#555'};"></span>
              <span>${rec.colorCode} ${rec.colorName ? '— ' + rec.colorName : ''}</span>
            </span>
          </td>
          <td class="mono" style="font-size: 0.74rem; color: var(--text-secondary); white-space: nowrap;" title="${rec.modelCode || ''}">${rec.modelCode || '—'}</td>
        `;

        tr.addEventListener('click', () => this.openChassisDetailModal(rec));

        tbody.appendChild(tr);
      });

      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
    },

    showVinNotFound: function(query) {
      const modal = document.getElementById('chassis-detail-modal');
      const body = document.getElementById('modal-detail-body');
      if (!modal || !body) return;
      body.innerHTML = `
        <div style="text-align: center; padding: 48px 24px;">
          <div style="font-size: 3rem; margin-bottom: 16px;">ðŸ”</div>
          <h2 style="color: var(--gtr-red); margin-bottom: 8px;">VIN Not Found in FAST Database</h2>
          <p style="color: var(--text-secondary); margin-bottom: 16px;">
            <code style="font-family: monospace; font-size: 1.1rem; color: var(--text-primary);">${query}</code>
          </p>
          <p style="color: var(--text-muted); font-size: 0.9rem; max-width: 400px; margin: 0 auto 24px;">
            This VIN was not found in the genuine Nissan FAST microfiche records sourced from <strong>H:\\AR-JP\\JP</strong>.
            Only VINs with confirmed factory records are shown. This may be an export model, a typo, or a VIN from a dataset not included in this FAST version.
          </p>
          <button class="btn-page" onclick="document.getElementById('chassis-detail-modal').classList.remove('active')">
            Close
          </button>
        </div>
      `;
      modal.classList.add('active');
    },

    // -------------------------------------------------------------------------
    // VIEW 2: PRODUCTION STATISTICS & MATRICES
    // -------------------------------------------------------------------------
    initStatsView: function() {
      const statsSelector = document.getElementById('stats-model-selector');
      statsSelector?.addEventListener('change', (e) => {
        this.renderStatsView(e.target.value);
      });
      this.renderStatsView(this.currentModel);
    },

    renderStatsView: function(modelKey) {
      const modelData = JDM_DATABASE.models[modelKey];
      if (!modelData) return;

      const stats = JDM_DATABASE.getModelStats(modelKey);
      if (!stats) {
        const metricsGrid = document.getElementById('stats-metrics-grid');
        if (metricsGrid) metricsGrid.innerHTML = '<p style="color:var(--text-muted);padding:24px;">Loading FAST records...</p>';
        return;
      }

      const headerTitle = document.getElementById('stats-header-title');
      if (headerTitle) headerTitle.textContent = `${modelData.name} Production Statistics`;

      const metricsGrid = document.getElementById('stats-metrics-grid');
      if (metricsGrid) {
        const topColor = stats.colorBreakdown[0];
        const topGrade = stats.gradeBreakdown[0];
        metricsGrid.innerHTML = `
          <div class="spec-card">
            <div class="spec-card-label">CONFIRMED FAST VINs</div>
            <div class="spec-card-value" style="color: var(--gtr-red); font-size: 1.3rem;">${stats.totalCount.toLocaleString()}</div>
          </div>
          <div class="spec-card">
            <div class="spec-card-label">PRODUCTION YEARS</div>
            <div class="spec-card-value">${modelData.years}</div>
          </div>
          <div class="spec-card">
            <div class="spec-card-label">MOST COMMON COLOR</div>
            <div class="spec-card-value">
              ${topColor ? `<span class="color-dot" style="background: ${topColor.hex}; display: inline-block; vertical-align: middle; margin-right: 4px;"></span>
              ${topColor.code} — ${topColor.name} (${topColor.percent}%)` : '—'}
            </div>
          </div>
          <div class="spec-card">
            <div class="spec-card-label">MOST COMMON GRADE</div>
            <div class="spec-card-value">${topGrade ? topGrade.grade + ' (' + topGrade.percent + '%)' : 'Standard'}</div>
          </div>
        `;
      }

      const colorTbody = document.getElementById('stats-color-table-body');
      if (colorTbody) {
        colorTbody.innerHTML = '';
        stats.colorBreakdown.forEach(c => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td class="mono"><strong>${c.code}</strong></td>
            <td>
              <span class="color-swatch-badge">
                <span class="color-dot" style="background-color: ${c.hex};"></span>
                <strong>${c.name}</strong>
              </span>
            </td>
            <td class="mono">${c.count.toLocaleString()}</td>
            <td class="mono"><strong>${c.percent}%</strong></td>
            <td>
              <div class="table-progress-wrap">
                <div class="table-progress-bar">
                  <div class="table-progress-fill" style="width: ${Math.min(100, parseFloat(c.percent) * 2.5)}%;"></div>
                </div>
              </div>
            </td>
            <td><span class="badge ${parseFloat(c.percent) < 2 ? 'badge-grail' : (parseFloat(c.percent) < 10 ? 'badge-collector' : 'badge-standard')}">${parseFloat(c.percent) < 2 ? 'Rare' : (parseFloat(c.percent) < 10 ? 'Uncommon' : 'Common')}</span></td>
          `;
          colorTbody.appendChild(tr);
        });
      }

      const trimTbody = document.getElementById('stats-trim-table-body');
      if (trimTbody) {
        trimTbody.innerHTML = '';
        stats.gradeBreakdown.forEach(g => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td><strong>${g.grade || 'Standard'}</strong></td>
            <td class="mono">${g.count.toLocaleString()}</td>
            <td class="mono"><strong>${g.percent}%</strong></td>
            <td>
              <div class="table-progress-wrap">
                <div class="table-progress-bar">
                  <div class="table-progress-fill" style="width: ${Math.min(100, parseFloat(g.percent) * 2.5)}%;"></div>
                </div>
              </div>
            </td>
            <td><span class="badge ${parseFloat(g.percent) < 10 ? 'badge-collector' : 'badge-standard'}">${parseFloat(g.percent) < 10 ? 'Rare Grade' : 'Production Grade'}</span></td>
          `;
          trimTbody.appendChild(tr);
        });
      }

      // Hidden entirely (not shown empty) on chassis where transmission
      // isn't decoded — Legends models, and the Skyline models where the
      // source data itself doesn't distinguish it (see database.js).
      const transmissionAccordion = document.getElementById('stats-transmission-accordion');
      const transmissionTbody = document.getElementById('stats-transmission-table-body');
      if (transmissionAccordion && transmissionTbody) {
        const hasData = stats.transmissionBreakdown && stats.transmissionBreakdown.length > 0;
        transmissionAccordion.style.display = hasData ? '' : 'none';
        if (hasData) {
          transmissionTbody.innerHTML = '';
          stats.transmissionBreakdown.forEach(t => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
              <td><strong>${t.transmission}</strong></td>
              <td class="mono">${t.count.toLocaleString()}</td>
              <td class="mono"><strong>${t.percent}%</strong></td>
              <td>
                <div class="table-progress-wrap">
                  <div class="table-progress-bar">
                    <div class="table-progress-fill" style="width: ${Math.min(100, parseFloat(t.percent) * 2.5)}%;"></div>
                  </div>
                </div>
              </td>
            `;
            transmissionTbody.appendChild(tr);
          });
        }
      }

      this.renderStatsMatrix(modelKey);
      this.renderStatsCharts(stats);
    },

    // Grade/series x paint color cross-tab — one cell per real combination,
    // e.g. "how many V-Spec II cars came in KH2." Hidden (with a note)
    // rather than shown empty when a chassis has no decoded grade/series to
    // cross-tabulate against, since a single-row matrix isn't useful.
    renderStatsMatrix: function(modelKey) {
      const table = document.getElementById('stats-matrix-table');
      const thead = document.getElementById('stats-matrix-thead');
      const tbody = document.getElementById('stats-matrix-table-body');
      const emptyNote = document.getElementById('stats-matrix-empty-note');
      if (!table || !thead || !tbody) return;

      const matrix = JDM_DATABASE.getGradeColorMatrix(modelKey);
      if (!matrix || !matrix.multiDimensional) {
        table.style.display = 'none';
        if (emptyNote) emptyNote.style.display = 'block';
        return;
      }
      table.style.display = '';
      if (emptyNote) emptyNote.style.display = 'none';

      const fmt = n => n > 0 ? n.toLocaleString() : '–';

      thead.innerHTML = `
        <tr>
          <th>Grade / Series</th>
          ${matrix.cols.map(c => `<th class="mono" title="${c.name}">${c.code}</th>`).join('')}
          <th>Total</th>
        </tr>
      `;

      tbody.innerHTML = '';
      matrix.rows.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${r.label}</strong></td>
          ${r.cells.map(n => `<td class="mono">${fmt(n)}</td>`).join('')}
          <td class="mono"><strong>${r.total.toLocaleString()}</strong></td>
        `;
        tbody.appendChild(tr);
      });

      const totalsRow = document.createElement('tr');
      totalsRow.className = 'matrix-totals-row';
      totalsRow.innerHTML = `
        <td><strong>Total</strong></td>
        ${matrix.cols.map(c => `<td class="mono">${c.total.toLocaleString()}</td>`).join('')}
        <td class="mono"><strong>${matrix.grandTotal.toLocaleString()}</strong></td>
      `;
      tbody.appendChild(totalsRow);

      const pctRow = document.createElement('tr');
      pctRow.className = 'matrix-totals-row';
      pctRow.innerHTML = `
        <td><strong>%</strong></td>
        ${matrix.cols.map(c => `<td class="mono">${(c.total / matrix.grandTotal * 100).toFixed(1)}%</td>`).join('')}
        <td class="mono">100%</td>
      `;
      tbody.appendChild(pctRow);
    },

    renderStatsCharts: function(stats) {
      if (typeof Chart === 'undefined') return;

      const colorCtx = document.getElementById('color-distribution-chart')?.getContext('2d');
      if (colorCtx && stats.colorBreakdown.length > 0) {
        if (this.colorChartInstance) this.colorChartInstance.destroy();

        const labels = stats.colorBreakdown.map(c => `${c.code} (${c.name})`);
        const data = stats.colorBreakdown.map(c => c.count);
        const bgColors = stats.colorBreakdown.map(c => c.hex);

        this.colorChartInstance = new Chart(colorCtx, {
          type: 'doughnut',
          data: {
            labels: labels,
            datasets: [{
              data: data,
              backgroundColor: bgColors,
              borderColor: '#101318',
              borderWidth: 2
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'right',
                labels: {
                  boxWidth: 12,
                  color: '#9ea7b3',
                  font: { family: 'Inter', size: 11 }
                }
              }
            }
          }
        });
      }

      const timeCtx = document.getElementById('production-timeline-chart')?.getContext('2d');
      if (timeCtx && stats.productionByYear.length > 0) {
        if (this.timelineChartInstance) this.timelineChartInstance.destroy();

        const timeLabels = stats.productionByYear.map(p => p.year);
        const timeData = stats.productionByYear.map(p => p.count);

        this.timelineChartInstance = new Chart(timeCtx, {
          type: 'bar',
          data: {
            labels: timeLabels,
            datasets: [{
              label: 'Units Built',
              data: timeData,
              backgroundColor: 'rgba(229, 27, 36, 0.7)',
              borderColor: '#e51b24',
              borderWidth: 1,
              borderRadius: 4
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              y: {
                grid: { color: 'rgba(255, 255, 255, 0.05)' },
                ticks: { color: '#9ea7b3', font: { family: 'JetBrains Mono', size: 11 } }
              },
              x: {
                grid: { display: false },
                ticks: { color: '#9ea7b3', font: { family: 'JetBrains Mono', size: 11 } }
              }
            },
            plugins: {
              legend: { display: false }
            }
          }
        });
      }
    },

    // -------------------------------------------------------------------------
    // VIEW 3: NISSAN FAST MODEL CODE DECODER
    // -------------------------------------------------------------------------
    initFastDecoderView: function() {
      const inputEl = document.getElementById('fast-input-string');
      const modelSel = document.getElementById('decoder-model-select');

      // Chassis lookup — the number people actually have in front of them
      const lookup = () => this.decodeFromChassis(
        document.getElementById('decoder-chassis-input')?.value || '');
      document.getElementById('btn-decode-chassis')?.addEventListener('click', lookup);
      document.getElementById('decoder-chassis-input')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') lookup();
      });

      // Chassis picker for the "codes that exist" panel
      if (modelSel) {
        modelSel.innerHTML = '';
        Object.keys(JDM_DATABASE.models).forEach(key => {
          const m = JDM_DATABASE.models[key];
          const n = (JDM_DATABASE._byPrefix[key] || {}).length || 0;
          if (!n) return;
          modelSel.innerHTML +=
            `<option value="${key}">${m.shortName || key} — ${n.toLocaleString()} records</option>`;
        });
        modelSel.value = 'BNR34';
        modelSel.addEventListener('change', e => this.renderDecoderChips(e.target.value));
      }

      document.getElementById('btn-run-fast-decode')?.addEventListener('click', () => {
        if (inputEl) this.runFastDecode(inputEl.value);
      });
      inputEl?.addEventListener('keydown', e => {
        if (e.key === 'Enter') this.runFastDecode(inputEl.value);
      });

      // Character key — one per generation, because the layouts differ
      const keySel = document.getElementById('decoder-key-gen');
      if (keySel) {
        const gens = MODEL_DECODER.generations();
        keySel.innerHTML = gens.map(g => `<option value="${g}">${g} character key</option>`).join('');
        keySel.value = gens.includes('R34') ? 'R34' : gens[0];
        keySel.addEventListener('change', e => this.renderCharacterKey(e.target.value));
        this.renderCharacterKey(keySel.value);
      }

      this.renderDecoderChips(modelSel ? modelSel.value : 'BNR34');
      this.runFastDecode(inputEl ? inputEl.value : '');
    },

    // -------------------------------------------------------------------------
    // CHARACTER KEY
    // -------------------------------------------------------------------------
    renderCharacterKey: function(gen) {
      const host = document.getElementById('decoder-key-body');
      if (!host) return;
      const table = MODEL_DECODER.keyTable(gen);
      if (!table.length) { host.innerHTML = '<p class="decoder-hint">No records for this generation.</p>'; return; }

      host.innerHTML = table.map(row => {
        if (!row.chars.length) return '';
        const chars = row.chars.map(c => `
          <div class="key-char ${c.kind}">
            <span class="key-char-val mono">${c.shown}</span>
            <div class="key-char-body">
              <span class="key-char-headline">${c.headline || 'Not pinned down'}</span>
              <span class="key-char-note">${c.note}</span>
            </div>
            <span class="key-char-n mono">${c.records.toLocaleString()}</span>
          </div>`).join('');
        return `<div class="key-position">
                  <div class="key-position-label">Position ${row.pos}</div>
                  <div class="key-char-list">${chars}</div>
                </div>`;
      }).join('');
    },

    // -------------------------------------------------------------------------
    // BUILD SUMMARY — what the car actually is
    // -------------------------------------------------------------------------
    renderBuildSummary: function(record) {
      const host = document.getElementById('decoder-build-summary');
      if (!host) return;
      if (!record) { host.innerHTML = ''; return; }

      const b = MODEL_DECODER.explainBuild(record);
      if (!b) { host.innerHTML = ''; return; }

      const spec = b.spec.map(([k, v]) => `
        <div class="build-spec">
          <span class="build-spec-k">${k}</span>
          <span class="build-spec-v ${k === 'Factory code' || k === 'Chassis' ? 'mono' : ''}">${v}</span>
        </div>`).join('');

      const confirm = b.confirmModel
        ? `<div class="build-option build-option-quiet">
             <span>${b.confirmModel} further character${b.confirmModel === 1 ? '' : 's'}
             simply confirm this is a ${record.modelId}.</span>
           </div>` : '';
      const opts = (b.options.length || b.confirmModel) ? `
        <div class="build-options">
          <div class="build-options-title">Read from the factory code</div>
          ${b.options.map(o => `
            <div class="build-option">
              <span class="mono build-option-char">${o.char}</span>
              <span>${o.text}</span>
              <span class="decoder-chip-count">pos ${o.pos}</span>
            </div>`).join('')}
          ${confirm}
        </div>` : '';

      const rarity = [];
      if (b.paintShare) {
        // toFixed(1) turns 91 cars in 144,097 into "0.0%", which reads as none
        const total = JDM_DATABASE.getModelRecordCount(record.modelId);
        const raw = total ? (b.paintShare.count / total) * 100 : 0;
        const pct = raw >= 1 ? raw.toFixed(1) : raw.toFixed(2);
        rarity.push(`${b.paintShare.name} accounts for ${pct}% of this chassis
                     (${b.paintShare.count.toLocaleString()} of ${total.toLocaleString()} cars).`);
      }
      if (b.sharedCode) {
        rarity.push(`${b.sharedCode.toLocaleString()} car${b.sharedCode === 1 ? '' : 's'}
                     in the archive carr${b.sharedCode === 1 ? 'ies' : 'y'} this exact factory code.`);
      }

      host.innerHTML = `
        <div class="guide-card build-card">
          <h4 class="decoder-step"><span class="step-num">&#10003;</span> What this car is</h4>
          <p class="build-sentence">${b.sentence}</p>
          <div class="build-spec-grid">${spec}</div>
          ${opts}
          ${rarity.length ? `<p class="build-rarity">${rarity.join(' ')}</p>` : ''}
        </div>`;
    },

    // Real codes for a chassis, replacing the invented preset list that used to
    // sit here — none of those codes existed in the data.
    renderDecoderChips: function(modelId) {
      const wrap = document.getElementById('decoder-code-chips');
      if (!wrap) return;
      const codes = MODEL_DECODER.topCodesFor(modelId, 8);
      if (!codes.length) {
        wrap.innerHTML = '<span class="decoder-hint">No codes loaded for this chassis.</span>';
        return;
      }
      wrap.innerHTML = codes.map(c => `
        <button class="decoder-chip" data-code="${c.code}">
          <span class="mono">${c.code}</span>
          <span class="decoder-chip-count">${c.records.toLocaleString()} cars</span>
        </button>`).join('');

      wrap.querySelectorAll('.decoder-chip').forEach(btn => {
        btn.addEventListener('click', () => {
          const code = btn.getAttribute('data-code');
          const input = document.getElementById('fast-input-string');
          if (input) input.value = code;
          this.runFastDecode(code);
          document.getElementById('decoder-code-panel')
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });
    },

    decodeFromChassis: function(value) {
      const box = document.getElementById('decoder-chassis-result');
      if (!box) return;
      const hits = JDM_DATABASE.findChassis(value);

      if (!hits.length) {
        box.innerHTML = `<div class="decoder-miss">No record for <span class="mono">${
          (value || '').toUpperCase()}</span>. Try a number like BNR34-000051 or ECR33-014520.</div>`;
        this.renderBuildSummary(null);
        return;
      }

      box.innerHTML = hits.map(h => `
        <div class="decoder-hit">
          <div>
            <span class="mono decoder-hit-vin">${h.plateNumber}</span>
            <span class="decoder-hit-meta">${h.modelName} &middot; ${h.buildDate} &middot; ${h.colorName}${
              h.series ? ' &middot; ' + h.series : ''}</span>
          </div>
          <button class="btn-page" data-code="${h.modelCode}">Decode ${h.modelCode}</button>
        </div>`).join('');

      box.querySelectorAll('button[data-code]').forEach(btn => {
        btn.addEventListener('click', () => {
          const code = btn.getAttribute('data-code');
          const input = document.getElementById('fast-input-string');
          if (input) input.value = code;
          this.runFastDecode(code);
          document.getElementById('decoder-code-panel')
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });

      // decode the first hit straight away, and say what the car is
      if (hits[0]) {
        this.renderBuildSummary(hits[0]);
        if (hits[0].modelCode) {
          const input = document.getElementById('fast-input-string');
          if (input) input.value = hits[0].modelCode;
          this.runFastDecode(hits[0].modelCode);
        }
      }
    },

    runFastDecode: function(codeStr) {
      const outArea = document.getElementById('fast-decoded-output-area');
      const noteEl = document.getElementById('decoder-layout-note');
      if (!outArea) return;

      const code = (codeStr || '').toUpperCase().trim();
      if (!code) { outArea.innerHTML = ''; return; }

      const decoded = MODEL_DECODER.decode(code);
      if (!decoded) { outArea.innerHTML = ''; return; }

      // Layout banner — states plainly that R32 and R33/34 differ
      if (noteEl) {
        noteEl.innerHTML = decoded.knownGeneration
          ? `<span class="decoder-gen-badge">${decoded.generation}</span>
             <span>${decoded.layoutNote}</span>`
          : `<span class="decoder-gen-badge warn">?</span>
             <span>This code does not end in a chassis family the archive holds
             (${Object.keys(MODEL_DECODER.LAYOUTS).join(', ')}), so no per-position
             evidence is available for it.</span>`;
      }

      const profile = MODEL_DECODER.profile(code);

      // ---- character strip ------------------------------------------------
      const chars = decoded.chars.map(c => {
        const m = c.meaning;
        const cls = !m ? 'unknown' : (m.kind === 'constant' ? 'constant'
                   : m.kind === 'derived' ? 'derived' : 'observed');
        const title = m ? `${m.label}: ${m.detail}` : `Position ${c.pos}`;
        return `<div class="plate-char ${cls}${c.blank ? ' blank' : ''}" title="${title}">
                  <span class="plate-char-pos">${c.pos}</span>
                  <span class="plate-char-val">${c.char === ' ' ? '&middot;' : c.char}</span>
                </div>`;
      }).join('');

      const suffix = `<div class="plate-char suffix" title="Chassis family, present on every code">
                        <span class="plate-char-pos">end</span>
                        <span class="plate-char-val">${decoded.suffix}</span>
                      </div>`;

      // ---- per-position evidence -----------------------------------------
      const rows = decoded.chars.map(c => {
        const m = c.meaning;
        if (!m) {
          return `<tr><td class="mono">${c.pos}</td><td class="mono strong">${c.char}</td>
                  <td colspan="2" class="decoder-muted">No evidence in the archive</td></tr>`;
        }
        const badge = m.kind === 'derived' ? '<span class="badge badge-verified">from the data</span>'
                    : m.kind === 'constant' ? '<span class="badge badge-standard">no information</span>'
                    : '<span class="badge badge-collector">observed</span>';
        const chassis = m.chassis.length && m.chassis.length <= 6
          ? m.chassis.join(', ')
          : (m.chassis.length ? m.chassis.length + ' chassis' : '—');
        return `<tr>
            <td class="mono">${c.pos}</td>
            <td class="mono strong">${c.char === ' ' ? '&middot;' : c.char}</td>
            <td><strong>${m.label}</strong> ${badge}<br>
                <span class="decoder-muted">${m.detail}</span></td>
            <td class="mono decoder-muted">${chassis}</td>
          </tr>`;
      }).join('');

      // ---- what the archive knows about this exact code -------------------
      let profileHTML = '';
      if (profile) {
        const paint = profile.paint.slice(0, 6).map(p => `
          <span class="decoder-paint">
            <span class="color-dot" style="background:${p.hex}"></span>
            ${p.code} ${p.percent}%
          </span>`).join('');
        profileHTML = `
          <div class="guide-card decoder-profile">
            <h4 class="decoder-step">Cars carrying this exact code</h4>
            <div class="decoder-stat-row">
              <div class="decoder-stat"><span class="decoder-stat-n">${profile.records.toLocaleString()}</span>
                   <span class="decoder-stat-l">records</span></div>
              <div class="decoder-stat"><span class="decoder-stat-n">${profile.firstBuild || '—'}</span>
                   <span class="decoder-stat-l">first built</span></div>
              <div class="decoder-stat"><span class="decoder-stat-n">${profile.lastBuild || '—'}</span>
                   <span class="decoder-stat-l">last built</span></div>
              <div class="decoder-stat"><span class="decoder-stat-n">${
                   profile.chassis.map(([c, n]) => c).join(', ')}</span>
                   <span class="decoder-stat-l">chassis</span></div>
            </div>
            ${profile.grades.length ? `<p class="decoder-hint" style="margin-top:10px;">Grade:
              ${profile.grades.map(([g, n]) => `${g} (${n.toLocaleString()})`).join(', ')}</p>` : ''}
            <div class="decoder-paint-row">${paint}</div>
          </div>`;
      } else {
        profileHTML = `
          <div class="guide-card decoder-profile">
            <h4 class="decoder-step">Cars carrying this exact code</h4>
            <p class="decoder-hint">No car in the archive carries this code. If you typed it by hand,
            check it against a chassis number above &mdash; the archive holds
            ${(MODEL_DECODER.buildIndex() ? MODEL_DECODER.buildIndex().codeInfo.size : 0).toLocaleString()}
            distinct codes.</p>
          </div>`;
      }

      // ---- one character away ---------------------------------------------
      const sibs = MODEL_DECODER.siblings(code, 10);
      const sibHTML = sibs.length ? `
        <div class="guide-card">
          <h4 class="decoder-step">One character away</h4>
          <p class="decoder-hint">Real codes that differ from this one in a single position &mdash;
             the clearest way to see what that position actually controls.</p>
          <div class="decoder-sib-list">
            ${sibs.map(s => `
              <button class="decoder-sib" data-code="${s.code}">
                <span class="mono">${s.code}</span>
                <span class="decoder-sib-diff">pos ${s.pos}: ${s.from === ' ' ? '·' : s.from} &rarr; ${s.to === ' ' ? '·' : s.to}</span>
                <span class="decoder-chip-count">${s.records.toLocaleString()} cars</span>
              </button>`).join('')}
          </div>
        </div>` : '';

      outArea.innerHTML = `
        <div class="guide-card" style="margin-bottom: 20px;">
          <h4 class="decoder-step">The code, character by character</h4>
          <div class="plate-strip">${chars}${suffix}</div>
          <div class="decoder-legend">
            <span><i class="key derived"></i> meaning derived from the records</span>
            <span><i class="key observed"></i> observed, not yet explained</span>
            <span><i class="key constant"></i> identical on every car of this generation</span>
          </div>
          <div class="table-responsive" style="margin-top: 16px;">
            <table class="registry-table decoder-table">
              <thead><tr><th style="width:60px;">Pos</th><th style="width:60px;">Char</th>
                         <th>What the archive shows</th><th style="width:220px;">Chassis using it</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>
        ${profileHTML}
        ${sibHTML}
      `;

      outArea.querySelectorAll('.decoder-sib').forEach(btn => {
        btn.addEventListener('click', () => {
          const c = btn.getAttribute('data-code');
          const input = document.getElementById('fast-input-string');
          if (input) input.value = c;
          this.runFastDecode(c);
        });
      });

      if (typeof lucide !== 'undefined') lucide.createIcons();
    },

    // -------------------------------------------------------------------------
    // VIEW 4: RARITY CALCULATOR & CERTIFICATE GENERATOR
    // -------------------------------------------------------------------------
    initRarityCalculatorView: function() {
      const modelSelect = document.getElementById('calc-model-select');
      const calcBtn = document.getElementById('btn-calculate-rarity');

      modelSelect?.addEventListener('change', (e) => {
        this.updateRarityOptionsForModel(e.target.value);
        this.runRarityCalculation();
      });

      calcBtn?.addEventListener('click', () => {
        this.runRarityCalculation();
      });

      this.updateRarityOptionsForModel(modelSelect?.value || 'BNR34');
      this.runRarityCalculation();
    },

    updateRarityOptionsForModel: function(modelKey) {
      const trimSelect = document.getElementById('calc-trim-select');
      const colorSelect = document.getElementById('calc-color-select');
      const stats = JDM_DATABASE.getModelStats(modelKey);

      if (trimSelect) {
        trimSelect.innerHTML = '';
        const grades = (stats && stats.gradeBreakdown.length)
          ? stats.gradeBreakdown.map(g => g.grade)
          : ['Standard'];
        grades.forEach(g => {
          trimSelect.innerHTML += `<option value="${g}">${g}</option>`;
        });
      }

      // Paint options carry their real share of the model's records, which is
      // what the rarity maths uses.
      if (colorSelect) {
        colorSelect.innerHTML = '';
        (stats ? stats.colorBreakdown : []).forEach(c => {
          colorSelect.innerHTML +=
            `<option value="${c.code}">${c.code} — ${c.name} (${c.percent}%)</option>`;
        });
      }
    },

    runRarityCalculation: function() {
      const modelId = document.getElementById('calc-model-select')?.value || 'BNR34';
      const trim = document.getElementById('calc-trim-select')?.value || 'V-Spec II';
      const colorCode = document.getElementById('calc-color-select')?.value || 'TV2';
      const vinInput = document.getElementById('calc-vin-input')?.value.trim() || 'SKYLINE-REGISTERED';

      const options = [];
      if (document.getElementById('opt-cold-weather')?.checked) options.push('cold_weather');
      if (document.getElementById('opt-carbon')?.checked) options.push('carbon_spoiler');
      if (document.getElementById('opt-leather')?.checked) options.push('leather_interior');
      if (document.getElementById('opt-navi')?.checked) options.push('navi_audio');

      const result = RARITY_CALCULATOR.calculateRarity({
        modelId,
        trim,
        colorCode,
        options
      });

      const resultArea = document.getElementById('calc-result-area');
      if (!resultArea || !result) return;

      const certHTML = RARITY_CALCULATOR.generateCertificateHTML(result, vinInput);

      resultArea.innerHTML = `
        <div style="margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-family: var(--font-display); font-size: 1rem; color: var(--text-primary);">AUTHENTICITY SKYLINE SPECIFICATION CERTIFICATE</span>
          <button class="btn-page" id="btn-print-certificate" style="display: flex; align-items: center; gap: 6px;">
            <i data-lucide="printer" style="width: 14px; height: 14px;"></i>
            <span>Print / Save Certificate</span>
          </button>
        </div>
        ${certHTML}
      `;

      document.getElementById('btn-print-certificate')?.addEventListener('click', () => {
        window.print();
      });

      if (typeof lucide !== 'undefined') lucide.createIcons();
    },

    // -------------------------------------------------------------------------
    // MODEL CONFIGURATION GUIDE — engine/drivetrain/gearbox per chassis, read
    // straight from JDM_DATABASE.models so it can't drift from the rest of
    // the site. Grouped by generation, collapsed except the current one.
    // -------------------------------------------------------------------------
    renderConfigGuide: function() {
      const container = document.getElementById('config-guide-groups');
      if (!container) return;

      const byGeneration = {};
      Object.keys(JDM_DATABASE.models).forEach(modelKey => {
        const m = JDM_DATABASE.models[modelKey];
        const gen = m.generation || 'Other';
        (byGeneration[gen] = byGeneration[gen] || []).push(modelKey);
      });
      const currentGen = JDM_DATABASE.models[this.currentModel]?.generation;

      container.innerHTML = '';
      Object.keys(byGeneration).forEach(gen => {
        const keys = byGeneration[gen];

        const details = document.createElement('details');
        details.className = 'model-gen-group';
        details.setAttribute('data-gen', gen);
        if (gen === currentGen) details.open = true;

        const summary = document.createElement('summary');
        summary.innerHTML = `
          <span class="model-gen-label">${gen}</span>
          <span class="model-gen-count">${keys.length} model${keys.length === 1 ? '' : 's'}</span>
        `;
        details.appendChild(summary);

        const list = document.createElement('div');
        list.className = 'config-guide-list';
        keys.forEach(modelKey => {
          const m = JDM_DATABASE.models[modelKey];
          const row = document.createElement('div');
          row.className = 'config-guide-row';
          row.innerHTML = `
            <div class="config-guide-row-head">
              <span class="config-guide-code">${m.shortName || modelKey}</span>
              <span class="config-guide-chassis mono">${m.chassisCode || modelKey}</span>
            </div>
            <div class="config-guide-name">${m.name}</div>
            <div class="config-guide-specs">
              <span><strong>Engine</strong> ${m.engine || '—'}</span>
              <span><strong>Trans</strong> ${m.transmission || '—'}</span>
              <span><strong>Drivetrain</strong> ${m.drivetrain || '—'}</span>
            </div>
            ${m.description ? `<p class="config-guide-desc">${m.description}</p>` : ''}
          `;
          list.appendChild(row);
        });
        details.appendChild(list);
        container.appendChild(details);
      });
    },

    // -------------------------------------------------------------------------
    // VIEW 6: OEM PAINT CODE INDEX
    // -------------------------------------------------------------------------
    initPaintIndexView: function() {
      this.renderConfigGuide();

      const container = document.getElementById('paint-cards-grid');
      if (!container) return;

      container.innerHTML = '';
      PAINT_INDEX.forEach(p => {
        // One malformed hero-card entry must never take down the archive-wide
        // table below it — that table is the part that's actually accurate
        // (it's derived from the FAST records), so a curation typo up here
        // shouldn't be able to blank it out.
        try {
          const card = document.createElement('div');
          card.className = 'paint-card';
          card.innerHTML = `
            <div class="paint-color-banner" style="background: ${p.hex};">
              <span class="paint-code-tag">${p.code}</span>
            </div>
            <div class="paint-card-body">
              <h4 class="paint-title">${p.name}</h4>
              <div class="paint-specs">
                <div><span>Finish:</span> <strong>${p.finish}</strong></div>
                <div><span>Models:</span> <strong>${p.models.join(', ')}</strong></div>
                <div><span>Volume:</span> <strong>${(p.totalProduced || 0).toLocaleString()} Units</strong></div>
                <div><span>Rarity:</span> <strong>${p.rarityScore}</strong></div>
              </div>
              <p class="paint-desc">${p.notes}</p>
            </div>
          `;
          container.appendChild(card);
        } catch (e) {
          console.error('BPZILLA: bad PAINT_INDEX entry —', p && p.code, e);
        }
      });

      this._allColors = JDM_DATABASE.getAllColorsBreakdown();
      this.renderAllColorsTable(this._allColors);

      const search = document.getElementById('paint-all-search');
      search?.addEventListener('input', (e) => {
        const q = e.target.value.trim().toUpperCase();
        const filtered = !q ? this._allColors : this._allColors.filter(c =>
          c.code.toUpperCase().includes(q) || c.name.toUpperCase().includes(q));
        this.renderAllColorsTable(filtered);
      });
    },

    // Every paint code actually present in the FAST data, each row expandable
    // to show exactly which chassis were built in that color. Complements the
    // hand-curated hero-color cards above, which only cover the famous ones.
    renderAllColorsTable: function(rows) {
      const tbody = document.getElementById('paint-all-table-body');
      if (!tbody) return;
      tbody.innerHTML = '';

      if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="5" style="color:var(--text-muted);">No matching paint codes.</td></tr>';
        return;
      }

      rows.forEach((c, idx) => {
        const rowId = `paint-all-detail-${idx}`;
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.innerHTML = `
          <td class="mono"><strong>${c.code}</strong></td>
          <td>
            <span class="color-swatch-badge">
              <span class="color-dot" style="background-color: ${c.hex};"></span>
              <strong>${c.name}</strong>${c.named ? '' : ' <span style="color:var(--text-muted); font-weight:400;">(name not in factory abbreviation table)</span>'}
            </span>
          </td>
          <td class="mono">${c.count.toLocaleString()}</td>
          <td class="mono">${c.percent}%</td>
          <td class="mono">${c.models.length} chassis &#9662;</td>
        `;
        const detailTr = document.createElement('tr');
        detailTr.id = rowId;
        detailTr.style.display = 'none';
        detailTr.innerHTML = `
          <td colspan="5" style="background: var(--bg-secondary, rgba(0,0,0,0.03)); padding: 10px 16px;">
            ${c.models.map(m => `
              <span class="badge badge-standard" style="margin: 2px 6px 2px 0; display: inline-block;">
                ${m.shortName} — ${m.count.toLocaleString()} (${m.percent}%)
              </span>`).join('')}
          </td>
        `;
        tr.addEventListener('click', () => {
          detailTr.style.display = detailTr.style.display === 'none' ? '' : 'none';
        });
        tbody.appendChild(tr);
        tbody.appendChild(detailTr);
      });
    },

    // -------------------------------------------------------------------------
    // VIEW 8: CHASSIS COMPARE
    // -------------------------------------------------------------------------
    initCompareView: function() {
      const selectA = document.getElementById('compare-select-a');
      const selectB = document.getElementById('compare-select-b');

      const sampleVins = [
        'BNR34-000055', 'BNR34-000101', 'BNR34-000500', 'BNR34-402800',
        'ER34-001250', 'ER34-018920', 'BCNR33-000142', 'BCNR33-007890',
        'BNR32-000088', 'HCR32-045210', 'HR33-004200', 'HNR32-003210', 'ECR33-002310'
      ];

      const populateOptions = (sel, defaultIdx) => {
        if (!sel) return;
        sel.innerHTML = '';
        sampleVins.forEach((vin, idx) => {
          const rec = JDM_DATABASE.resolveChassis(vin);
          if (rec) {
            sel.innerHTML += `<option value="${rec.chassisNumber}" ${idx === defaultIdx ? 'selected' : ''}>${rec.chassisNumber} - ${rec.modelName} (${rec.colorCode} ${rec.grade})</option>`;
          }
        });
      };

      populateOptions(selectA, 0);
      populateOptions(selectB, 4);

      selectA?.addEventListener('change', () => this.renderCompareResult());
      selectB?.addEventListener('change', () => this.renderCompareResult());

      this.renderCompareResult();
    },

    renderCompareResult: function() {
      const outArea = document.getElementById('compare-result-area');
      const vinA = document.getElementById('compare-select-a')?.value || 'BNR34-000055';
      const vinB = document.getElementById('compare-select-b')?.value || 'ER34-001250';

      if (!outArea || !vinA || !vinB) return;

      const recA = JDM_DATABASE.resolveChassis(vinA);
      const recB = JDM_DATABASE.resolveChassis(vinB);

      if (!recA || !recB) return;

      outArea.innerHTML = `
        <div class="table-responsive">
          <table class="registry-table">
            <thead>
              <tr>
                <th style="width: 25%;">Specification Feature</th>
                <th style="width: 37.5%; color: var(--gold-titanium);">${recA.chassisNumber}</th>
                <th style="width: 37.5%; color: var(--gtr-red);">${recB.chassisNumber}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Skyline Model</strong></td>
                <td>${recA.modelName}</td>
                <td>${recB.modelName}</td>
              </tr>
              <tr>
                <td><strong>Factory Plate Code</strong></td>
                <td class="mono">${recA.modelCode || 'N/A'}</td>
                <td class="mono">${recB.modelCode || 'N/A'}</td>
              </tr>
              <tr>
                <td><strong>Trim / Edition</strong></td>
                <td><span class="badge badge-standard">${recA.grade}</span></td>
                <td><span class="badge badge-standard">${recB.grade}</span></td>
              </tr>
              <tr>
                <td><strong>Build Date</strong></td>
                <td class="mono">${recA.buildDate}</td>
                <td class="mono">${recB.buildDate}</td>
              </tr>
              <tr>
                <td><strong>Exterior Paint Color</strong></td>
                <td>
                  <span class="color-swatch-badge">
                    <span class="color-dot" style="background-color: ${recA.colorHex};"></span>
                    ${recA.colorCode} - ${recA.colorName}
                  </span>
                </td>
                <td>
                  <span class="color-swatch-badge">
                    <span class="color-dot" style="background-color: ${recB.colorHex};"></span>
                    ${recB.colorCode} - ${recB.colorName}
                  </span>
                </td>
              </tr>
              <tr>
                <td><strong>Transmission & Drivetrain</strong></td>
                <td>${recA.transmission}</td>
                <td>${recB.transmission}</td>
              </tr>
              <tr>
                <td><strong>Rarity Ranking</strong></td>
                <td><span class="badge badge-grail">${recA.rarityRank || 'Top 1% Spec'}</span></td>
                <td><span class="badge badge-grail">${recB.rarityRank || 'Top 1% Spec'}</span></td>
              </tr>
              <tr>
                <td><strong>Factory Equipment</strong></td>
                <td>${(recA.options || []).join(', ')}</td>
                <td>${(recB.options || []).join(', ')}</td>
              </tr>
              <tr>
                <td><strong>Known Location / Status</strong></td>
                <td>${recA.location} (${recA.status})</td>
                <td>${recB.location} (${recB.status})</td>
              </tr>
            </tbody>
          </table>
        </div>
      `;
    },

    // -------------------------------------------------------------------------
    // MODALS & WATCHLIST
    // -------------------------------------------------------------------------
    initModals: function() {
      document.getElementById('modal-detail-close')?.addEventListener('click', () => {
        document.getElementById('chassis-detail-modal')?.classList.remove('active');
      });

      // Godzilla Modal listeners
      const openGodzilla = () => {
        document.getElementById('godzilla-lore-modal')?.classList.add('active');
      };
      document.getElementById('godzilla-avatar-btn')?.addEventListener('click', openGodzilla);
      document.getElementById('godzilla-modal-btn')?.addEventListener('click', openGodzilla);
      document.getElementById('hero-godzilla-btn')?.addEventListener('click', openGodzilla);
      document.getElementById('btn-history-open-godzilla')?.addEventListener('click', openGodzilla);
      document.getElementById('modal-godzilla-close')?.addEventListener('click', () => {
        document.getElementById('godzilla-lore-modal')?.classList.remove('active');
      });
    },

    openChassisDetailModal: function(record) {
      const modal = document.getElementById('chassis-detail-modal');
      const body = document.getElementById('modal-detail-body');
      if (!modal || !body) return;

      // explainBuild() is the same engine the FAST Plate Decoder tab uses for
      // its "Read from the factory code" list — the specific, human-readable
      // findings (grade, interior trim, running-change windows) rather than
      // just "this position varies." Shown first, since it's the answer most
      // people actually want; the full per-position table below is the
      // exhaustive, show-your-work version underneath it.
      const built = MODEL_DECODER.explainBuild(record);
      let optionsHTML = '';
      if (built && (built.options.length || built.confirmModel)) {
        const confirmRow = built.confirmModel
          ? `<div class="build-option build-option-quiet">
               <span>${built.confirmModel} further character${built.confirmModel === 1 ? '' : 's'}
               simply confirm this is a ${record.modelId}.</span>
             </div>` : '';
        optionsHTML = `
          <div class="build-options">
            <div class="build-options-title">Read from the factory code</div>
            ${built.options.map(o => `
              <div class="build-option">
                <span class="mono build-option-char">${o.char}</span>
                <span>${o.text}</span>
                <span class="decoder-chip-count">pos ${o.pos}</span>
              </div>`).join('')}
            ${confirmRow}
          </div>`;
      }

      // Every position of the plate code, not just the ones the archive is
      // confident about — an "option field" or "no evidence" row is exactly
      // as useful to see here as a fully-derived one, since it says plainly
      // what is and isn't actually known about that character.
      const decoded = record.modelCode ? MODEL_DECODER.decode(record.modelCode) : null;
      let charStripHTML = '';
      let fieldRowsHTML = '';
      if (decoded && decoded.chars) {
        charStripHTML = decoded.chars.map(c => {
          const m = c.meaning;
          const cls = !m ? 'unknown' : (m.kind === 'constant' ? 'constant' : m.kind === 'derived' ? 'derived' : 'observed');
          const title = m ? `${m.label}: ${m.detail}` : `Position ${c.pos}: no evidence in the archive`;
          return `<div class="plate-char ${cls}${c.blank ? ' blank' : ''}" title="${title}">
                    <span class="plate-char-pos">${c.pos}</span>
                    <span class="plate-char-val">${c.char === ' ' ? '&middot;' : c.char}</span>
                  </div>`;
        }).join('') + `<div class="plate-char suffix" title="Chassis family, present on every code">
                          <span class="plate-char-pos">end</span>
                          <span class="plate-char-val">${decoded.suffix}</span>
                        </div>`;

        fieldRowsHTML = decoded.chars.map(c => {
          const m = c.meaning;
          if (!m) {
            return `<tr><td class="mono">${c.pos}</td><td class="mono strong">${c.char === ' ' ? '&middot;' : c.char}</td>
                    <td class="decoder-muted">No evidence in the archive for this position</td></tr>`;
          }
          const badge = m.kind === 'derived' ? '<span class="badge badge-verified">from the data</span>'
                      : m.kind === 'constant' ? '<span class="badge badge-standard">no information</span>'
                      : '<span class="badge badge-collector">observed</span>';
          return `<tr>
              <td class="mono">${c.pos}</td>
              <td class="mono strong">${c.char === ' ' ? '&middot;' : c.char}</td>
              <td><strong>${m.label}</strong> ${badge}<br><span class="decoder-muted">${m.detail}</span></td>
            </tr>`;
        }).join('');
      }

      body.innerHTML = `
        <div class="chassis-sheet-header">
          <div>
            <div class="chassis-large-vin">${record.plateNumber || record.chassisNumber}</div>
            <div class="chassis-model-name">${record.modelName}${record.grade ? ' &bull; ' + record.grade : ''}</div>
            <div style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--text-muted); margin-top: 4px;">
              FAST key ${record.chassisNumber}${record.seriesBlock ? ' &bull; series block ' + record.seriesBlock : ''}
            </div>
          </div>
          <div style="text-align: right;">
            <span class="badge badge-unicorn" style="font-size: 0.85rem;">${record.rarityRank || 'Verified Skyline Registry Chassis'}</span>
          </div>
        </div>

        <div class="spec-grid">
          <div class="spec-card">
            <div class="spec-card-label">FACTORY BUILD DATE</div>
            <div class="spec-card-value mono">${record.buildDate || 'Documented'}</div>
          </div>
          <div class="spec-card">
            <div class="spec-card-label">EXTERIOR PAINT</div>
            <div class="spec-card-value">
              <span class="color-dot" style="background-color: ${record.colorHex}; display: inline-block; vertical-align: middle; margin-right: 4px;"></span>
              ${record.colorCode} - ${record.colorName}
            </div>
          </div>
          <div class="spec-card">
            <div class="spec-card-label">ENGINE SPECIFICATION</div>
            <div class="spec-card-value mono">${(JDM_DATABASE.models[record.modelId] || {}).engine || '—'}</div>
          </div>
          <div class="spec-card">
            <div class="spec-card-label">TRANSMISSION</div>
            <div class="spec-card-value">${record.transmission || 'Manual'}</div>
          </div>
          <div class="spec-card">
            <div class="spec-card-label">DESTINATION MARKET</div>
            <div class="spec-card-value">${record.destination || 'Japan Domestic Market (JDM)'}</div>
          </div>
        </div>

        ${optionsHTML}

        ${fieldRowsHTML ? `
          <div class="fast-code-breakdown">
            <div class="fast-code-title">
              <span>FACTORY BLUE FIREWALL PLATE CODE: <strong>${record.modelCode}</strong></span>
              <button class="btn-page" id="btn-modal-open-decoder" style="font-size: 0.72rem; padding: 4px 10px;">Open in full decoder</button>
            </div>
            <div class="plate-strip">${charStripHTML}</div>
            <div class="table-responsive">
              <table class="registry-table decoder-table">
                <thead><tr><th style="width:50px;">Pos</th><th style="width:50px;">Char</th><th>What it decodes</th></tr></thead>
                <tbody>${fieldRowsHTML}</tbody>
              </table>
            </div>
          </div>
        ` : ''}

        ${record.notes ? `
          <div class="guide-card" style="margin-bottom: 20px;">
            <h4 style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 6px;">HISTORICAL & REGISTRY NOTES</h4>
            <p style="font-size: 0.88rem; color: var(--text-primary);">${record.notes}</p>
          </div>
        ` : ''}

        <div style="display: flex; gap: 12px; justify-content: flex-end; flex-wrap: wrap;">
          <button class="btn-page" id="btn-modal-cert-gen">
            <i data-lucide="award" style="width: 14px; height: 14px; display: inline-block; vertical-align: middle; margin-right: 4px;"></i>
            Generate Certificate of Authenticity
          </button>
        </div>
      `;

      document.getElementById('btn-modal-cert-gen')?.addEventListener('click', () => {
        modal.classList.remove('active');
        this.switchTab('stats-view');
        const calcVin = document.getElementById('calc-vin-input');
        if (calcVin) calcVin.value = record.chassisNumber;
        this.runRarityCalculation();
        document.getElementById('rarity-calculator-block')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });

      document.getElementById('btn-modal-open-decoder')?.addEventListener('click', () => {
        modal.classList.remove('active');
        this.switchTab('fast-decoder-view');
        const input = document.getElementById('fast-input-string');
        if (input) input.value = record.modelCode;
        this.runFastDecode(record.modelCode);
      });

      modal.classList.add('active');
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
  };

  window.App = App;
  App.init();
});

