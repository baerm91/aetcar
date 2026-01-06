const CONFIG = {
    BASE_HEIGHT: 8192,
    BASE_WIDTH: 7069,
    IMAGE_PATH: 'assets/map.jpg',
    LAYER_STYLES: {
        DEFAULT: { color: '#f6b15d', weight: 0, fillOpacity: 0.01, fill: true, stroke: false, opacity: 0 },
        HOVER: { weight: 2, fillOpacity: 0.2, fill: true, stroke: true, opacity: 0.5 },
        HIGHLIGHT: { weight: 3, fillOpacity: 0.3, fill: true, color: '#f6b15d', stroke: true, opacity: 0.8 },
        DIM: { color: '#777', weight: 0, opacity: 0, fillOpacity: 0.01, fill: true, stroke: false }
    }
};

const params = new URLSearchParams(window.location.search);
if (params.get('embed') === '1') {
    document.body.classList.add('embed');
}

const map = L.map('map', {
    crs: L.CRS.Simple,
    minZoom: -2,
    maxZoom: 2,
    zoomSnap: 0.25,
    zoomDelta: 0.25,
    zoomControl: false
});

let currentBounds = [[0, 0], [CONFIG.BASE_HEIGHT, CONFIG.BASE_WIDTH]];
let scaleY = 1;
let scaleX = 1;

function buildBounds(height, width) {
    return [[0, 0], [height, width]];
}

function scaleLatLng(pair) {
    if (!Array.isArray(pair) || pair.length < 2) return pair;
    const y = Number(pair[0]);
    const x = Number(pair[1]);
    if (!Number.isFinite(y) || !Number.isFinite(x)) return pair;
    return [y * scaleY, x * scaleX];
}

function scaleEntry(entry) {
    if (!entry || (scaleX === 1 && scaleY === 1)) return entry;
    const copy = { ...entry };
    if (copy.type === 'rectangle' && Array.isArray(copy.bounds)) {
        copy.bounds = copy.bounds.map(scaleLatLng);
    }
    if (copy.type === 'polygon' && Array.isArray(copy.latlngs)) {
        copy.latlngs = copy.latlngs.map(scaleLatLng);
    }
    return copy;
}

let sarcophagiData = [];
let coordinatesData = [];
let steinzeltData = []; // Only objects that have coordinates in the Steinzelt
let steinzeltInvSet = new Set(); // Set of inventory numbers in Steinzelt
let objectLookup = {};
let mapLayers = {};
let currentVisibleInvs = null; // null = no active filter-dimming, otherwise Set of visible invs

// Share loaded data globally for objectModal.js to use
window.__steinzeltDataLoading = true; // Flag to indicate steinzelt.js is loading data
window.__steinzeltCoordinatesData = null;
window.__steinzeltIndividuenData = null;
window.__steinzeltBeigabenData = null;

// Old search elements (for backwards compatibility)
const searchInput = document.getElementById('searchInput');
const clearSearch = document.getElementById('clearSearch');
const navSearchBtn = document.getElementById('navSearchBtn');

// New Toolbar Elements
const toolbarSearch = document.getElementById('toolbarSearch');
const toolbarObjectCount = document.getElementById('toolbarObjectCount');
const toolbarResetFilters = document.getElementById('toolbarResetFilters');

// Filter State
let selectedFilters = {
    material: new Set(),
    type: new Set(),
    tags: new Set()
};
let tagCounts = {};
let materialCounts = {};
let typeCounts = {};
let currentSearchTerm = '';
let filteredData = [];

function makeFacetCheckboxId(facetType, value) {
    const safe = String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '_')
        .replace(/^_+|_+$/g, '');
    return `${facetType}-${safe || 'value'}`;
}

function normalize(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim().toLowerCase();
}

function normalizeInv(value) {
    const v = normalize(value);
    return v.replace(/\s+/g, '').replace(/^car[-_]?s[-_]?/g, 'car-s-');
}

function getTitle(item) {
    if (!item) return '';
    return item['Titel / Darstellung'] || item.Titel || item.TitelDarstellung || '';
}

function setLayerStyle(layer, style) {
    if (!layer || !style) return;
    layer.setStyle(style);
}

function getBaseLayerStyle(inv, layer) {
    if (layer && layer.__hoverLocked) {
        return CONFIG.LAYER_STYLES.HIGHLIGHT;
    }

    // If filters are active, keep filtered highlights/dim even after hover
    if (currentVisibleInvs instanceof Set) {
        return currentVisibleInvs.has(inv) ? CONFIG.LAYER_STYLES.HIGHLIGHT : CONFIG.LAYER_STYLES.DIM;
    }

    return CONFIG.LAYER_STYLES.DEFAULT;
}

function resetAllLayerStyles() {
    Object.values(mapLayers).forEach(layer => {
        setLayerStyle(layer, CONFIG.LAYER_STYLES.DEFAULT);
    });
}

function setDimmedExcept(allowedSet) {
    Object.entries(mapLayers).forEach(([inv, layer]) => {
        if (allowedSet.has(inv)) {
            layer.__hoverLocked = false;
            setLayerStyle(layer, CONFIG.LAYER_STYLES.HIGHLIGHT);
        } else {
            layer.__hoverLocked = false;
            setLayerStyle(layer, CONFIG.LAYER_STYLES.DIM);
        }
    });
}

const FLY_DURATION = 1.2; // Animation duration in seconds

function flyToInventory(inv, callback) {
    const layer = mapLayers[inv];
    if (!layer) {
        if (callback) callback();
        return;
    }
    const bounds = layer.getBounds ? layer.getBounds() : null;
    if (bounds && bounds.isValid()) {
        // Smooth multi-step zoom animation
        map.flyToBounds(bounds, { 
            padding: [40, 40], 
            animate: true, 
            duration: FLY_DURATION,
            easeLinearity: 0.15
        });
        if (callback) {
            setTimeout(callback, FLY_DURATION * 1000 + 50);
        }
    } else if (callback) {
        callback();
    }
}

function buildPopup(inv) {
    const item = objectLookup[inv];
    const title = getTitle(item);
    const panoramaHref = `panorama_optimized.html?ids=${encodeURIComponent(inv)}`;
    const mapHref = `index.html?ids=${encodeURIComponent(inv)}`;

    const container = document.createElement('div');
    container.style.maxWidth = '280px';

    const h = document.createElement('div');
    h.style.fontWeight = '800';
    h.style.marginBottom = '6px';
    h.textContent = inv;
    container.appendChild(h);

    if (title) {
        const t = document.createElement('div');
        t.style.marginBottom = '10px';
        t.style.color = 'rgba(0,0,0,0.7)';
        t.style.lineHeight = '1.35';
        t.textContent = title;
        container.appendChild(t);
    }

    const links = document.createElement('div');
    links.style.display = 'flex';
    links.style.gap = '10px';
    links.style.flexWrap = 'wrap';

    const a1 = document.createElement('a');
    a1.href = panoramaHref;
    a1.textContent = 'Sarkophage';
    a1.style.fontWeight = '800';
    a1.style.color = '#f6b15d';

    const a2 = document.createElement('a');
    a2.href = mapHref;
    a2.textContent = 'Fundkarte';
    a2.style.fontWeight = '800';
    a2.style.color = '#f6b15d';

    links.appendChild(a1);
    links.appendChild(a2);
    container.appendChild(links);

    return container;
}

function renderLayers() {
    // Remove existing layers to avoid duplicates when renderLayers() is called repeatedly
    Object.values(mapLayers).forEach(layer => {
        try { map.removeLayer(layer); } catch { }
    });
    mapLayers = {};

    coordinatesData.forEach(rawEntry => {
        const entry = scaleEntry(rawEntry);
        const inv = entry && entry.Inventarnummer ? String(entry.Inventarnummer) : '';
        if (!inv) return;

        let layer = null;
        if (entry.type === 'rectangle' && entry.bounds) {
            layer = L.rectangle(entry.bounds, CONFIG.LAYER_STYLES.DEFAULT);
        } else if (entry.type === 'polygon' && entry.latlngs) {
            layer = L.polygon(entry.latlngs, CONFIG.LAYER_STYLES.DEFAULT);
        }

        if (!layer) return;

        layer.addTo(map);
        mapLayers[inv] = layer;

        // Hover effects
        layer.on('mouseover', () => {
            if (layer.__hoverLocked) return;

            // Don't "undim" non-matching items on hover when filters are active
            const base = getBaseLayerStyle(inv, layer);
            if (base === CONFIG.LAYER_STYLES.DIM) return;

            setLayerStyle(layer, { ...base, ...CONFIG.LAYER_STYLES.HOVER });
        });

        layer.on('mouseout', () => {
            if (layer.__hoverLocked) return;
            setLayerStyle(layer, getBaseLayerStyle(inv, layer));
        });

        layer.on('click', () => {
            Object.values(mapLayers).forEach(l => { l.__hoverLocked = false; });
            layer.__hoverLocked = true;

            // Keep current filter dim/highlight state when selecting an object
            if (currentVisibleInvs instanceof Set) {
                setDimmedExcept(currentVisibleInvs);
            } else {
                resetAllLayerStyles();
            }
            setLayerStyle(layer, CONFIG.LAYER_STYLES.HIGHLIGHT);
            
            const obj = objectLookup[inv] || { Inventarnummer: inv };
            const imageUrl = inv ? `extracted_sarcophagi/${inv}.jpg` : '';
            
            // Preload image while zooming
            if (imageUrl) {
                const preloadImg = new Image();
                preloadImg.src = imageUrl;
            }
            
            // Open modal immediately without zoom
            if (typeof window.openObjectModal === 'function') {
                window.openObjectModal(obj, { imageUrl });
            } else {
                layer.bindPopup(buildPopup(inv), { maxWidth: 320 }).openPopup();
            }
        });
    });
}

function parseIdsFromParams() {
    const raw = params.get('ids');
    if (!raw) return null;
    const parts = raw.split(',').map(v => v.trim()).filter(Boolean);
    if (parts.length === 0) return null;
    return new Set(parts);
}

function applySearch(term) {
    const t = normalizeInv(term);
    if (!t) {
        resetAllLayerStyles();
        return;
    }

    const matches = new Set();
    Object.keys(mapLayers).forEach(inv => {
        const invNorm = normalizeInv(inv);
        if (invNorm.includes(t) || invNorm.replace('car-s-', '').includes(t)) {
            matches.add(inv);
        }
    });

    if (matches.size === 0) {
        resetAllLayerStyles();
        return;
    }

    setDimmedExcept(matches);

    if (matches.size === 1) {
        flyToInventory(Array.from(matches)[0]);
    }
}

async function loadData() {
    const image = new Image();
    const imageReady = new Promise((resolve, reject) => {
        image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
        image.onerror = () => reject(new Error('image-load-failed'));
    });
    image.src = CONFIG.IMAGE_PATH;

    const [dims, dataRes, coordRes, individuenRes, beigabenRes] = await Promise.all([
        imageReady,
        fetch('data.json'),
        fetch('assets/coordinates.json'),
        fetch('assets/individuen.json'),
        fetch('assets/beigaben.json')
    ]);

    const height = Number(dims && dims.height) || CONFIG.BASE_HEIGHT;
    const width = Number(dims && dims.width) || CONFIG.BASE_WIDTH;
    currentBounds = buildBounds(height, width);
    scaleY = height / CONFIG.BASE_HEIGHT;
    scaleX = width / CONFIG.BASE_WIDTH;

    L.imageOverlay(CONFIG.IMAGE_PATH, currentBounds).addTo(map);
    map.fitBounds(currentBounds);

    sarcophagiData = await dataRes.json();
    coordinatesData = await coordRes.json();
    
    // Parse individuen and beigaben data
    let individuenData = { by_sarkophag: {}, all: [] };
    let beigabenData = { by_sarkophag: {}, all: [] };
    try {
        if (individuenRes.ok) individuenData = await individuenRes.json();
    } catch (e) { }
    try {
        if (beigabenRes.ok) beigabenData = await beigabenRes.json();
    } catch (e) { }
    
    // Share data globally for objectModal.js to avoid duplicate fetches
    window.__steinzeltCoordinatesData = coordinatesData;
    window.__steinzeltIndividuenData = individuenData;
    window.__steinzeltBeigabenData = beigabenData;
    window.__steinzeltDataLoading = false; // Data loading complete

    // Build set of inventory numbers that have coordinates in Steinzelt
    steinzeltInvSet = new Set();
    coordinatesData.forEach(coord => {
        if (coord && coord.Inventarnummer) {
            steinzeltInvSet.add(String(coord.Inventarnummer));
        }
    });

    // Filter sarcophagiData to only include objects in Steinzelt
    steinzeltData = sarcophagiData.filter(item => {
        return item && item.Inventarnummer && steinzeltInvSet.has(String(item.Inventarnummer));
    });

    objectLookup = {};
    sarcophagiData.forEach(item => {
        if (item && item.Inventarnummer) {
            objectLookup[String(item.Inventarnummer)] = item;
        }
    });

    renderLayers();

    // Start animations after data is loaded
    // Start fade-in animation for map
    const mapElement = document.getElementById('map');
    if (mapElement) {
        mapElement.classList.add('loaded');
    }
    
    // Start slide-in animation for filter toolbar after a short delay
    setTimeout(() => {
        const filterToolbar = document.getElementById('filterToolbar');
        if (filterToolbar) {
            filterToolbar.classList.add('loaded');
        }
    }, 300);

    const ids = parseIdsFromParams();
    if (ids) {
        setDimmedExcept(ids);
        if (ids.size === 1) {
            flyToInventory(Array.from(ids)[0]);
        }
    }

    const initialSearch = params.get('search');
    if (initialSearch && searchInput) {
        searchInput.value = initialSearch;
        applySearch(initialSearch);
    }
}

if (searchInput) {
    searchInput.addEventListener('input', () => {
        if (clearSearch) {
            clearSearch.style.visibility = searchInput.value ? 'visible' : 'hidden';
        }
        applySearch(searchInput.value);
    });
}

if (clearSearch) {
    clearSearch.style.visibility = 'hidden';
    clearSearch.addEventListener('click', () => {
        if (!searchInput) return;
        searchInput.value = '';
        clearSearch.style.visibility = 'hidden';
        resetAllLayerStyles();
        searchInput.focus();
    });
}

if (navSearchBtn) {
    navSearchBtn.addEventListener('click', () => {
        if (searchInput) {
            searchInput.focus();
        }
    });
}

loadData().then(() => {
    // Initialize toolbar after data is loaded
    initToolbar();
}).catch(() => {
    const panel = document.getElementById('steinzeltPanel');
    if (panel) {
        panel.innerHTML = '<div class="steinzelt-panel-inner" style="padding:14px;">Fehler beim Laden der Daten.</div>';
    }
});

// ============================================
// TOOLBAR FUNCTIONALITY
// ============================================

// Filter functions are now handled by FilterToolbar

function updateObjectCount(count) {
    if (toolbarObjectCount) {
        toolbarObjectCount.textContent = count;
    }
}


function updateMapVisibility(data) {
    const visibleInvs = new Set(data.map(obj => obj.Inventarnummer).filter(Boolean));

    // Clear hover locks when filters change
    Object.values(mapLayers).forEach(l => { l.__hoverLocked = false; });

    if (visibleInvs.size === 0 || visibleInvs.size === steinzeltData.length) {
        // Show all or none filtered - reset styles
        currentVisibleInvs = null;
        resetAllLayerStyles();
    } else {
        // Highlight filtered, dim others
        currentVisibleInvs = visibleInvs;
        setDimmedExcept(visibleInvs);
    }
}

// ============================================
// THEMES PANEL FUNCTIONALITY
// ============================================

// Add themes variables to existing global scope
let themesData = null;
let themesLoaded = false;

const themesPanel = document.getElementById('themesPanel');
const themesCloseBtn = document.getElementById('themesCloseBtn');
const themesList = document.getElementById('themesList');
const themeDetail = document.getElementById('themeDetail');
const themeBackBtn = document.getElementById('themeBackBtn');

// Load themes data
async function loadThemesData() {
    try {
        const response = await fetch('assets/themes.json');
        themesData = await response.json();
        themesLoaded = true;
        console.log('Themen geladen für steinzelt.html:', themesData.meta.total_themes, 'Themen');
        
        // Update themes panel
        updateThemesPanel();
    } catch (error) {
        console.error('Fehler beim Laden der Themen:', error);
        themesLoaded = false;
        if (themesPanel) themesPanel.style.display = 'none';
    }
}

function initThemesPanel() {
    // Panel now works with themes data
    if (themesCloseBtn) {
        themesCloseBtn.addEventListener('click', () => {
            if (themesPanel) themesPanel.style.display = 'none';
        });
    }

    if (themeBackBtn) {
        themeBackBtn.addEventListener('click', () => {
            if (themesList) themesList.style.display = 'block';
            if (themeDetail) themeDetail.classList.remove('active');
        });
    }
    
    // Themen Toggle Button
    const themesToggleBtn = document.getElementById('themesToggleBtn');
    if (themesToggleBtn) {
        themesToggleBtn.addEventListener('click', () => {
            if (themesPanel) {
                themesPanel.style.display = themesPanel.style.display === 'none' ? 'flex' : 'none';
            }
        });
    }
    
    // Load themes data
    loadThemesData();
}

function getFacetIcon(type) {
    switch (type) {
        case 'material': return '🪨';
        case 'type': return '🏺';
        case 'tags': return '🏷️';
        default: return '🔹';
    }
}

function getFacetLabel(type) {
    switch (type) {
        case 'material': return 'Material';
        case 'type': return 'Typ';
        case 'tags': return 'Schlagwort';
        default: return 'Filter';
    }
}

function updateThemesPanel() {
    if (!themesLoaded || !themesData || !themesPanel) {
        if (themesPanel) themesPanel.style.display = 'none';
        return;
    }
    
    // Get themes for steinzelt page
    const steinzeltThemes = themesData.by_page.steinzelt || [];
    
    if (steinzeltThemes.length === 0) {
        themesPanel.style.display = 'none';
        return;
    }
    
    // Show panel
    themesPanel.style.display = 'block';
    
    // Clear current themes
    if (themesList) themesList.innerHTML = '';
    
    // Render theme cards
    steinzeltThemes.forEach(themeId => {
        const theme = themesData.themes[themeId];
        if (!theme) return;
        
        const themeCard = createThemeCard(theme);
        themesList.appendChild(themeCard);
    });
}

function createThemeCard(theme) {
    const card = document.createElement('div');
    card.className = 'theme-card';
    
    // Count objects for this theme
    const objectCount = countThemeObjects(theme);
    
    card.innerHTML = `
        <div class="theme-card-header">
            <div class="theme-icon">${getThemeIcon(theme)}</div>
            <div>
                <div class="theme-title">${theme.title}</div>
                <div class="theme-subtitle">${theme.story.substring(0, 100)}...</div>
            </div>
        </div>
        <div class="theme-count">${objectCount} Objekt${objectCount !== 1 ? 'e' : ''}</div>
    `;
    
    // Click handler
    card.addEventListener('click', () => {
        showThemeDetail(theme);
    });
    
    return card;
}

function getThemeIcon(theme) {
    // Use icon from theme data or default based on tags
    if (theme.icon) return theme.icon;
    
    const tags = theme.tags || [];
    if (tags.includes('Mumie') || tags.includes('Konservierung')) return '🧬';
    if (tags.includes('Spolien') || tags.includes('Transformation')) return '🔄';
    if (tags.includes('Kind') || tags.includes('Trauer')) return '👶';
    if (tags.includes('Inschrift') || tags.includes('Epigraphik')) return '📜';
    if (tags.includes('Mythologie') || tags.includes('Ikonographie')) return '🏛️';
    if (tags.includes('Architektur') || tags.includes('Dekor')) return '🏗️';
    if (tags.includes('Handwerk') || tags.includes('Herstellung')) return '🔨';
    
    return '📋'; // Default icon
}

function countThemeObjects(theme) {
    if (!theme.inv || theme.inv.length === 0) return 0;
    
    let count = 0;
    theme.inv.forEach(inv => {
        if (steinzeltInvSet.has(inv)) {
            count++;
        }
    });
    
    return count;
}

function showThemeDetail(theme) {
    if (!themesList || !themeDetail) return;
    
    // Hide list, show detail
    themesList.style.display = 'none';
    themeDetail.classList.add('active');
    
    // Update detail content
    const detailTitle = document.getElementById('themeDetailTitle');
    const detailDescription = document.getElementById('themeDetailDescription');
    const detailStats = document.getElementById('themeDetailStats');
    
    if (detailTitle) detailTitle.textContent = theme.title;
    if (detailDescription) detailDescription.textContent = theme.story;
    
    if (detailStats) {
        const objectCount = countThemeObjects(theme);
        detailStats.innerHTML = `
            <div class="theme-stat">
                <div class="theme-stat-value">${objectCount}</div>
                <div class="theme-stat-label">Objekte</div>
            </div>
            <div class="theme-stat">
                <div class="theme-stat-value">${theme.tags ? theme.tags.length : 0}</div>
                <div class="theme-stat-label">Schlagworte</div>
            </div>
        `;
    }
    
    // Setup filter button
    const filterBtn = document.getElementById('themeFilterObjects');
    if (filterBtn) {
        filterBtn.onclick = () => {
            filterByTheme(theme);
        };
    }
}

function filterByTheme(theme) {
    if (!theme.inv || theme.inv.length === 0) return;
    
    // Filter to show only objects in this theme
    const themeInvs = theme.inv.filter(inv => steinzeltInvSet.has(inv));
    
    if (themeInvs.length > 0) {
        // Update FilterToolbar to show theme objects
        const currentFilters = {
            inv: themeInvs
        };
        
        // Apply filter through FilterToolbar
        FilterToolbar.setFilters(currentFilters);
        
        // Close themes panel
        if (themesPanel) themesPanel.style.display = 'none';
        
        console.log('Gefiltert nach Thema:', theme.title, 'mit', themeInvs.length, 'Objekten');
    }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getObjectType(obj) {
    return obj.Typ || obj['Objektname'] || '';
}

function parseTagList(rawValue) {
    if (!rawValue) return [];
    return String(rawValue)
        .split(',')
        .map(v => v.trim())
        .filter(Boolean);
}

function initToolbar() {
    // Initialize FilterToolbar with central logic
    FilterToolbar.init({
        facets: ['material', 'type', 'tags', 'gender', 'beigaben'],
        onFilterChange: (filtered, state) => {
            filteredData = filtered;
            updateObjectCount(filteredData.length);
            updateMapVisibility(filteredData); // dim/highlight according to filters
        },
    });

    // Set data - FilterToolbar handles all filtering
    FilterToolbar.setData(steinzeltData);

    initThemesPanel();
}
