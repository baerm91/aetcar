/**
 * Shared Filter Toolbar Component
 * 
 * Zentrale Filter-Logik für alle Seiten.
 * Die Seite gibt vor:
 *   - Basisdaten (Array von Objekten)
 *   - Welche Filter angezeigt werden sollen
 *   - Optionale zusätzliche Filter (z.B. Datum, Sicherheit)
 *   - Callback bei Filteränderung
 * 
 * Das Partial/Component stellt bereit:
 *   - Alle Filter-Typen (Material, Typ, Schlagworte)
 *   - Dynamische Facetten-Counts
 *   - Suche
 *   - Reset
 *   - URL-Parameter-Parsing
 * 
 * Usage:
 *   FilterToolbar.init({
 *       facets: ['material', 'type', 'tags'],
 *       onFilterChange: (filteredData, state) => { updateMyView(filteredData); }
 *   });
 *   FilterToolbar.setData(myDataArray, optionalAdditionalFilterFn);
 */

window.FilterToolbar = (function() {
    'use strict';

    // ========================================
    // CONFIGURATION
    // ========================================
    
    const defaultConfig = {
        containerId: 'filterToolbar',
        facets: ['material', 'type', 'tags'],
        showSearch: true,
        showReset: true,
        showCount: true,
        searchPlaceholder: 'Suche...',
        maxFacetItems: 15,
        onFilterChange: null,
        onReset: null
    };

    let config = {};
    
    // ========================================
    // STATE
    // ========================================
    
    let filterState = {
        material: new Set(),
        type: new Set(),
        tags: new Set(),
        gender: new Set(),
        beigaben: new Set(),
        search: ''
    };

    let allData = [];
    let filteredData = [];
    let additionalFilterFn = null;
    let hasDataSource = false;
    let initialized = false;

    // Individuen -> Geschlecht index (lazy loaded)
    let individuenGenderIndex = null; // Map<Inventarnummer, Set<string>>
    let individuenGenderIndexPromise = null;

    // Beigaben -> Kategorien index (lazy loaded)
    let beigabenCategoryIndex = null; // Map<Inventarnummer, Set<string>>
    let beigabenCategoryIndexPromise = null;

    // ========================================
    // FACET DEFINITIONS
    // ========================================
    
    const FACET_DEFINITIONS = {
        material: {
            icon: '🪨',
            label: 'Material',
            btnId: 'materialDropdownBtn',
            menuId: 'toolbar-facet-material',
            getValue: obj => obj['Material / Technik (für Objektbeschriftung)'] || 'Unbekannt',
            isMultiValue: false
        },
        type: {
            icon: '🏺',
            label: 'Typ',
            btnId: 'typeDropdownBtn',
            menuId: 'toolbar-facet-type',
            getValue: obj => obj.Typ || obj.Objektname || 'Unbekannt',
            isMultiValue: false
        },
        tags: {
            icon: '🏷️',
            label: 'Schlagworte',
            btnId: 'tagDropdownBtn',
            menuId: 'toolbar-facet-tags',
            getValue: obj => {
                if (!obj.Schlagworte) return [];
                return obj.Schlagworte.split(',').map(t => t.trim()).filter(Boolean);
            },
            isMultiValue: true
        },
        beigaben: {
            icon: '🎁',
            label: 'Beigaben',
            btnId: 'beigabenDropdownBtn',
            menuId: 'toolbar-facet-beigaben',
            getValue: obj => {
                const inv = obj && obj.Inventarnummer ? String(obj.Inventarnummer) : '';
                if (!inv || !(beigabenCategoryIndex instanceof Map)) return [];
                const set = beigabenCategoryIndex.get(inv);
                if (!set || set.size === 0) return [];
                return Array.from(set);
            },
            isMultiValue: true
        },
        gender: {
            icon: '⚥',
            label: 'Geschlecht',
            btnId: 'genderDropdownBtn',
            menuId: 'toolbar-facet-gender',
            getValue: obj => {
                const inv = obj && obj.Inventarnummer ? String(obj.Inventarnummer) : '';
                if (!inv || !individuenGenderIndex) return [];
                const set = individuenGenderIndex.get(inv);
                if (!set || set.size === 0) return [];
                return Array.from(set);
            },
            isMultiValue: true
        }
    };

    const SEARCH_FIELDS = [
        'Titel / Darstellung',
        'Beschreibung',
        'Inventarnummer',
        'Objektname',
        'Material / Technik (für Objektbeschriftung)',
        'Schlagworte',
        'Typ'
    ];

    // ========================================
    // INITIALIZATION
    // ========================================

    function init(userConfig = {}) {
        config = { ...defaultConfig, ...userConfig };
        
        // If a custom containerId is provided and it's not the default, render the toolbar dynamically
        if (config.containerId && config.containerId !== 'filterToolbar') {
            renderToolbarInContainer(config.containerId);
        }
        
        parseUrlParams();
        setupEventListeners();
        initialized = true;

        // Lazy-load individuen index if needed
        if (Array.isArray(config.facets) && config.facets.includes('gender')) {
            ensureIndividuenGenderIndex();
        }

        // Lazy-load Beigaben-Kategorien wenn benötigt
        if (Array.isArray(config.facets) && config.facets.includes('beigaben')) {
            ensureBeigabenCategoryIndex();
        }
    }

    function ensureIndividuenGenderIndex() {
        if (individuenGenderIndex instanceof Map) {
            return Promise.resolve(individuenGenderIndex);
        }
        if (individuenGenderIndexPromise) {
            return individuenGenderIndexPromise;
        }

        individuenGenderIndexPromise = fetch('assets/individuen.json')
            .then(res => res.ok ? res.json() : null)
            .then(json => {
                const index = new Map();
                const by = json && json.by_sarkophag ? json.by_sarkophag : null;
                if (by && typeof by === 'object') {
                    Object.entries(by).forEach(([inv, individuals]) => {
                        if (!inv) return;
                        const set = new Set();
                        if (Array.isArray(individuals)) {
                            individuals.forEach(ind => {
                                const raw = ind && (ind.geschlecht ?? ind.Geschlecht);
                                const val = raw === null || raw === undefined ? '' : String(raw).trim();
                                if (val) set.add(val);
                            });
                        }
                        if (set.size > 0) {
                            index.set(String(inv), set);
                        }
                    });
                }
                individuenGenderIndex = index;
                return individuenGenderIndex;
            })
            .catch(() => {
                individuenGenderIndex = new Map();
                return individuenGenderIndex;
            })
            .finally(() => {
                individuenGenderIndexPromise = null;
                // Refresh facets + filtering once gender data is available.
                // IMPORTANT: Only do this when FilterToolbar owns the dataset via setData().
                // Pages like panorama_optimized.html use FilterToolbar as UI/state and provide
                // facet items via setFacetData(); repopulating here would overwrite their facet menus.
                if (hasDataSource && Array.isArray(config.facets) && config.facets.includes('gender')) {
                    populateAllFacets();
                    applyFilters();
                }
            });

        return individuenGenderIndexPromise;
    }

    function ensureBeigabenCategoryIndex() {
        if (beigabenCategoryIndex instanceof Map) {
            return Promise.resolve(beigabenCategoryIndex);
        }
        if (beigabenCategoryIndexPromise) {
            return beigabenCategoryIndexPromise;
        }

        beigabenCategoryIndexPromise = fetch('assets/beigaben.json')
            .then(res => res.ok ? res.json() : null)
            .then(json => {
                const index = new Map();
                const by = json && json.by_sarkophag ? json.by_sarkophag : null;
                if (by && typeof by === 'object') {
                    Object.entries(by).forEach(([inv, items]) => {
                        if (!inv) return;
                        const set = new Set();
                        if (Array.isArray(items)) {
                            items.forEach(b => {
                                const raw = b && (b.kategorie ?? b.Kategorie);
                                const val = raw === null || raw === undefined ? '' : String(raw).trim();
                                if (val) set.add(val);
                            });
                        }
                        if (set.size > 0) {
                            index.set(String(inv), set);
                        }
                    });
                }
                beigabenCategoryIndex = index;
                return beigabenCategoryIndex;
            })
            .catch(() => {
                beigabenCategoryIndex = new Map();
                return beigabenCategoryIndex;
            })
            .finally(() => {
                beigabenCategoryIndexPromise = null;
                if (hasDataSource && Array.isArray(config.facets) && config.facets.includes('beigaben')) {
                    populateAllFacets();
                    applyFilters();
                }
            });

        return beigabenCategoryIndexPromise;
    }

    // Render toolbar HTML into a custom container (for panorama.js compatibility)
    function renderToolbarInContainer(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Generate facet dropdowns HTML
        const facetsHtml = config.facets.map(facetKey => {
            const def = FACET_DEFINITIONS[facetKey];
            if (!def) return '';
            return `
                <div class="toolbar-dropdown" id="${facetKey}Dropdown">
                    <button class="toolbar-dropdown-btn" id="${def.btnId}">
                        ${def.icon} ${def.label} <span class="arrow">▼</span>
                    </button>
                    <div class="toolbar-dropdown-menu" id="${def.menuId}"></div>
                </div>
            `;
        }).join('');

        // Generate search and reset HTML
        const toolbarHtml = `
            <div class="toolbar-section toolbar-facets">
                ${facetsHtml}
            </div>
            <div class="toolbar-section toolbar-count">
                <span id="toolbarObjectCount">0</span> Objekte
            </div>
            <div class="toolbar-section toolbar-search">
                <input type="text" id="toolbarSearch" placeholder="${config.searchPlaceholder || 'Suche...'}" class="toolbar-search-input">
            </div>
            <button class="toolbar-reset-btn" id="toolbarResetFilters">Zurücksetzen</button>
        `;

        container.innerHTML = toolbarHtml;
    }

    // ========================================
    // DATA MANAGEMENT
    // ========================================

    function setData(data, additionalFilter = null) {
        allData = Array.isArray(data) ? data : [];
        additionalFilterFn = additionalFilter;
        hasDataSource = true;

        if (Array.isArray(config.facets) && config.facets.includes('gender')) {
            ensureIndividuenGenderIndex();
        }
        
        // Calculate initial facet counts and populate dropdowns
        populateAllFacets();
        
        // Apply filters and trigger callback
        applyFilters();
    }

    function populateAllFacets() {
        config.facets.forEach(facetKey => {
            const counts = calculateFacetCounts(facetKey, true);
            renderFacetDropdown(facetKey, counts);
        });
    }

    // ========================================
    // FILTERING LOGIC
    // ========================================

    function applyFilters() {
        if (!initialized) return;

        // Debug active filters
        const activeFacets = config.facets.filter(k => filterState[k] && filterState[k].size > 0);
        if (activeFacets.length > 0) {
            console.log('[FilterToolbar] Active filters:', activeFacets.map(k => `${k}=${Array.from(filterState[k])}`));
        }

        filteredData = allData.filter(obj => {
            // Additional page-specific filter
            if (additionalFilterFn && !additionalFilterFn(obj)) {
                return false;
            }

            // Search filter
            if (filterState.search && !matchesSearch(obj, filterState.search)) {
                return false;
            }

            // Facet filters
            for (const facetKey of config.facets) {
                if (filterState[facetKey] && filterState[facetKey].size > 0) {
                    if (!matchesFacet(obj, facetKey)) {
                        return false;
                    }
                }
            }
            
            // Debug specific object passing all filters
            if (activeFacets.includes('beigaben') && obj.Inventarnummer === 'CAR-S-1928') {
                 console.warn('[FilterToolbar] CAR-S-1928 PASSED beigaben filter! This should not happen if it has no beigaben.');
            }

            return true;
        });

        // Update facet counts (dynamic)
        updateAllFacetCounts();

        // Update count display
        updateCountDisplay();

        // Trigger callback
        if (config.onFilterChange) {
            config.onFilterChange(filteredData, getState());
        }
    }

    function matchesSearch(obj, searchTerm) {
        const searchText = SEARCH_FIELDS
            .map(field => obj[field])
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
        
        const searchWords = searchTerm.toLowerCase().split(/\s+/).filter(Boolean);
        return searchWords.every(word => searchText.includes(word));
    }

    function matchesFacet(obj, facetKey) {
        const def = FACET_DEFINITIONS[facetKey];
        if (!def) return true;

        // Gender is derived from a lazy-loaded index. Until loaded, don't block results.
        if (facetKey === 'gender' && !(individuenGenderIndex instanceof Map)) {
            return true;
        }

        // Beigaben is derived from a lazy-loaded index. Until loaded, don't block results.
        // BUT: if a beigaben filter is active and index is not loaded, we should NOT match.
        if (facetKey === 'beigaben') {
            if (!(beigabenCategoryIndex instanceof Map)) {
                // Index not loaded yet - don't match anything if filter is active
                return false;
            }
        }

        const value = def.getValue(obj);
        
        // DEBUG: Trace beigaben filtering for a specific object without beigaben (e.g. CAR-S-1928)
        if (facetKey === 'beigaben' && obj.Inventarnummer === 'CAR-S-1928') {
             console.log('[FilterToolbar] Checking beigaben for CAR-S-1928:', {
                 value,
                 filterState: Array.from(filterState[facetKey]),
                 hasMatch: def.isMultiValue ? value.some(v => filterState[facetKey].has(v)) : filterState[facetKey].has(value)
             });
        }
        
        if (def.isMultiValue) {
            if (facetKey === 'tags') {
                const selected = new Set(Array.from(filterState.tags).map(v => String(v).trim().toLowerCase()));
                return value.some(v => selected.has(String(v).trim().toLowerCase()));
            }
            return value.some(v => filterState[facetKey].has(v));
        } else {
            return filterState[facetKey].has(value);
        }
    }

    // ========================================
    // FACET COUNTS (DYNAMIC)
    // ========================================

    function calculateFacetCounts(facetKey, excludeOwnFilter = false) {
        const def = FACET_DEFINITIONS[facetKey];
        if (!def) return {};

        // Filter data, optionally excluding this facet's filter
        const dataToCount = allData.filter(obj => {
            // Additional filter
            if (additionalFilterFn && !additionalFilterFn(obj)) {
                return false;
            }

            // Search filter
            if (filterState.search && !matchesSearch(obj, filterState.search)) {
                return false;
            }

            // Other facet filters (exclude current if excludeOwnFilter)
            for (const fk of config.facets) {
                if (excludeOwnFilter && fk === facetKey) continue;
                if (filterState[fk] && filterState[fk].size > 0) {
                    if (!matchesFacet(obj, fk)) {
                        return false;
                    }
                }
            }

            return true;
        });

        // Count values
        const counts = {};
        dataToCount.forEach(obj => {
            const value = def.getValue(obj);
            if (def.isMultiValue) {
                value.forEach(v => {
                    counts[v] = (counts[v] || 0) + 1;
                });
            } else {
                counts[value] = (counts[value] || 0) + 1;
            }
        });

        return counts;
    }

    function updateAllFacetCounts() {
        config.facets.forEach(facetKey => {
            const counts = calculateFacetCounts(facetKey, true);
            updateFacetCountsInDOM(facetKey, counts);
        });
    }

    // ========================================
    // DOM RENDERING
    // ========================================

    function renderFacetDropdown(facetKey, counts) {
        const def = FACET_DEFINITIONS[facetKey];
        const menu = document.getElementById(def.menuId);
        if (!menu) return;

        const sorted = Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, config.maxFacetItems);

        menu.innerHTML = sorted.map(([label, count]) => {
            const isChecked = filterState[facetKey].has(label);
            const displayLabel = label.length > 35 ? label.substring(0, 35) + '...' : label;
            return `
                <div class="dropdown-item ${isChecked ? 'checked' : ''}" data-value="${escapeHtml(label)}" data-facet="${facetKey}">
                    <div class="dropdown-checkbox"></div>
                    <span class="dropdown-label" title="${escapeHtml(label)}">${escapeHtml(displayLabel)}</span>
                    <span class="dropdown-count">${count}</span>
                </div>
            `;
        }).join('');

        // Add click handlers
        menu.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const value = item.dataset.value;
                toggleFacetValue(facetKey, value);
                item.classList.toggle('checked');
                updateDropdownButton(facetKey);
            });
        });

        // Update button state
        updateDropdownButton(facetKey);
    }

    function updateFacetCountsInDOM(facetKey, counts) {
        const def = FACET_DEFINITIONS[facetKey];
        const menu = document.getElementById(def.menuId);
        if (!menu) return;

        menu.querySelectorAll('.dropdown-item').forEach(item => {
            const value = item.dataset.value;
            const countEl = item.querySelector('.dropdown-count');
            const newCount = counts[value] || 0;
            
            if (countEl) {
                countEl.textContent = newCount;
            }
            
            // Hide items with 0 count (unless selected)
            if (newCount === 0 && !item.classList.contains('checked')) {
                item.style.display = 'none';
            } else {
                item.style.display = '';
            }
        });
    }

    function updateDropdownButton(facetKey) {
        const def = FACET_DEFINITIONS[facetKey];
        const btn = document.getElementById(def.btnId);
        if (!btn) return;

        const count = filterState[facetKey].size;
        if (count > 0) {
            btn.classList.add('has-selection');
            btn.innerHTML = `${def.icon} ${def.label} (${count}) <span class="arrow">▼</span>`;
        } else {
            btn.classList.remove('has-selection');
            btn.innerHTML = `${def.icon} ${def.label} <span class="arrow">▼</span>`;
        }
    }

    function updateCountDisplay() {
        const countEl = document.getElementById('toolbarObjectCount');
        if (countEl) {
            countEl.textContent = filteredData.length;
        }
    }

    function syncFacetMenuCheckedState(facetKey) {
        const def = FACET_DEFINITIONS[facetKey];
        if (!def) return;
        const menu = document.getElementById(def.menuId);
        if (!menu) return;

        menu.querySelectorAll('.dropdown-item').forEach(item => {
            const value = item.dataset.value;
            if (!value) return;
            item.classList.toggle('checked', filterState[facetKey].has(value));
        });

        updateDropdownButton(facetKey);
    }

    // ========================================
    // FILTER ACTIONS
    // ========================================

    function toggleFacetValue(facetKey, value) {
        if (filterState[facetKey].has(value)) {
            filterState[facetKey].delete(value);
        } else {
            filterState[facetKey].add(value);
        }
        applyFilters();
    }

    function setSearch(term) {
        filterState.search = term || '';
        applyFilters();
    }

    function setFacetValues(facetKey, values) {
        if (!filterState[facetKey] || !(filterState[facetKey] instanceof Set)) return;
        const next = Array.isArray(values) ? values : [];
        filterState[facetKey] = new Set(next);
        syncFacetMenuCheckedState(facetKey);
        applyFilters();
    }

    function removeFacetValue(facetKey, value) {
        if (!filterState[facetKey] || !(filterState[facetKey] instanceof Set)) return;
        filterState[facetKey].delete(value);
        syncFacetMenuCheckedState(facetKey);
        applyFilters();
    }

    function addFacetValue(facetKey, value) {
        if (!value) return;
        if (!filterState[facetKey] || !(filterState[facetKey] instanceof Set)) return;
        filterState[facetKey].add(value);
        syncFacetMenuCheckedState(facetKey);
        applyFilters();
    }

    function reset() {
        // Clear all filter state
        Object.keys(filterState).forEach(key => {
            if (filterState[key] instanceof Set) {
                filterState[key] = new Set();
            } else {
                filterState[key] = '';
            }
        });

        // Update UI
        const searchInput = document.getElementById('toolbarSearch');
        if (searchInput) searchInput.value = '';

        document.querySelectorAll('.dropdown-item.checked').forEach(item => {
            item.classList.remove('checked');
        });

        config.facets.forEach(facetKey => {
            updateDropdownButton(facetKey);
        });

        // Callback
        if (config.onReset) {
            config.onReset();
        }

        applyFilters();
    }

    // ========================================
    // EVENT LISTENERS
    // ========================================

    // Store references to moved menus for cleanup
    const movedMenus = new Map();

    function moveMenuToBody(dropdown) {
        const menu = dropdown.querySelector('.toolbar-dropdown-menu');
        if (!menu || movedMenus.has(dropdown)) return menu;
        
        // Clone and move menu to body to escape stacking context
        document.body.appendChild(menu);
        movedMenus.set(dropdown, menu);
        return menu;
    }

    function positionDropdownMenu(dropdown) {
        const btn = dropdown.querySelector('.toolbar-dropdown-btn');
        const menu = movedMenus.get(dropdown) || dropdown.querySelector('.toolbar-dropdown-menu');
        if (!btn || !menu) return;
        
        const btnRect = btn.getBoundingClientRect();
        menu.style.top = (btnRect.bottom + 6) + 'px';
        menu.style.left = btnRect.left + 'px';
    }

    function setupEventListeners() {
        // Dropdown toggle
        document.querySelectorAll('.toolbar-dropdown-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const dropdown = btn.closest('.toolbar-dropdown');
                const wasOpen = dropdown.classList.contains('open');
                
                closeAllDropdowns();
                
                if (!wasOpen) {
                    dropdown.classList.add('open');
                    moveMenuToBody(dropdown);
                    positionDropdownMenu(dropdown);
                    
                    // Show the menu that's now in body
                    const menu = movedMenus.get(dropdown);
                    if (menu) menu.style.display = 'block';
                }
            });
        });

        // Close dropdowns on outside click
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.toolbar-dropdown')) {
                closeAllDropdowns();
            }
        });

        // Search input
        const searchInput = document.getElementById('toolbarSearch');
        if (searchInput) {
            searchInput.addEventListener('input', debounce((e) => {
                setSearch(e.target.value);
            }, 300));
        }

        // Reset button
        const resetBtn = document.getElementById('toolbarResetFilters');
        if (resetBtn) {
            resetBtn.addEventListener('click', reset);
        }
    }

    function closeAllDropdowns() {
        document.querySelectorAll('.toolbar-dropdown.open').forEach(d => {
            d.classList.remove('open');
        });
        // Hide all menus that were moved to body
        movedMenus.forEach(menu => {
            menu.style.display = 'none';
        });
    }

    // ========================================
    // URL PARAMETERS
    // ========================================

    function parseUrlParams() {
        const params = new URLSearchParams(window.location.search);
        
        const search = params.get('search');
        if (search) filterState.search = search;

        const tags = params.get('tags');
        if (tags) {
            filterState.tags = new Set(tags.split(',').map(t => decodeURIComponent(t.trim())));
        }

        const material = params.get('material');
        if (material) {
            filterState.material = new Set(material.split(',').map(m => decodeURIComponent(m.trim())));
        }

        const type = params.get('type');
        if (type) {
            filterState.type = new Set(type.split(',').map(t => decodeURIComponent(t.trim())));
        }

        const gender = params.get('gender') || params.get('geschlecht');
        if (gender) {
            filterState.gender = new Set(gender.split(',').map(g => decodeURIComponent(g.trim())));
        }

        const beigaben = params.get('beigaben');
        if (beigaben) {
            filterState.beigaben = new Set(beigaben.split(',').map(b => decodeURIComponent(b.trim())));
        }

        // Update search input if present
        const searchInput = document.getElementById('toolbarSearch');
        if (searchInput && filterState.search) {
            searchInput.value = filterState.search;
        }
    }

    // ========================================
    // STATE ACCESS
    // ========================================

    function getState() {
        return {
            material: Array.from(filterState.material),
            type: Array.from(filterState.type),
            tags: Array.from(filterState.tags),
            gender: Array.from(filterState.gender),
            beigaben: Array.from(filterState.beigaben),
            search: filterState.search
        };
    }

    function getFilteredData() {
        return filteredData;
    }

    function getAllData() {
        return allData;
    }

    // ========================================
    // UTILITIES
    // ========================================

    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ========================================
    // LEGACY API (for backwards compatibility)
    // ========================================

    // Legacy: render() - no longer needed, init handles rendering
    function render(mode) {
        // No-op for backwards compatibility
        // The new API renders automatically in init()
    }

    // Legacy: setFacetData() - for pages that provide their own facet counts
    function setFacetData(facetKey, data) {
        // data is an object like { "Kalkstein": 14, "Sandstein": 10 }
        const menu = document.getElementById(FACET_DEFINITIONS[facetKey]?.menuId);
        if (!menu) return;

        const sorted = Object.entries(data).sort((a, b) => b[1] - a[1]);
        
        menu.innerHTML = sorted.slice(0, config.maxFacetItems || 15).map(([label, count]) => {
            const isChecked = filterState[facetKey].has(label);
            const displayLabel = label.length > 35 ? label.substring(0, 35) + '...' : label;
            return `
                <div class="dropdown-item${isChecked ? ' checked' : ''}" data-value="${escapeHtml(label)}" data-facet="${facetKey}">
                    <div class="dropdown-checkbox"></div>
                    <span class="dropdown-label" title="${escapeHtml(label)}">${escapeHtml(displayLabel)}</span>
                    <span class="dropdown-count">${count}</span>
                </div>
            `;
        }).join('');

        // Add click handlers
        menu.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const value = item.dataset.value;
                const facet = item.dataset.facet;
                
                if (filterState[facet].has(value)) {
                    filterState[facet].delete(value);
                    item.classList.remove('checked');
                } else {
                    filterState[facet].add(value);
                    item.classList.add('checked');
                }
                
                updateDropdownButton(facet);
                applyFilters();
            });
        });
    }

    // Legacy: updateCount() - update the object count display
    function updateCount(visible, total) {
        const countEl = document.getElementById('toolbarObjectCount');
        if (countEl) {
            countEl.textContent = visible;
        }
    }

    // Legacy: getFilterState() - alias for getState()
    function getFilterState() {
        return getState();
    }

    // ========================================
    // PUBLIC API
    // ========================================

    return {
        init,
        setData,
        getFilteredData,
        getAllData,
        getState,
        reset,
        setSearch,
        setFacetValues,
        addFacetValue,
        removeFacetValue,
        closeAllDropdowns,
        // Legacy API
        render,
        setFacetData,
        updateCount,
        getFilterState
    };
})();
