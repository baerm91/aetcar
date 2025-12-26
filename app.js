// Configuration Constants
const CONFIG = {
    MAP_BOUNDS: [[0, 0], [8192, 7069]], // Height, Width
    IMAGE_PATH: 'assets/map.jpg',
    SEARCH_DEBOUNCE_MS: 300,
    LOADING_DELAY_MS: 500,
    LAYER_STYLES: {
        DEFAULT: { color: '#ff7800', weight: 1, fillOpacity: 0.2 },
        HOVER: { weight: 3, fillOpacity: 0.4 },
        HIGHLIGHT: { weight: 4, fillOpacity: 0.5, color: '#667eea' }
    }
};

// Initialize Map
const map = L.map('map', {
    crs: L.CRS.Simple,
    minZoom: -2,
    maxZoom: 2,
    zoomSnap: 0.5,
    zoomDelta: 0.5,
    zoomControl: false  // Disable zoom controls
});

// Load the image overlay
const image = L.imageOverlay(CONFIG.IMAGE_PATH, CONFIG.MAP_BOUNDS).addTo(map);
map.fitBounds(CONFIG.MAP_BOUNDS);

// Shared filter storage key (used between map and panorama)
const SHARED_FILTER_KEY = 'aetcar-shared-filter';

// Data Storage
let sarcophagiData = [];
let coordinatesData = [];
let objectLookup = {};
let mapLayers = {}; // Store layers by Inventarnummer
let inventoryWhitelist = null; // Optional whitelist of inventory numbers (imported from panorama)

// UI Elements
const loadingScreen = document.getElementById('loading-screen');
const objectList = document.getElementById('object-list');
const detailsPanel = document.getElementById('details-panel');
const detailTitle = document.getElementById('detail-title');
const detailContent = document.getElementById('detail-content');
const closeDetailsBtn = document.getElementById('close-details');
const objectCountText = document.getElementById('object-count-text');
const toggleListBtn = document.getElementById('toggle-list');
const listPanel = document.querySelector('.list-panel');
const togglePanelBtn = document.getElementById('toggle-panel');
const filterSummary = document.getElementById('filter-summary');
const filterSummaryCount = document.querySelector('.filter-summary-count');
const filterSummaryFilters = document.querySelector('.filter-summary-filters');
const openPanoramaBtn = document.getElementById('open-panorama');
const navSearchBtn = document.getElementById('navSearchBtn');
const navCompareLink = document.getElementById('nav-compare');

// Toolbar Elements (new filter toolbar)
const toolbarSearch = document.getElementById('toolbarSearch');
const toolbarObjectCount = document.getElementById('toolbarObjectCount');
const toolbarResetFilters = document.getElementById('toolbarResetFilters');

// Filter Elements (Facets) - now in toolbar dropdowns
const facetMaterial = document.getElementById('toolbar-facet-material');
const facetType = document.getElementById('toolbar-facet-type');
const facetCondition = document.getElementById('toolbar-facet-condition');
const facetTags = document.getElementById('toolbar-facet-tags');

// State
let currentSearchTerm = '';
let currentlyHighlightedLayer = null;
let selectedFilters = {
    material: new Set(),
    type: new Set(),
    condition: new Set(),
    tags: new Set()
};
let highlightedLayers = new Set();
let searchDebounceTimer = null;
let lastFilteredData = [];

// Helper: reset layer to default style
function resetLayerStyle(layer) {
    if (layer && typeof layer.setStyle === 'function') {
        layer.setStyle(CONFIG.LAYER_STYLES.DEFAULT);
    }
}

// Shared filter persistence (used to switch between map and panorama)
function persistSharedFilterSnapshot(ids = [], meta = {}) {
    try {
        const payload = {
            ids: Array.from(new Set(ids.filter(Boolean))),
            meta,
            ts: Date.now()
        };
        localStorage.setItem(SHARED_FILTER_KEY, JSON.stringify(payload));
    } catch (error) {
        console.warn('Konnte Filterzustand nicht speichern:', error);
    }
}

function restoreSharedFilterSnapshot() {
    try {
        const raw = localStorage.getItem(SHARED_FILTER_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.ids)) return null;
        return parsed;
    } catch (error) {
        console.warn('Konnte gespeicherten Filterzustand nicht laden:', error);
        return null;
    }
}

// Helper: normalize facet values (trim + collapse whitespace)
function normalizeFacetValue(value) {
    if (value === null || value === undefined) return '';
    const normalized = String(value).trim().replace(/\s+/g, ' ');
    return normalized;
}

// Helper: normalize tag values (lowercase)
function normalizeTagValue(value) {
    const normalized = normalizeFacetValue(value);
    return normalized.toLowerCase();
}

// Helper: parse Schlagworte list into normalized array
function parseTagList(rawValue) {
    if (!rawValue) return [];
    return String(rawValue)
        .split(',')
        .map(v => normalizeTagValue(v))
        .filter(Boolean);
}

function incrementFacetCounter(map, rawValue) {
    const normalized = normalizeFacetValue(rawValue);
    if (!normalized) {
        return;
    }
    if (!map[normalized]) {
        map[normalized] = {
            label: normalized,
            count: 0
        };
    }
    map[normalized].count += 1;
}

// Fetch Data
Promise.all([
    fetch('data.json').then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
    }),
    fetch('assets/coordinates.json').then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
    })
])
    .then(([data, coords]) => {
        // Validate data
        if (!Array.isArray(data) || !Array.isArray(coords)) {
            throw new Error('Invalid data format');
        }

        sarcophagiData = data;
        coordinatesData = coords;

        // Create lookup
        data.forEach(obj => {
            if (obj && obj.Inventarnummer) {
                objectLookup[obj.Inventarnummer] = obj;
            }
        });

        populateFilters(data);
        renderObjectList(data);
        renderMapObjects(coords);
        updateObjectCount(data.length);
        updateFacetCounts(data);

        // Default filtered cache
        lastFilteredData = data;

        // Restore from URL parameters (preferred) or localStorage fallback
        const urlParams = new URLSearchParams(window.location.search);
        const idsParam = urlParams.get('ids');
        const searchParam = urlParams.get('search');
        const tagsParam = urlParams.get('tags');

        if (idsParam || searchParam) {
            // URL params present - use them
            if (idsParam) {
                const ids = idsParam.split(',').filter(Boolean);
                if (ids.length > 0) {
                    inventoryWhitelist = new Set(ids);
                }
            }
            if (searchParam) {
                currentSearchTerm = searchParam;
                if (searchInput) {
                    searchInput.value = searchParam;
                }
                if (clearSearchBtn) {
                    clearSearchBtn.classList.toggle('visible', currentSearchTerm.length > 0);
                }
            }
            if (tagsParam) {
                const tagValues = tagsParam.split(',').map(normalizeTagValue).filter(Boolean);
                selectedFilters.tags = new Set(tagValues);
                // Pre-check corresponding checkboxes if available
                tagValues.forEach(tag => {
                    const checkbox = document.querySelector(`#facet-tags input[value="${tag}"]`);
                    if (checkbox) {
                        checkbox.checked = true;
                    }
                });
            }
        }

        // Always apply filters to add layers to map (even without URL params)
        applyFilters();

        hideLoadingScreen();
        console.log(`✓ Data loaded: ${data.length} objects, ${coords.length} coordinates`);
    })
    .catch(error => {
        console.error('Error loading data:', error);
        hideLoadingScreen();
        loadingScreen.innerHTML = '<div style="color: white; text-align: center;"><p>❌ Fehler beim Laden der Daten</p><p style="font-size: 0.9rem;">Bitte laden Sie die Seite neu.</p></div>';
        loadingScreen.classList.remove('hidden');
    });

// Hide Loading Screen
function hideLoadingScreen() {
    setTimeout(() => {
        loadingScreen.classList.add('hidden');
    }, CONFIG.LOADING_DELAY_MS);
}

// Populate Filters (Facets)
function populateFilters(data) {
    const materials = {};
    const types = {};
    const conditions = {};
    const tags = {};

    // Count occurrences (normalized)
    data.forEach(obj => {
        incrementFacetCounter(materials, obj['Material / Technik (für Objektbeschriftung)']);
        incrementFacetCounter(types, obj['Objektname']);
        incrementFacetCounter(conditions, obj['Zustandsbeschreibung (kurz, aktuell)']);

        const tagList = parseTagList(obj['Schlagworte']);
        tagList.forEach(tag => {
            if (!tags[tag]) {
                tags[tag] = { label: tag, count: 0 };
            }
            tags[tag].count += 1;
        });
    });

    // Create facet items
    createFacetItems(facetMaterial, materials, 'material');
    createFacetItems(facetType, types, 'type');
    createFacetItems(facetCondition, conditions, 'condition');
    createFacetItems(facetTags, tags, 'tags');

    // Setup facet collapse/expand
    setupFacetToggles();
}

// Create Facet Items with Checkboxes and Counts
function createFacetItems(container, items, facetType) {
    if (!container) return; // Guard against missing container
    const sorted = Object.entries(items).sort((a, b) => b[1].count - a[1].count);

    sorted.forEach(([key, info]) => {
        const item = document.createElement('div');
        item.className = 'facet-item';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `${facetType}-${key}`;
        checkbox.value = key;
        checkbox.dataset.facetType = facetType;

        const label = document.createElement('label');
        label.className = 'facet-item-label';
        label.htmlFor = checkbox.id;
        label.textContent = info.label.length > 35 ? info.label.substring(0, 35) + '...' : info.label;
        label.title = info.label;

        const countBadge = document.createElement('span');
        countBadge.className = 'facet-item-count';
        countBadge.textContent = info.count;
        countBadge.dataset.originalCount = info.count;

        item.appendChild(checkbox);
        item.appendChild(label);
        item.appendChild(countBadge);

        // Click handler
        item.addEventListener('click', (e) => {
            // If clicked directly on checkbox or label, let the browser handle it
            if (e.target === checkbox || e.target.tagName === 'LABEL') {
                return;
            }

            // Otherwise (clicked on div background), toggle manually
            checkbox.checked = !checkbox.checked;
            handleFacetChange(checkbox);
        });

        checkbox.addEventListener('change', () => handleFacetChange(checkbox));

        container.appendChild(item);
    });
}

// Setup Facet Toggle (Collapse/Expand)
function setupFacetToggles() {
    // Setup Facet Toggle (Collapse/Expand)
    document.querySelectorAll('.facet-header').forEach(header => {
        header.addEventListener('click', (e) => {
            // Ignore if clicked on controls
            if (e.target.closest('.facet-controls')) return;

            header.classList.toggle('collapsed');
            const content = header.nextElementSibling;
            content.classList.toggle('collapsed');
        });
    });

    // Setup Facet Reset Buttons
    document.querySelectorAll('.facet-reset').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const facetType = btn.dataset.facet;

            // Guard against missing facet mapping
            if (!facetType || !selectedFilters[facetType]) {
                return;
            }

            // Clear specific facet filter
            selectedFilters[facetType].clear();

            // Uncheck all checkboxes in this facet group
            const groupContent = document.getElementById(`facet-${facetType}`);
            if (groupContent) {
                groupContent.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                    cb.checked = false;
                });
            }

            applyFilters();
        });
    });
}

// Handle Facet Change
function handleFacetChange(checkbox) {
    const facetType = checkbox.dataset.facetType;
    const value = checkbox.value;

    if (checkbox.checked) {
        selectedFilters[facetType].add(value);
    } else {
        selectedFilters[facetType].delete(value);
    }

    updateDropdownButtons();
    applyFilters();
}

// Search Functionality with Debouncing (Toolbar Search)
if (toolbarSearch) {
    toolbarSearch.addEventListener('input', (e) => {
        currentSearchTerm = e.target.value.toLowerCase().trim();

        // Debounce search to improve performance
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
            applyFilters();
        }, CONFIG.SEARCH_DEBOUNCE_MS);
    });
}

// Reset Filters (Toolbar Reset Button)
if (toolbarResetFilters) {
    toolbarResetFilters.addEventListener('click', () => {
        // Uncheck all facets
        document.querySelectorAll('.facet-item input[type="checkbox"]').forEach(cb => {
            cb.checked = false;
        });

        // Clear selected filters
        selectedFilters.material.clear();
        selectedFilters.type.clear();
        selectedFilters.condition.clear();
        selectedFilters.tags.clear();

        // Clear search
        if (toolbarSearch) {
            toolbarSearch.value = '';
        }
        currentSearchTerm = '';

        // Update dropdown button states
        updateDropdownButtons();

        applyFilters();
    });
}

// Mobile Toggle
if (toggleListBtn) {
    toggleListBtn.addEventListener('click', () => {
        if (listPanel) {
            listPanel.classList.toggle('hidden-mobile');
        }
    });
}

// Focus search from top navigation
if (navSearchBtn) {
    navSearchBtn.addEventListener('click', () => {
        if (toolbarSearch) {
            toolbarSearch.focus();
        }
    });
}

// Toolbar Dropdown Toggle
document.querySelectorAll('.toolbar-dropdown-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const dropdown = btn.parentElement;
        const wasOpen = dropdown.classList.contains('open');

        // Close all dropdowns
        document.querySelectorAll('.toolbar-dropdown').forEach(d => d.classList.remove('open'));

        // Toggle this one
        if (!wasOpen) {
            dropdown.classList.add('open');
        }
    });
});

// Close dropdowns when clicking outside
document.addEventListener('click', () => {
    document.querySelectorAll('.toolbar-dropdown').forEach(d => d.classList.remove('open'));
});

// Update dropdown button text based on selections
function updateDropdownButtons() {
    const materialBtn = document.getElementById('materialDropdownBtn');
    const typeBtn = document.getElementById('typeDropdownBtn');
    const conditionBtn = document.getElementById('conditionDropdownBtn');

    if (materialBtn) {
        if (selectedFilters.material.size > 0) {
            materialBtn.classList.add('has-selection');
            materialBtn.innerHTML = `🪨 Material (${selectedFilters.material.size}) <span class="arrow">▼</span>`;
        } else {
            materialBtn.classList.remove('has-selection');
            materialBtn.innerHTML = `🪨 Material <span class="arrow">▼</span>`;
        }
    }

    if (typeBtn) {
        if (selectedFilters.type.size > 0) {
            typeBtn.classList.add('has-selection');
            typeBtn.innerHTML = `🏺 Objekttyp (${selectedFilters.type.size}) <span class="arrow">▼</span>`;
        } else {
            typeBtn.classList.remove('has-selection');
            typeBtn.innerHTML = `🏺 Objekttyp <span class="arrow">▼</span>`;
        }
    }

    if (conditionBtn) {
        if (selectedFilters.condition.size > 0) {
            conditionBtn.classList.add('has-selection');
            conditionBtn.innerHTML = `📋 Zustand (${selectedFilters.condition.size}) <span class="arrow">▼</span>`;
        } else {
            conditionBtn.classList.remove('has-selection');
            conditionBtn.innerHTML = `📋 Zustand <span class="arrow">▼</span>`;
        }
    }
}

function buildPanoramaUrl() {
    const ids = Array.from(new Set((lastFilteredData || []).map(obj => obj.Inventarnummer).filter(Boolean)));
    const params = new URLSearchParams();
    if (ids.length > 0 && ids.length < sarcophagiData.length) {
        params.set('ids', ids.join(','));
    }
    if (currentSearchTerm) {
        params.set('search', currentSearchTerm);
    }
    if (selectedFilters.tags.size > 0) {
        params.set('tags', Array.from(selectedFilters.tags).join(','));
    }
    const paramStr = params.toString();
    return 'panorama_optimized.html' + (paramStr ? '?' + paramStr : '');
}

// Open panorama view with current filtered IDs via URL params
if (openPanoramaBtn) {
    openPanoramaBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = buildPanoramaUrl();
    });
}

// Navbar link to panorama should also preserve filters
if (navCompareLink) {
    navCompareLink.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = buildPanoramaUrl();
    });
}

// Panel Toggle
if (togglePanelBtn) {
    togglePanelBtn.addEventListener('click', () => {
        if (!listPanel) return;
        const wasHidden = listPanel.classList.contains('hidden');
        listPanel.classList.toggle('hidden');
        togglePanelBtn.classList.toggle('active');

        // Toggle filter summary visibility
        if (filterSummary) {
            filterSummary.classList.toggle('visible');
        }

        // If panel is being opened (was hidden), zoom out to full map
        if (wasHidden) {
            // Zoom out to show full map
            map.fitBounds(CONFIG.MAP_BOUNDS, {
                padding: [50, 50],
                animate: true,
                duration: 1.2,
                easeLinearity: 0.25
            });

            // Reset all highlights
            if (currentlyHighlightedLayer) {
                resetLayerStyle(currentlyHighlightedLayer);
                currentlyHighlightedLayer = null;
            }

            highlightedLayers.forEach(layer => {
                resetLayerStyle(layer);
            });
            highlightedLayers.clear();

            // Remove selection from list items
            document.querySelectorAll('.object-item.selected').forEach(el => {
                el.classList.remove('selected');
            });
        }
    });
}

// Update Object Count
function updateObjectCount(count) {
    if (objectCountText) {
        objectCountText.textContent = `${count} ${count === 1 ? 'Objekt' : 'Objekte'}`;
    }
    // Update toolbar count
    if (toolbarObjectCount) {
        toolbarObjectCount.textContent = count;
    }
    updateFilterSummary(count);
}

// Update Filter Summary
function updateFilterSummary(count) {
    if (!filterSummaryCount || !filterSummaryFilters) return;
    
    // Update count
    filterSummaryCount.textContent = `${count} ${count === 1 ? 'Objekt' : 'Objekte'}`;

    // Build filter tags
    filterSummaryFilters.innerHTML = '';

    // Add search term if present
    if (currentSearchTerm) {
        const searchTag = document.createElement('div');
        searchTag.className = 'filter-summary-search';
        searchTag.innerHTML = `🔍 "${currentSearchTerm.substring(0, 20)}${currentSearchTerm.length > 20 ? '...' : ''}"`;
        filterSummaryFilters.appendChild(searchTag);
    }

    // Add facet filters
    const facetLabels = {
        material: 'Material',
        type: 'Typ',
        condition: 'Zustand',
        tags: 'Schlagwort'
    };

    Object.entries(selectedFilters).forEach(([facetType, filterSet]) => {
        if (filterSet.size > 0) {
            filterSet.forEach(value => {
                const tag = document.createElement('div');
                tag.className = 'filter-summary-tag';
                const shortValue = value.length > 25 ? value.substring(0, 25) + '...' : value;
                tag.innerHTML = `${shortValue}`;
                filterSummaryFilters.appendChild(tag);
            });
        }
    });
}

// Apply Filters
function applyFilters() {
    const whitelist = inventoryWhitelist instanceof Set && inventoryWhitelist.size > 0 ? inventoryWhitelist : null;

    const filteredData = sarcophagiData.filter(obj => {
        // If a shared whitelist exists (coming from panorama), restrict to those IDs
        if (whitelist && (!obj.Inventarnummer || !whitelist.has(obj.Inventarnummer))) {
            return false;
        }

        // Filter by facets - if filter is active, object MUST have a value AND it must match
        const materialValue = normalizeFacetValue(obj['Material / Technik (für Objektbeschriftung)']);
        const matchMaterial = selectedFilters.material.size === 0 ||
            (materialValue !== '' && selectedFilters.material.has(materialValue));

        const typeValue = normalizeFacetValue(obj['Objektname']);
        const matchType = selectedFilters.type.size === 0 ||
            (typeValue !== '' && selectedFilters.type.has(typeValue));

        const conditionValue = normalizeFacetValue(obj['Zustandsbeschreibung (kurz, aktuell)']);
        const matchCondition = selectedFilters.condition.size === 0 ||
            (conditionValue !== '' && selectedFilters.condition.has(conditionValue));

        const tagList = parseTagList(obj['Schlagworte']);
        const matchTags = selectedFilters.tags.size === 0 ||
            (tagList.length > 0 && tagList.some(t => selectedFilters.tags.has(t)));

        // Filter by search term
        let matchSearch = true;
        if (currentSearchTerm) {
            const searchableText = [
                obj['Titel / Darstellung'],
                obj['Beschreibung'],
                obj['Datierung'],
                obj['Material / Technik (für Objektbeschriftung)'],
                obj['Inventarnummer'],
                obj['Objektname'],
                obj['Schlagworte']
            ].filter(Boolean).join(' ').toLowerCase();

            matchSearch = searchableText.includes(currentSearchTerm);
        }

        return matchMaterial && matchType && matchCondition && matchTags && matchSearch;
    });

    // Cache for navigation to panorama
    lastFilteredData = filteredData;

    renderObjectList(filteredData);
    updateMapVisibility(filteredData);
    updateObjectCount(filteredData.length);
    updateFacetCounts(filteredData);
}

// Update Facet Counts based on current filter
function updateFacetCounts(filteredData) {
    // For each facet type, we need to count what would be available
    // if only the OTHER facet types were applied
    const facetTypes = ['material', 'type', 'condition', 'tags'];
    const fieldMap = {
        material: 'Material / Technik (für Objektbeschriftung)',
        type: 'Objektname',
        condition: 'Zustandsbeschreibung (kurz, aktuell)'
    };

    facetTypes.forEach(currentFacetType => {
        const counts = {};

        // Count objects that match all OTHER filters (not this facet type)
        sarcophagiData.forEach(obj => {
            // Respect shared whitelist if present
            if (inventoryWhitelist instanceof Set && inventoryWhitelist.size > 0) {
                if (!obj.Inventarnummer || !inventoryWhitelist.has(obj.Inventarnummer)) {
                    return;
                }
            }

            // Check search filter
            let matchSearch = true;
            if (currentSearchTerm) {
                const searchableText = [
                    obj['Titel / Darstellung'],
                    obj['Beschreibung'],
                    obj['Datierung'],
                    obj['Material / Technik (für Objektbeschriftung)'],
                    obj['Inventarnummer'],
                    obj['Objektname'],
                    obj['Schlagworte']
                ].filter(Boolean).join(' ').toLowerCase();
                
                // Split search term into words and check if ALL words are present
                const searchWords = currentSearchTerm.split(/\s+/).filter(Boolean);
                matchSearch = searchWords.every(word => searchableText.includes(word));
            }

            if (!matchSearch) return;

            // Check other facet filters (not the current one)
            let matchOtherFilters = true;
            facetTypes.forEach(otherFacetType => {
                if (otherFacetType !== currentFacetType) {
                    const filterSet = selectedFilters[otherFacetType];
                    if (filterSet.size > 0) {
                        if (otherFacetType === 'tags') {
                            const tagList = parseTagList(obj['Schlagworte']);
                            if (!tagList.some(t => filterSet.has(t))) {
                                matchOtherFilters = false;
                            }
                        } else {
                            const fieldValue = normalizeFacetValue(obj[fieldMap[otherFacetType]]);
                            // Exclude objects with empty/null/undefined values when filter is active
                            if (!fieldValue || !filterSet.has(fieldValue)) {
                                matchOtherFilters = false;
                            }
                        }
                    }
                }
            });

            if (matchOtherFilters) {
                if (currentFacetType === 'tags') {
                    const tagList = parseTagList(obj['Schlagworte']);
                    tagList.forEach(tag => {
                        if (!counts[tag]) {
                            counts[tag] = new Set();
                        }
                        if (obj.Inventarnummer) {
                            counts[tag].add(obj.Inventarnummer);
                        }
                    });
                } else {
                    const value = obj[fieldMap[currentFacetType]];
                    const normalizedValue = normalizeFacetValue(value);
                    if (normalizedValue) {
                        if (!counts[normalizedValue]) {
                            counts[normalizedValue] = new Set();
                        }
                        if (obj.Inventarnummer) {
                            counts[normalizedValue].add(obj.Inventarnummer);
                        }
                    }
                }
            }
        });

        // Update UI for this facet type
        const container = currentFacetType === 'material' ? facetMaterial :
            currentFacetType === 'type' ? facetType :
                currentFacetType === 'condition' ? facetCondition : facetTags;

        container.querySelectorAll('.facet-item').forEach(item => {
            const checkbox = item.querySelector('input[type="checkbox"]');
            const countBadge = item.querySelector('.facet-item-count');
            const value = checkbox.value;

            const countSet = counts[value];
            const newCount = countSet ? countSet.size : 0;
            countBadge.textContent = newCount;

            // Hide if count is 0 and not selected
            if (newCount === 0 && !checkbox.checked) {
                item.style.display = 'none';
            } else {
                item.style.display = '';
                item.classList.remove('disabled');
            }
        });
    });
}

// Update Map Visibility with Animation
function updateMapVisibility(filteredData) {
    const visibleIds = new Set(filteredData.map(obj => obj.Inventarnummer).filter(Boolean));

    // Batch DOM operations for better performance
    Object.entries(mapLayers).forEach(([invNum, layers]) => {
        if (!Array.isArray(layers) || layers.length === 0) {
            return;
        }

        const shouldBeVisible = visibleIds.has(invNum);
        const isVisible = layers.some(layer => map.hasLayer(layer));

        if (!shouldBeVisible && isVisible) {
            // Hide layers
            layers.forEach(layer => {
                const element = layer.getElement();
                if (element) {
                    element.style.animation = '';
                    element.style.filter = '';
                    element.style.opacity = '';
                    element.style.transition = '';
                }
                if (map.hasLayer(layer)) {
                    map.removeLayer(layer);
                }
            });
        } else if (shouldBeVisible && !isVisible) {
            // Show layers
            layers.forEach(layer => {
                if (layer && !map.hasLayer(layer)) {
                    layer.addTo(map);
                }
            });
        }
    });
}

// Render Map Objects
function renderMapObjects(coords) {
    coords.forEach(item => {
        if (!item || !item.Inventarnummer) {
            return;
        }

        let layer;
        if (item.type === 'rectangle' && item.bounds) {
            layer = L.rectangle(item.bounds, CONFIG.LAYER_STYLES.DEFAULT);
        } else if (item.type === 'polygon' && item.latlngs) {
            layer = L.polygon(item.latlngs, CONFIG.LAYER_STYLES.DEFAULT);
        }

        if (layer) {
            const invNum = item.Inventarnummer;
            layer.invNum = invNum; // Store ID on layer

            // Store references (support multiple layers per inventory number)
            mapLayers[invNum] = mapLayers[invNum] || [];
            mapLayers[invNum].push(layer);

            // Interaction
            layer.on('click', () => {
                // Reset previous highlight
                if (currentlyHighlightedLayer) {
                    resetLayerStyle(currentlyHighlightedLayer);
                }

                currentlyHighlightedLayer = layer;

                const obj = objectLookup[invNum];
                if (obj) {
                    showDetails(obj);
                } else {
                    showDetails({ Inventarnummer: invNum });
                }

                // Hide the layer border when showing details
                layer.setStyle({
                    weight: 0,
                    fillOpacity: 0
                });

                // Zoom to the clicked object with padding to avoid details panel
                if (layer.getBounds) {
                    const bounds = layer.getBounds();
                    const padding = window.innerWidth <= 768 ? [30, 30, 30, 300] : [100, 100, 100, 500];
                    map.fitBounds(bounds, {
                        padding: padding,
                        maxZoom: 1,
                        animate: true,
                        duration: 1.2,
                        easeLinearity: 0.25
                    });
                }

                // Hide panel when object is selected on map
                if (!listPanel.classList.contains('hidden')) {
                    listPanel.classList.add('hidden');
                    togglePanelBtn.classList.add('active');
                }
            });

            layer.on('mouseover', () => {
                layer.setStyle(CONFIG.LAYER_STYLES.HOVER);
            });

            layer.on('mouseout', () => {
                layer.setStyle(CONFIG.LAYER_STYLES.DEFAULT);
            });
        }
    });
}

// Render List
function renderObjectList(data) {
    if (!objectList) return; // Guard against missing element
    objectList.innerHTML = '';

    if (data.length === 0) {
        objectList.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">Keine Objekte gefunden</p>';
        return;
    }

    // Sort by Inventory Number
    const sortedData = [...data].sort((a, b) => {
        const invA = a.Inventarnummer || '';
        const invB = b.Inventarnummer || '';
        return invA.localeCompare(invB, undefined, { numeric: true, sensitivity: 'base' });
    });

    sortedData.forEach(obj => {
        const item = document.createElement('div');
        item.className = 'object-item';
        item.setAttribute('role', 'listitem');
        item.setAttribute('tabindex', '0');

        const invNum = obj.Inventarnummer || 'Ohne Nummer';
        const type = obj.Objektname || 'Unbekannter Typ';
        const date = obj.Datierung || 'Undatiert';

        item.innerHTML = `
            <h3>${invNum}</h3>
            <p>${type} · ${date}</p>
        `;

        const clickHandler = () => {
            // Remove previous selection
            document.querySelectorAll('.object-item.selected').forEach(el => {
                el.classList.remove('selected');
            });

            // Mark as selected
            item.classList.add('selected');

            // Show details
            showDetails(obj);

            // Highlight on map
            highlightOnMap(obj);

            // Hide panel when object is selected
            if (!listPanel.classList.contains('hidden')) {
                listPanel.classList.add('hidden');
                togglePanelBtn.classList.add('active');
            }

            // Scroll selected item into view in list
            item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

            // Close mobile list after selection
            if (window.innerWidth <= 768) {
                listPanel.classList.add('hidden-mobile');
            }
        };

        item.addEventListener('click', clickHandler);
        item.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                clickHandler();
            }
        });

        objectList.appendChild(item);
    });
}

// Highlight Object on Map with Advanced Animation
function highlightOnMap(obj) {
    // Reset previous highlight
    if (currentlyHighlightedLayer) {
        resetLayerStyle(currentlyHighlightedLayer);
    }

    if (!obj || !obj.Inventarnummer) {
        return;
    }

    // Check if object has map coordinates
    if (!mapLayers[obj.Inventarnummer]) {
        showNotification(`Objekt ${obj.Inventarnummer} hat keine Kartenkoordinaten.`);
        return;
    }

    try {
        const layers = mapLayers[obj.Inventarnummer];
        const layer = Array.isArray(layers) ? layers[0] : layers;

        if (!layer || !layer.getBounds) {
            return;
        }

        const element = layer.getElement();

        // Hide the layer border (will be hidden when details are shown)
        layer.setStyle({
            weight: 0,
            fillOpacity: 0
        });

        // Zoom to object with padding to avoid details panel
        const bounds = layer.getBounds();
        const padding = window.innerWidth <= 768 ? [30, 30, 30, 300] : [100, 100, 100, 500];
        map.fitBounds(bounds, {
            padding: padding,
            maxZoom: 1,
            animate: true,
            duration: 1.2,
            easeLinearity: 0.25
        });

        currentlyHighlightedLayer = layer;
        highlightedLayers.add(layer);
    } catch (error) {
        console.error('Error highlighting object on map:', error);
    }
}

function showDetails(obj) {
    if (typeof window.openObjectModal === 'function') {
        const inv = obj && obj.Inventarnummer ? String(obj.Inventarnummer) : '';
        const imageUrl = inv ? `extracted_sarcophagi/${inv}.jpg` : '';
        window.openObjectModal(obj || {}, {
            imageUrl,
            onClose: () => {
                detailsPanel.style.display = 'none';

                document.querySelectorAll('.object-item.selected').forEach(el => {
                    el.classList.remove('selected');
                });

                if (currentlyHighlightedLayer) {
                    resetLayerStyle(currentlyHighlightedLayer);
                    currentlyHighlightedLayer = null;
                }

                highlightedLayers.forEach(layer => {
                    resetLayerStyle(layer);
                });
                highlightedLayers.clear();
            }
        });
        return;
    }

    detailsPanel.style.display = 'flex';
    const invNum = obj && obj.Inventarnummer ? obj.Inventarnummer : 'Unbekannt';
    detailTitle.textContent = invNum;
    detailContent.innerHTML = `<p>Keine weiteren Daten verfügbar.</p>`;
}



// Close Details
if (closeDetailsBtn) {
    closeDetailsBtn.addEventListener('click', () => {
        if (detailsPanel) {
            detailsPanel.style.display = 'none';
        }

        // Remove selection from list items
        document.querySelectorAll('.object-item.selected').forEach(el => {
            el.classList.remove('selected');
        });

        // Reset highlight
        if (currentlyHighlightedLayer) {
            resetLayerStyle(currentlyHighlightedLayer);
            currentlyHighlightedLayer = null;
        }

        // Reset all highlighted layers
        highlightedLayers.forEach(layer => {
            resetLayerStyle(layer);
        });
        highlightedLayers.clear();
    });
}

// Close details on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && detailsPanel && detailsPanel.style.display !== 'none' && closeDetailsBtn) {
        closeDetailsBtn.click();
    }
});

// Show notification to user
function showNotification(message, duration = 4000) {
    // Remove existing notification if any
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    document.body.appendChild(notification);

    // Trigger animation
    setTimeout(() => notification.classList.add('show'), 10);

    // Auto-remove after duration
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, duration);
}

// Development helper: Click to get coordinates (comment out in production)
// map.on('click', function (e) {
//     console.log("Lat, Lon:", e.latlng.lat, e.latlng.lng);
// });
