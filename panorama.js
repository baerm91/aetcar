/**
 * Erweiterte Panorama-Funktionen mit optimiertem Layout
 */

const SHARED_FILTER_KEY = 'aetcar-shared-filter';

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

class PanoramaManager {
    constructor() {
        this.allData = [];
        this.currentFilter = 'all';
        this.currentSearch = '';
        this.currentSize = 250;
        this.layoutMode = 'masonry'; // Default layout
        this.sortMode = 'id_asc'; // Default sort
        this.uprightMode = false; // Default upright
        this.sharedWhitelist = null;
        this.sharedSnapshot = null;
        this.toolbarFilteredData = null;
        this.lastFilteredData = [];
        this.tagCounts = {};
        this.tagLabels = new Map(); // maps normalized tag -> display label
        this.selectedTags = new Set();
        this.selectedMaterials = new Set();
        this.selectedTypes = new Set();
        this.selectedGenders = new Set();
        this.genderIndex = null; // Map<Inventarnummer, Set<string>>
    }

    async init() {
        await this.loadData();
        this.applySharedSnapshot();
        this.initFilterToolbar();
        this.setupEventListeners();
        this.renderPanorama();
    }

    async loadData() {
        try {
            const response = await fetch('data.json');
            this.allData = await response.json();
            
            // Prüfe welche Bilder existieren
            await this.checkImageAvailability();

            // Schlagwort-Liste erstellen
            this.buildTagIndex();
            
            // Start preloading dimensions for sorting
            this.preloadDimensions();
        } catch (error) {
            console.error('Fehler beim Laden der Daten:', error);
            this.showError('Fehler beim Laden der Daten');
        }
    }

    // Normalisiert einen Schlagwort-String
    normalizeTag(value) {
        if (value === null || value === undefined) return '';
        return String(value).trim().toLowerCase().replace(/\s+/g, ' ');
    }

    // Bereinigt ein Schlagwort für die Anzeige (behält Groß-/Kleinschreibung)
    cleanTagLabel(value) {
        if (value === null || value === undefined) return '';
        return String(value).trim().replace(/\s+/g, ' ');
    }

    // Wandelt das Feld "Schlagworte" in ein Array normalisierter Tags
    parseTagList(rawValue) {
        if (!rawValue) return [];
        return String(rawValue)
            .split(',')
            .map(v => this.normalizeTag(v))
            .filter(Boolean);
    }

    // Liefert Paare aus normalisiertem Tag + Original-Label
    extractTagEntries(rawValue) {
        if (!rawValue) return [];
        return String(rawValue)
            .split(',')
            .map(v => {
                const norm = this.normalizeTag(v);
                const label = this.cleanTagLabel(v);
                return { norm, label };
            })
            .filter(entry => entry.norm);
    }

    buildTagIndex() {
        this.tagCounts = {};
        this.tagLabels = new Map();
        this.allData.forEach(item => {
            const entries = this.extractTagEntries(item.Schlagworte);
            entries.forEach(({ norm, label }) => {
                if (!this.tagCounts[norm]) {
                    this.tagCounts[norm] = { count: 0, label: label || norm };
                }
                if (!this.tagCounts[norm].label && label) {
                    this.tagCounts[norm].label = label;
                }
                this.tagCounts[norm].count += 1;
                if (label) {
                    this.tagLabels.set(norm, label);
                }
            });
        });
        this.renderTagDropdown();
        this.renderActiveTags();
    }

    buildFacetData() {
        const material = {};
        const type = {};
        const tags = {};

        this.allData.forEach(item => {
            const mat = this.cleanTagLabel(item['Material / Technik (für Objektbeschriftung)']);
            if (mat) material[mat] = (material[mat] || 0) + 1;

            const typ = this.cleanTagLabel(item.Typ || item.Objektname);
            if (typ) type[typ] = (type[typ] || 0) + 1;

            const entries = this.extractTagEntries(item.Schlagworte);
            entries.forEach(({ label }) => {
                if (label) tags[label] = (tags[label] || 0) + 1;
            });
        });

        return { material, type, tags };
    }

    async fetchImageFileSet() {
        try {
            const res = await fetch('extracted_sarcophagi/', { cache: 'no-store' });
            if (!res.ok) return null;
            const text = await res.text();
            if (!text) return null;

            const doc = new DOMParser().parseFromString(text, 'text/html');
            const files = new Set();
            doc.querySelectorAll('a[href]').forEach(a => {
                const href = a.getAttribute('href');
                if (!href) return;
                const clean = href.split('?')[0].split('#')[0];
                if (!clean || clean.endsWith('/')) return;
                const name = decodeURIComponent(clean).split('/').pop();
                if (!name) return;
                if (/\.(jpe?g|png|webp)$/i.test(name)) {
                    files.add(name.toLowerCase());
                }
            });

            return files.size > 0 ? files : null;
        } catch {
            return null;
        }
    }

    async checkImageAvailability() {
        const files = await this.fetchImageFileSet();
        if (files instanceof Set) {
            this.allData.forEach(item => {
                const invNum = item.Inventarnummer || '';
                item.dimensions = { w: 0, h: 0, max: 0, area: 0, loaded: false };
                const expected = `${invNum}.jpg`.toLowerCase();
                item.hasImage = Boolean(invNum) && files.has(expected);
            });
            return;
        }

        const checkPromises = this.allData.map(async (item) => {
            const invNum = item.Inventarnummer || '';
            const imagePath = `extracted_sarcophagi/${invNum}.jpg`;

            item.dimensions = { w: 0, h: 0, max: 0, area: 0, loaded: false };

            try {
                const response = await fetch(imagePath, { method: 'HEAD' });
                item.hasImage = response.ok;
            } catch {
                item.hasImage = false;
            }
        });

        await Promise.all(checkPromises);
    }

    preloadDimensions() {
        const itemsWithImages = this.allData.filter(item => item.hasImage);
        let loadedCount = 0;
        const total = itemsWithImages.length;

        // Debounce render function
        let renderTimeout;
        const debouncedRender = () => {
            if (renderTimeout) clearTimeout(renderTimeout);
            renderTimeout = setTimeout(() => {
                if (this.sortMode.includes('size')) {
                    this.renderPanorama();
                }
            }, 500);
        };

        itemsWithImages.forEach(item => {
            const img = new Image();
            img.src = `extracted_sarcophagi/${item.Inventarnummer}.jpg`;
            img.onload = () => {
                item.dimensions = {
                    w: img.naturalWidth,
                    h: img.naturalHeight,
                    max: Math.max(img.naturalWidth, img.naturalHeight),
                    area: img.naturalWidth * img.naturalHeight,
                    loaded: true
                };
                loadedCount++;
                
                // Re-render periodically or when all are done if sorting by size
                if (this.sortMode.includes('size')) {
                    if (loadedCount % 10 === 0 || loadedCount === total) {
                        debouncedRender();
                    }
                }
            };
        });
    }

    initFilterToolbar() {
        if (!window.FilterToolbar) return;

        FilterToolbar.init({
            containerId: 'filterToolbarContainer',
            facets: ['material', 'type', 'tags', 'gender', 'beigaben'],
            onFilterChange: (filtered, state) => {
                this.onToolbarFilterChange(filtered, state);
            },
            onReset: () => {
                // Also reset shared whitelist (e.g. when arriving via ?ids=...)
                this.sharedWhitelist = null;
                this.sharedSnapshot = null;
            }
        });
        FilterToolbar.render('append');

        // Central filtering: FilterToolbar owns the dataset and dynamic facet counts
        FilterToolbar.setData(this.allData, (obj) => {
            const inv = obj && obj.Inventarnummer ? String(obj.Inventarnummer) : '';
            if (this.sharedWhitelist instanceof Set && this.sharedWhitelist.size > 0) {
                if (!inv || !this.sharedWhitelist.has(inv)) return false;
            }
            return true;
        });
    }

    applyToolbarState(state) {
        const s = state || {};
        this.currentSearch = s.search || '';
        this.selectedTags = new Set(s.tags || []);
        this.selectedMaterials = new Set(s.material || []);
        this.selectedTypes = new Set(s.type || []);
        this.selectedGenders = new Set(s.gender || []);
    }

    onToolbarFilterChange(filtered, state) {
        this.applyToolbarState(state);
        this.toolbarFilteredData = Array.isArray(filtered) ? filtered : [];
        this.lastFilteredData = this.toolbarFilteredData;
        this.renderPanorama(this.toolbarFilteredData);
    }

    applySharedSnapshot() {
        // First try URL parameters (preferred)
        const urlParams = new URLSearchParams(window.location.search);
        const idsParam = urlParams.get('ids');
        
        if (idsParam) {
            const ids = idsParam.split(',').filter(Boolean);
            if (ids.length > 0) {
                this.sharedWhitelist = new Set(ids);
            }
        }
        
        // Note: We intentionally do NOT auto-restore shared filters from localStorage here.
        // Persisted snapshots can become stale and unintentionally hide objects.
    }

    filterData() {
        // Central filtering is handled by FilterToolbar via setData().
        // This method is only a fallback for initial render.
        if (Array.isArray(this.toolbarFilteredData)) {
            return this.toolbarFilteredData;
        }
        return this.allData;
    }

    async loadGenderFacetData() {
        if (!window.FilterToolbar) return;
        if (this._genderFacetLoading) return;
        this._genderFacetLoading = true;

        try {
            const res = await fetch('assets/individuen.json');
            if (!res.ok) return;
            const json = await res.json();

            const invSet = new Set(this.allData.map(item => item && item.Inventarnummer).filter(Boolean));
            const allowed = this.sharedWhitelist instanceof Set && this.sharedWhitelist.size > 0 ? this.sharedWhitelist : null;

            const by = json && json.by_sarkophag ? json.by_sarkophag : null;
            const genderCounts = {}; // label -> Set of invs
            const genderIndex = new Map();

            if (by && typeof by === 'object') {
                Object.entries(by).forEach(([inv, individuals]) => {
                    if (!inv) return;
                    const invId = String(inv);
                    if (!invSet.has(invId)) return;
                    if (allowed && !allowed.has(invId)) return;

                    const set = new Set();
                    if (Array.isArray(individuals)) {
                        individuals.forEach(ind => {
                            const raw = ind && (ind.geschlecht ?? ind.Geschlecht);
                            const val = raw === null || raw === undefined ? '' : String(raw).trim();
                            if (val) set.add(val);
                        });
                    }

                    if (set.size > 0) {
                        genderIndex.set(invId, set);
                        set.forEach(g => {
                            if (!genderCounts[g]) genderCounts[g] = new Set();
                            genderCounts[g].add(invId);
                        });
                    }
                });
            }

            this.genderIndex = genderIndex;

            const counts = {};
            Object.entries(genderCounts).forEach(([label, set]) => {
                counts[label] = set.size;
            });

            FilterToolbar.setFacetData('gender', counts);

            // Apply gender URL state after index arrives
            this.renderPanorama();
        } catch (error) {
            // Ignore errors - gender facet will remain empty
        } finally {
            this._genderFacetLoading = false;
        }
    }

    renderPanorama(sourceData) {
        const container = document.getElementById('panoramaContainer');
        // Don't clear immediately to avoid blink if we could reuse, but simpler to rebuild
        container.innerHTML = '';

        const tagFilteredData = Array.isArray(sourceData)
            ? sourceData.slice()
            : this.filterData().slice();
        this.lastFilteredData = tagFilteredData;
        
        if (tagFilteredData.length === 0) {
            container.innerHTML = '<div class="loading">Keine Sarkophage gefunden</div>';
            this.updateStats(0);
            this.renderActiveTags();
            return;
        }

        // Sort Logic
        tagFilteredData.sort((a, b) => {
            const aNum = a.Inventarnummer || '';
            const bNum = b.Inventarnummer || '';

            const getMetric = (item) => {
                if (!item.dimensions || !item.dimensions.loaded) return 0;
                
                if (this.uprightMode) {
                    // In upright mode, users expect sorting by "Visual Height" (how tall it looks in the shelf)
                    // Visual Height is determined by Aspect Ratio because width is fixed
                    const w = item.dimensions.w;
                    const h = item.dimensions.h;
                    const isRotated = w > h * 1.2; // Consistent with createCard
                    
                    // If rotated (Landscape -> Portrait): Aspect is w/h
                    // If not rotated (Portrait): Aspect is h/w
                    const visualAspectRatio = isRotated ? (w / h) : (h / w);
                    
                    // Add tiny fraction of area to stabilize sort for identical ratios
                    return visualAspectRatio + (item.dimensions.area / 1000000000);
                } else {
                    // Normal mode: Area (Resolution)
                    return item.dimensions.area;
                }
            };

            switch (this.sortMode) {
                case 'id_desc':
                    return bNum.localeCompare(aNum);
                case 'size_asc':
                    return getMetric(a) - getMetric(b);
                case 'size_desc':
                    return getMetric(b) - getMetric(a);
                case 'id_asc':
                default:
                    return aNum.localeCompare(bNum);
            }
        });

        tagFilteredData.forEach(item => {
            const card = this.createCard(item);
            container.appendChild(card);
        });

        this.lastFilteredData = tagFilteredData;
        this.updateStats(tagFilteredData.length);
        this.renderActiveTags();
    }

    createCard(item) {
        const card = document.createElement('div');
        card.className = 'sarcophagus-card';
        
        const invNum = item.Inventarnummer || 'Unbekannt';
        const imagePath = `extracted_sarcophagi/${invNum}.jpg`;
        const externalImageUrl = item && item.foto_url ? String(item.foto_url).trim() : '';
        
        const imgWrapper = document.createElement('div');
        imgWrapper.className = 'image-wrapper';

        const img = new Image();
        img.alt = invNum;
        img.loading = 'lazy';
        
        // If no image available, show placeholder immediately
        if (!item.hasImage) {
            if (externalImageUrl) {
                img.src = externalImageUrl;
            } else {
                img.src = 'data:image/svg+xml;base64,' + btoa(`
                <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
                    <rect width="200" height="200" fill="#2a2a2a"/>
                    <text x="100" y="90" text-anchor="middle" fill="#888" font-family="sans-serif" font-size="14">Kein Foto</text>
                    <text x="100" y="115" text-anchor="middle" fill="#666" font-family="sans-serif" font-size="11">verfügbar</text>
                    <rect x="70" y="130" width="60" height="40" rx="3" fill="none" stroke="#555" stroke-width="2"/>
                    <circle cx="85" cy="145" r="5" fill="#555"/>
                    <path d="M75 165 L90 150 L105 160 L125 140" stroke="#555" stroke-width="2" fill="none"/>
                </svg>
            `);
                imgWrapper.classList.add('no-image');
            }
        } else {
            img.src = imagePath;
        } 
        
        // Function to apply styling based on dimensions
        // Toggle OFF: longest side horizontal (sarcophagus lying down)
        // Toggle ON: longest side vertical (sarcophagus standing upright)
        const applyImageStyles = (w, h) => {
            const isLandscape = w > h; // Image is wider than tall
            const currentCardWidth = this.currentSize;
            
            // Determine if we need to rotate
            // OFF + portrait (h > w): rotate to make longest side horizontal
            // OFF + landscape (w > h): no rotation needed, already horizontal
            // ON + portrait (h > w): no rotation needed, already vertical
            // ON + landscape (w > h): rotate to make longest side vertical
            
            const needsRotation = (this.uprightMode && isLandscape) || (!this.uprightMode && !isLandscape);
            
            // Calculate the visual height after potential rotation
            let visualWidth, visualHeight;
            if (needsRotation) {
                // After rotation: original height becomes width, original width becomes height
                visualWidth = h;
                visualHeight = w;
            } else {
                visualWidth = w;
                visualHeight = h;
            }
            
            // Calculate wrapper height based on visual aspect ratio
            const wrapperHeight = currentCardWidth * (visualHeight / visualWidth);
            
            imgWrapper.style.height = `${wrapperHeight}px`;
            imgWrapper.style.minHeight = `${wrapperHeight}px`;
            imgWrapper.style.position = 'relative';
            imgWrapper.style.overflow = 'hidden';
            
            if (needsRotation) {
                // Rotate the image
                const imgDisplayWidth = currentCardWidth * (w / h);
                const imgDisplayHeight = currentCardWidth;
                
                img.style.width = `${imgDisplayWidth}px`;
                img.style.height = `${imgDisplayHeight}px`;
                img.style.maxWidth = 'none';
                img.style.position = 'absolute';
                img.style.left = '50%';
                img.style.top = '50%';
                img.style.transform = 'translate(-50%, -50%) rotate(90deg)';
                img.style.objectFit = 'contain';
            } else {
                // No rotation - fit image to wrapper width
                img.style.width = '100%';
                img.style.height = 'auto';
                img.style.maxWidth = '';
                img.style.position = '';
                img.style.left = '';
                img.style.top = '';
                img.style.transform = '';
                img.style.objectFit = '';
            }
        };

        if (item.dimensions && item.dimensions.loaded) {
            // Apply immediately if known
            applyImageStyles(item.dimensions.w, item.dimensions.h);
        } else {
            // Wait for load
            img.onload = () => {
                const w = img.naturalWidth;
                const h = img.naturalHeight;
                // Cache if not cached (race condition safe)
                if (!item.dimensions) item.dimensions = {};
                item.dimensions.w = w;
                item.dimensions.h = h;
                item.dimensions.loaded = true;
                applyImageStyles(w, h);
            };
        }

        img.onerror = function() {
            this.style.opacity = '0.3';
            this.parentElement.style.background = '#222';
            this.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMTAwIDEwMCI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiMzMzMiLz48dGV4dCB4PSI1MCIgeT0iNTAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiM2NjYiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjEyIj5LZWluIEJpbGQ8L3RleHQ+PC9zdmc+';
        };

        imgWrapper.appendChild(img);

        const cardInfo = document.createElement('div');
        cardInfo.className = 'card-info';
        
        // Badge for Material (optional)
        const materialBadge = item.Material ? `<span class="badge">${item.Material}</span>` : '';

        cardInfo.innerHTML = `
            <div class="card-title">${invNum}</div>
            <div class="card-meta">
                <span>${item.Maße || 'Typ unbekannt'}</span>
                ${materialBadge}
            </div>
        `;

        card.appendChild(imgWrapper);
        card.appendChild(cardInfo);
        card.onclick = () => this.openModal(item, item.hasImage ? imagePath : '');
        
        return card;
    }

    optimizeMasonryLayout() {
        // Not needed with CSS columns
    }
    
    // ... (keep applyMasonryLayout empty or remove)

    getFilteredData() {
        // Return the last filtered/displayed data for navigation
        return this.lastFilteredData || this.filterData();
    }

    openModal(item, imagePath) {
        if (typeof window.openObjectModal === 'function') {
            // Get currently displayed/filtered items for navigation
            const displayedItems = this.getFilteredData();
            
            // Image URL builder function
            const imageUrlBuilder = (obj) => {
                const inv = obj && obj.Inventarnummer ? String(obj.Inventarnummer) : '';
                return inv && obj && obj.hasImage ? `extracted_sarcophagi/${inv}.jpg` : '';
            };
            
            window.openObjectModal(item || {}, {
                imageUrl: imagePath || '',
                dataset: displayedItems,
                imageUrlBuilder: imageUrlBuilder
            });
        }
    }

    closeModal() {
        if (typeof window.closeObjectModal === 'function') {
            window.closeObjectModal();
        }
    }

    updateStats(visibleCount) {
        const countEl = document.getElementById('toolbarObjectCount');
        if (countEl) countEl.textContent = visibleCount;
    }

    showError(message) {
        const container = document.getElementById('panoramaContainer');
        container.innerHTML = `<div class="loading">${message}</div>`;
    }

    setupEventListeners() {
        const searchInput = document.getElementById('toolbarSearch');
        const clearBtn = document.getElementById('clearSearch');
        const navSearchBtn = document.getElementById('navSearchBtn');
        const navMapLink = document.getElementById('nav-map');

        // Suche
        if (searchInput && !window.FilterToolbar) {
            searchInput.addEventListener('input', (e) => {
                this.currentSearch = e.target.value;
                if (clearBtn) {
                    clearBtn.classList.toggle('visible', this.currentSearch.length > 0);
                }
                this.renderPanorama();
            });
        }
        
        // Clear Search
        if (clearBtn && searchInput && !window.FilterToolbar) {
            clearBtn.addEventListener('click', () => {
                this.currentSearch = '';
                searchInput.value = '';
                clearBtn.classList.remove('visible');
                this.renderPanorama();
                searchInput.focus();
            });
        }

        // Zurück zur Karte mit aktuellem Filter via URL params
        const backBtn = document.getElementById('backToMap');
        const goToMapWithState = () => {
            const ids = Array.from(new Set((this.lastFilteredData || this.filterData()).map(i => i.Inventarnummer).filter(Boolean)));
            const params = new URLSearchParams();
            if (ids.length > 0 && ids.length < this.allData.length) {
                params.set('ids', ids.join(','));
            }

            const state = (window.FilterToolbar && typeof FilterToolbar.getState === 'function')
                ? FilterToolbar.getState()
                : null;

            const search = state && state.search ? state.search : this.currentSearch;
            if (search) {
                params.set('search', search);
            }

            const tags = state && Array.isArray(state.tags) ? state.tags : Array.from(this.selectedTags);
            if (tags.length > 0) {
                params.set('tags', tags.join(','));
            }

            const material = state && Array.isArray(state.material) ? state.material : [];
            if (material.length > 0) {
                params.set('material', material.join(','));
            }

            const type = state && Array.isArray(state.type) ? state.type : [];
            if (type.length > 0) {
                params.set('type', type.join(','));
            }

            const gender = state && Array.isArray(state.gender) ? state.gender : [];
            if (gender.length > 0) {
                params.set('gender', gender.join(','));
            }
            const paramStr = params.toString();
            window.location.href = 'fundkarte.html' + (paramStr ? '?' + paramStr : '');
        };

        if (backBtn) {
            backBtn.addEventListener('click', goToMapWithState);
        }

        if (navSearchBtn) {
            navSearchBtn.addEventListener('click', () => {
                if (searchInput) searchInput.focus();
            });
        }

        // Tag Filter toggle
        const tagToggle = document.getElementById('tagFilterToggle');
        const tagDropdown = document.getElementById('tagFilterDropdown');
        if (tagToggle && tagDropdown) {
            tagToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                tagDropdown.classList.toggle('open');
            });
            document.addEventListener('click', (e) => {
                if (!tagDropdown.contains(e.target) && !tagToggle.contains(e.target)) {
                    tagDropdown.classList.remove('open');
                }
            });
        }

        // Reset Filters Button
        const resetBtn = document.getElementById('toolbarResetFilters');
        if (resetBtn && !window.FilterToolbar) {
            resetBtn.addEventListener('click', () => {
                // Reset search
                this.currentSearch = '';
                if (searchInput) searchInput.value = '';
                
                // Reset tags
                this.selectedTags.clear();
                this.renderTagFilter();
                this.updateActiveTagsDisplay();

                // Reset shared whitelist (e.g. when arriving via ?ids=...)
                this.sharedWhitelist = null;
                this.sharedSnapshot = null;
                
                this.renderPanorama();
            });
        }

        // Sort Select
        const sortSelect = document.getElementById('sortSelect');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.sortMode = e.target.value;
                this.renderPanorama();
            });
        }

        // Upright Toggle
        const uprightToggle = document.getElementById('uprightToggle');
        if (uprightToggle) {
            uprightToggle.addEventListener('change', (e) => {
                this.uprightMode = e.target.checked;
                this.renderPanorama();
            });
        }

        // Layout-Toggle
        const layoutButtons = document.querySelectorAll('.layout-btn');
        if (layoutButtons.length > 0) {
            layoutButtons.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const targetBtn = e.currentTarget;
                    layoutButtons.forEach(b => b.classList.remove('active'));
                    targetBtn.classList.add('active');
                    
                    const container = document.getElementById('panoramaContainer');
                    const layout = targetBtn.dataset.layout;
                    
                    container.classList.remove('compact', 'masonry', 'shelf');
                    if (layout === 'compact') {
                        container.classList.add('compact');
                    } else if (layout === 'masonry') {
                        container.classList.add('masonry');
                    } else if (layout === 'shelf') {
                        container.classList.add('shelf');
                    }
                });
            });
        }

        // Modal schließen
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const backdrop = document.getElementById('aetcarObjectModalBackdrop');
                const isOpen = backdrop && backdrop.classList.contains('active');
                if (isOpen) {
                    this.closeModal();
                }
            }
        });

        const legacyModal = document.getElementById('modal');
        if (legacyModal) {
            legacyModal.addEventListener('click', (e) => {
                if (e.target && e.target.id === 'modal') {
                    this.closeModal();
                }
            });
        }
    }

    renderTagDropdown() {
        const dropdown = document.getElementById('tagFilterDropdown');
        if (!dropdown) return;
        const entries = Object.entries(this.tagCounts).sort((a, b) => b[1].count - a[1].count);
        dropdown.innerHTML = '';
        const clearBtn = document.createElement('button');
        clearBtn.className = 'tag-clear';
        clearBtn.textContent = 'Alle Schlagworte entfernen';
        clearBtn.addEventListener('click', () => {
            this.selectedTags.clear();
            dropdown.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
            this.renderPanorama();
        });
        dropdown.appendChild(clearBtn);

        entries.forEach(([tag, info]) => {
            const option = document.createElement('div');
            option.className = 'tag-option';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = tag;
            checkbox.checked = this.selectedTags.has(tag);

            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    this.selectedTags.add(tag);
                } else {
                    this.selectedTags.delete(tag);
                }
                this.renderPanorama();
            });

            const label = document.createElement('span');
            label.textContent = info.label || tag;

            const count = document.createElement('span');
            count.className = 'tag-count';
            count.textContent = info.count;

            option.appendChild(checkbox);
            option.appendChild(label);
            option.appendChild(count);
            dropdown.appendChild(option);
        });
    }

    renderActiveTags() {
        const container = document.getElementById('activeTags');
        if (!container) return;
        container.innerHTML = '';

        const tags = (window.FilterToolbar && typeof FilterToolbar.getState === 'function')
            ? (FilterToolbar.getState().tags || [])
            : Array.from(this.selectedTags);

        if (!tags || tags.length === 0) return;

        tags.forEach(tag => {
            const badge = document.createElement('div');
            badge.className = 'tag-badge';
            const label = this.tagCounts[tag]?.label || this.tagLabels.get(this.normalizeTag(tag)) || tag;
            badge.innerHTML = `<span>${label}</span>`;
            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = '×';
            closeBtn.addEventListener('click', () => {
                if (window.FilterToolbar && typeof FilterToolbar.removeFacetValue === 'function') {
                    FilterToolbar.removeFacetValue('tags', tag);
                }
            });
            badge.appendChild(closeBtn);
            container.appendChild(badge);
        });
    }
}

// Globale Funktion für HTML onclick
function closeModal() {
    if (window.panoramaManager) {
        window.panoramaManager.closeModal();
    }
}

// Initialisierung
document.addEventListener('DOMContentLoaded', () => {
    window.panoramaManager = new PanoramaManager();
    window.panoramaManager.init();
});
