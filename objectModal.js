(function () {
    const MODAL_BACKDROP_ID = 'aetcarObjectModalBackdrop';
    const MODAL_ID = 'aetcarObjectModal';

    // Load Material Symbols font
    if (!document.querySelector('link[href*="Material+Symbols+Outlined"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200';
        document.head.appendChild(link);
    }

    let lastActiveElement = null;
    let previousOverflow = null;
    let currentOnClose = null;

    // Navigation state
    let currentDataset = [];
    let currentIndex = 0;
    let currentImageUrlBuilder = null;

    // Beigaben cache
    let beigabenData = null;
    let beigabenLoading = false;

    // Individuen cache
    let individuenData = null;
    let individuenLoading = false;

    async function loadIndividuenData() {
        if (individuenData !== null) return individuenData;
        
        // Check if steinzelt.js already loaded or is loading the data
        if (window.__steinzeltIndividuenData) {
            individuenData = window.__steinzeltIndividuenData;
            return individuenData;
        }
        
        // If steinzelt.js is loading, wait for it
        if (window.__steinzeltDataLoading) {
            await new Promise(resolve => {
                const check = () => {
                    if (!window.__steinzeltDataLoading && window.__steinzeltIndividuenData) {
                        individuenData = window.__steinzeltIndividuenData;
                        resolve();
                    } else if (!window.__steinzeltDataLoading) {
                        resolve(); // Loading done but no data, fall through to fetch
                    } else {
                        setTimeout(check, 50);
                    }
                };
                check();
            });
            if (individuenData) return individuenData;
        }
        
        if (individuenLoading) return null;
        individuenLoading = true;
        try {
            const response = await fetch('assets/individuen.json');
            if (response.ok) {
                individuenData = await response.json();
            } else {
                individuenData = { by_sarkophag: {}, all: [] };
            }
        } catch (e) {
            individuenData = { by_sarkophag: {}, all: [] };
        }
        individuenLoading = false;
        return individuenData;
    }

    function getIndividuenForSarkophag(inventarnummer) {
        if (!individuenData || !individuenData.by_sarkophag) return [];
        return individuenData.by_sarkophag[inventarnummer] || [];
    }

    async function loadBeigabenData() {
        if (beigabenData !== null) return beigabenData;
        
        // Check if steinzelt.js already loaded the data
        if (window.__steinzeltBeigabenData) {
            beigabenData = window.__steinzeltBeigabenData;
            return beigabenData;
        }
        
        // If steinzelt.js is loading, wait for it
        if (window.__steinzeltDataLoading) {
            await new Promise(resolve => {
                const check = () => {
                    if (!window.__steinzeltDataLoading && window.__steinzeltBeigabenData) {
                        beigabenData = window.__steinzeltBeigabenData;
                        resolve();
                    } else if (!window.__steinzeltDataLoading) {
                        resolve();
                    } else {
                        setTimeout(check, 50);
                    }
                };
                check();
            });
            if (beigabenData) return beigabenData;
        }
        
        if (beigabenLoading) return null;
        beigabenLoading = true;
        try {
            const response = await fetch('assets/beigaben.json');
            if (response.ok) {
                beigabenData = await response.json();
            } else {
                beigabenData = { by_sarkophag: {}, all: [] };
            }
        } catch (e) {
            beigabenData = { by_sarkophag: {}, all: [] };
        }
        beigabenLoading = false;
        return beigabenData;
    }

    function getBeigabenForSarkophag(inventarnummer) {
        if (!beigabenData || !beigabenData.by_sarkophag) return [];
        return beigabenData.by_sarkophag[inventarnummer] || [];
    }

    function getKategorieIcon(kategorie) {
        const icons = {
            'Muenze': 'paid',
            'Münze': 'paid',
            'Keramik': 'deployed_code',
            'Gefäß': 'deployed_code',
            'Vase': 'deployed_code',
            'Schmuck': 'diamond',
            'Glas': 'liquor',
            'Metall': 'hardware',
            'Knochen': 'skeleton',
            'Textil': 'checkroom',
            'Ziegel': 'grid_view',
            'Bauteil': 'construction',
            'Naturmaterial': 'eco',
            'Sonstiges': 'category'
        };
        return icons[kategorie] || 'category';
    }

    function normalizeText(value) {
        if (value === null || value === undefined) return '';
        return String(value).trim();
    }

    function firstNonEmpty(...values) {
        for (const v of values) {
            const s = normalizeText(v);
            if (s) return s;
        }
        return '';
    }

    function parseTags(raw) {
        if (!raw) return [];
        if (Array.isArray(raw)) {
            return raw.map(v => normalizeText(v)).filter(Boolean);
        }
        return String(raw)
            .split(',')
            .map(v => normalizeText(v))
            .filter(Boolean);
    }

    function ensureModal() {
        let backdrop = document.getElementById(MODAL_BACKDROP_ID);
        if (backdrop) return backdrop;

        backdrop = document.createElement('div');
        backdrop.id = MODAL_BACKDROP_ID;
        backdrop.className = 'aetcar-modal-backdrop';
        backdrop.setAttribute('role', 'dialog');
        backdrop.setAttribute('aria-modal', 'true');
        backdrop.setAttribute('aria-hidden', 'true');

        const modal = document.createElement('div');
        modal.id = MODAL_ID;
        modal.className = 'aetcar-modal view-mode-research'; // Default mode

        modal.innerHTML = `
            <div class="aetcar-modal-header">
                <div class="aetcar-modal-top-bar">
                    <div class="aetcar-modal-info">
                        <h1 class="aetcar-modal-title" id="aetcarModalTitle"></h1>
                        <div class="aetcar-modal-subtitle" id="aetcarModalSubtitle"></div>
                    </div>
                    <div class="aetcar-modal-controls">
                        <div class="aetcar-nav-buttons" id="aetcarModalNavButtons" style="display:none;">
                            <button type="button" class="aetcar-icon-btn aetcar-nav-prev" id="aetcarModalPrevBtn" title="Vorheriges Objekt">
                                <span class="material-symbols-outlined">chevron_left</span>
                            </button>
                            <span class="aetcar-nav-counter" id="aetcarModalNavCounter">1 / 1</span>
                            <button type="button" class="aetcar-icon-btn aetcar-nav-next" id="aetcarModalNextBtn" title="Nächstes Objekt">
                                <span class="material-symbols-outlined">chevron_right</span>
                            </button>
                        </div>
                        <button type="button" class="aetcar-icon-btn" title="Teilen">
                            <span class="material-symbols-outlined">share</span>
                        </button>
                        <button type="button" class="aetcar-icon-btn" title="Link kopieren">
                            <span class="material-symbols-outlined">link</span>
                        </button>
                        <button type="button" class="aetcar-icon-btn aetcar-close-btn" id="aetcarModalCloseBtn" aria-label="Schließen">
                            <span class="material-symbols-outlined">close</span>
                        </button>
                    </div>
                </div>
                <div class="aetcar-modal-nav-bar">
                    <div class="aetcar-nav-actions" id="aetcarModalActions">
                        <!-- Navigation buttons injected here -->
                    </div>
                    <div class="aetcar-view-toggles">
                        <div class="aetcar-view-toggle" data-mode="public">Kurz erklärt</div>
                        <div class="aetcar-view-toggle active" data-mode="research">Forschung / Details</div>
                    </div>
                </div>
            </div>

            <div class="aetcar-modal-content">
                <div class="aetcar-content-container">
                    <!-- Media: Full-width Photo -->
                    <div class="aetcar-media-section">
                        <div class="aetcar-main-image-container aetcar-main-image-full">
                            <div id="aetcarModalMainImage" class="aetcar-main-image"></div>
                        </div>
                        <!-- Stats (Dimensions) -->
                        <div class="aetcar-stats-grid" id="aetcarModalStats" style="display:none"></div>
                    </div>

                    <!-- Public View Only -->
                    <div class="view-public-only">
                        <h3 class="aetcar-section-header">Kurzbeschreibung</h3>
                        <div class="aetcar-story-text" id="aetcarModalStory"></div>
                    </div>

                    <!-- Research View: Structured Layout -->
                    <div class="view-research-only">
                        <!-- Datierung & Kontext Section -->
                        <div class="aetcar-dating-section">
                            <h3 class="aetcar-section-header aetcar-section-header-small">Datierung & Kontext</h3>
                            <div class="aetcar-dating-grid">
                                <!-- Allgemeine Zeitstellung -->
                                <div class="aetcar-dating-col aetcar-dating-main">
                                    <span class="aetcar-dating-label">Allgemeine Zeitstellung</span>
                                    <div class="aetcar-dating-value" id="aetcarModalDating"></div>
                                    <div id="aetcarModalDatingStatus"></div>
                                    <div class="aetcar-dating-desc">
                                        Basiert auf stilistischen Merkmalen der Reliefs und Grabbeigaben (Münzdatierung).
                                    </div>
                                </div>
                                <!-- Details (Material, Erhaltung, Maße) -->
                                <div class="aetcar-dating-col">
                                    <div class="aetcar-detail-list" id="aetcarModalDetailsList"></div>
                                </div>
                            </div>
                        </div>

                        <!-- Inschrift / Legende -->
                        <div id="aetcarModalInscriptionSection" class="aetcar-inscription-section" style="display:none;">
                            <h3 class="aetcar-section-header aetcar-section-header-small">Inschrift / Legende</h3>
                            <div class="aetcar-inscription-box" id="aetcarModalInscription"></div>
                        </div>

                        <!-- Individuen & Beigaben Side by Side -->
                        <div class="aetcar-two-col-section">
                            <!-- Individuals Section -->
                            <div class="aetcar-col-left">
                                <h3 class="aetcar-section-header aetcar-section-header-small">Individuen</h3>
                                <div class="aetcar-individuals-grid" id="aetcarModalIndividuals"></div>
                            </div>

                            <!-- Beigaben Section -->
                            <div class="aetcar-col-right">
                                <div class="aetcar-individuals-header">
                                    <h3 class="aetcar-section-header aetcar-section-header-small" style="margin-bottom:0">Beigaben</h3>
                                    <span class="aetcar-count-badge" id="aetcarModalBeigabenCount">0</span>
                                </div>
                                <div class="aetcar-beigaben-list" id="aetcarModalBeigaben"></div>
                            </div>
                        </div>

                        <!-- Schlagworte Section -->
                        <div class="aetcar-tags-section">
                            <h3 class="aetcar-section-header aetcar-section-header-small">Schlagworte</h3>
                            <div class="aetcar-individual-tags" id="aetcarModalTags"></div>
                        </div>
                    </div>

                    <!-- Footer -->
                    <div class="aetcar-modal-footer">
                        <div>
                            <h4 class="aetcar-section-header">Literatur / Publikationen</h4>
                            <ul class="aetcar-bib-list" id="aetcarModalBib">
                                <li class="aetcar-bib-item aetcar-unknown">Unbekannt</li>
                            </ul>
                        </div>
                        <div class="aetcar-meta-info">
                            <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.25rem;">
                                <span style="width:8px; height:8px; background:var(--modal-success); border-radius:50%; animation: pulse 2s infinite;"></span>
                                <span>Status: Erfasst</span>
                            </div>
                            <div>Objekt-ID: <span id="aetcarModalId" style="font-family:monospace; opacity:0.7;"></span></div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        backdrop.appendChild(modal);
        document.body.appendChild(backdrop);

        // Bind Events
        const closeBtn = modal.querySelector('#aetcarModalCloseBtn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => window.closeObjectModal());
        }

        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) {
                window.closeObjectModal();
            }
        });

        // Toggle View Mode
        const toggles = modal.querySelectorAll('.aetcar-view-toggle');
        toggles.forEach(toggle => {
            toggle.addEventListener('click', () => {
                const mode = toggle.getAttribute('data-mode');
                // Set active class on toggles
                toggles.forEach(t => t.classList.remove('active'));
                toggle.classList.add('active');

                // Set class on modal
                modal.classList.remove('view-mode-public', 'view-mode-research');
                modal.classList.add(`view-mode-${mode}`);
            });
        });

        // Navigation Buttons
        const prevBtn = modal.querySelector('#aetcarModalPrevBtn');
        const nextBtn = modal.querySelector('#aetcarModalNextBtn');
        if (prevBtn) {
            prevBtn.addEventListener('click', () => navigateToPrev());
        }
        if (nextBtn) {
            nextBtn.addEventListener('click', () => navigateToNext());
        }

        document.addEventListener('keydown', handleKeydown);

        return backdrop;
    }

    function handleKeydown(e) {
        const backdrop = document.getElementById(MODAL_BACKDROP_ID);
        if (!backdrop || !backdrop.classList.contains('active')) return;

        if (e.key === 'Escape') {
            e.preventDefault();
            window.closeObjectModal();
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            navigateToPrev();
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            navigateToNext();
        }
    }

    function navigateToPrev() {
        if (currentDataset.length <= 1) return;
        currentIndex = (currentIndex - 1 + currentDataset.length) % currentDataset.length;
        showCurrentItem();
    }

    function navigateToNext() {
        if (currentDataset.length <= 1) return;
        currentIndex = (currentIndex + 1) % currentDataset.length;
        showCurrentItem();
    }

    function showCurrentItem() {
        if (currentDataset.length === 0) return;
        const obj = currentDataset[currentIndex];
        const imageUrl = currentImageUrlBuilder ? currentImageUrlBuilder(obj) : '';
        populateModal(obj, imageUrl);
        updateNavCounter();
    }

    function updateNavCounter() {
        const modal = document.getElementById(MODAL_ID);
        if (!modal) return;

        const navButtons = modal.querySelector('#aetcarModalNavButtons');
        const counter = modal.querySelector('#aetcarModalNavCounter');
        const prevBtn = modal.querySelector('#aetcarModalPrevBtn');
        const nextBtn = modal.querySelector('#aetcarModalNextBtn');

        if (currentDataset.length > 1) {
            navButtons.style.display = 'flex';
            counter.textContent = `${currentIndex + 1} / ${currentDataset.length}`;
            // Disable buttons at boundaries (optional - currently wraps around)
            // prevBtn.disabled = currentIndex === 0;
            // nextBtn.disabled = currentIndex === currentDataset.length - 1;
        } else {
            navButtons.style.display = 'none';
        }
    }

    function setScrollLock(locked) {
        const root = document.documentElement;
        if (locked) {
            if (previousOverflow === null) {
                previousOverflow = root.style.overflow || '';
            }
            root.style.overflow = 'hidden';
        } else {
            if (previousOverflow !== null) {
                root.style.overflow = previousOverflow;
                previousOverflow = null;
            }
        }
    }

    function buildDetailItem(label, value) {
        const div = document.createElement('div');
        div.innerHTML = `
            <span class="aetcar-detail-label-s">${label}</span>
            <span class="aetcar-detail-value-s">${value}</span>
        `;
        return div;
    }

    function adjustImageOrientation() {
        const modal = document.getElementById(MODAL_ID);
        if (!modal) return;
        const img = modal.querySelector('.aetcar-main-image.is-portrait');
        const container = modal.querySelector('.aetcar-main-image-container');

        if (img && container) {
            const w = container.clientWidth;
            const h = container.clientHeight;

            // For portrait images, rotate to landscape to better fit the container
            // The container has a landscape aspect ratio (fixed height 20rem)
            // Rotate -90deg to make portrait images display in landscape
            
            img.style.width = h + 'px';
            img.style.height = w + 'px';
            img.style.objectFit = 'contain';
            img.style.position = 'absolute';
            img.style.left = '50%';
            img.style.top = '50%';
            img.style.transform = 'translate(-50%, -50%) rotate(-90deg)';
            img.style.transformOrigin = 'center';
        } else {
            const imgL = modal.querySelector('.aetcar-main-image:not(.is-portrait)');
            if (imgL) {
                imgL.style.width = '100%';
                imgL.style.height = '100%';
                imgL.style.objectFit = 'contain';
                imgL.style.position = '';
                imgL.style.left = '';
                imgL.style.top = '';
                imgL.style.transform = '';
                imgL.style.transformOrigin = '';
            }
        }
    }

    window.addEventListener('resize', adjustImageOrientation);

    function setMedia(container, imageUrl, altText, fallbackUrl) {
        container.innerHTML = '';
        container.style.backgroundImage = '';
        container.classList.remove('has-image');

        if (imageUrl) {
            const img = document.createElement('img');
            img.className = 'aetcar-main-image';
            img.alt = altText || 'Objektbild';

            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'contain';
            img.style.objectPosition = 'center';

            img.onerror = () => {
                const fb = (fallbackUrl === null || fallbackUrl === undefined) ? '' : String(fallbackUrl).trim();
                if (fb) {
                    img.onerror = null;
                    img.src = fb;

                    const modal = document.getElementById(MODAL_ID);
                    const fullscreenBtn = modal ? modal.querySelector('#aetcarModalFullscreen') : null;
                    if (fullscreenBtn) {
                        fullscreenBtn.href = fb;
                        fullscreenBtn.style.pointerEvents = '';
                        fullscreenBtn.style.opacity = '';
                    }
                    return;
                }

                container.innerHTML = '';
                container.classList.remove('has-image');
                const placeholder = document.createElement('div');
                placeholder.className = 'aetcar-media-placeholder';
                placeholder.textContent = 'Kein Bild verfügbar';
                container.appendChild(placeholder);
            };

            img.onload = () => {
                // More aggressive portrait detection: rotate if height > width
                // This ensures portrait images are displayed in landscape
                if (img.naturalHeight > img.naturalWidth) {
                    img.classList.add('is-portrait');
                } else {
                    img.classList.remove('is-portrait');
                }
                adjustImageOrientation();
            };

            img.src = imageUrl;

            container.appendChild(img);
            container.classList.add('has-image');
            container.setAttribute('aria-label', altText || 'Objektbild');
            return;
        }

        const placeholder = document.createElement('div');
        placeholder.className = 'aetcar-media-placeholder';
        placeholder.textContent = 'Kein Bild verfügbar';
        container.appendChild(placeholder);
    }

    // Coordinates cache
    let coordinatesData = null;
    let coordinatesLoading = false;

    async function loadCoordinatesData() {
        if (coordinatesData !== null) return coordinatesData;
        
        // Check if steinzelt.js already loaded the data
        if (window.__steinzeltCoordinatesData) {
            coordinatesData = window.__steinzeltCoordinatesData;
            return coordinatesData;
        }
        
        // If steinzelt.js is loading, wait for it
        if (window.__steinzeltDataLoading) {
            await new Promise(resolve => {
                const check = () => {
                    if (!window.__steinzeltDataLoading && window.__steinzeltCoordinatesData) {
                        coordinatesData = window.__steinzeltCoordinatesData;
                        resolve();
                    } else if (!window.__steinzeltDataLoading) {
                        resolve();
                    } else {
                        setTimeout(check, 50);
                    }
                };
                check();
            });
            if (coordinatesData) return coordinatesData;
        }
        
        if (coordinatesLoading) return null;
        coordinatesLoading = true;
        try {
            const response = await fetch('assets/coordinates.json');
            if (response.ok) {
                coordinatesData = await response.json();
            } else {
                coordinatesData = [];
            }
        } catch (e) {
            coordinatesData = [];
        }
        coordinatesLoading = false;
        return coordinatesData;
    }

    async function buildActions(container, obj) {
        container.innerHTML = '';
        const invNum = getInventory(obj);
        if (!invNum) return;

        const inv = encodeURIComponent(invNum);

        // 1. Sarkophage (Always) - previously "3D Ansicht"
        const toPanorama = document.createElement('a');
        toPanorama.className = 'aetcar-nav-btn';
        toPanorama.href = `panorama_optimized.html?ids=${inv}`;
        toPanorama.innerHTML = `<span class="material-symbols-outlined">view_in_ar</span> Sarkophage`;
        container.appendChild(toPanorama);

        // 2. Fundkarte (If coordinates exist in object data)
        // Check for lat/lng properties (numbers)
        if (obj.lat && obj.lng) {
            const toMap = document.createElement('a');
            toMap.className = 'aetcar-nav-btn';
            toMap.href = `fundkarte.html?ids=${inv}`;
            toMap.innerHTML = `<span class="material-symbols-outlined">map</span> Fundkarte`;
            container.appendChild(toMap);
        }

        // 3. Steinzelt (If object exists in coordinates.json)
        try {
            const coords = await loadCoordinatesData();
            if (coords && Array.isArray(coords)) {
                const inSteinzelt = coords.some(c => c.Inventarnummer === invNum);
                if (inSteinzelt) {
                    const toSteinzelt = document.createElement('a');
                    toSteinzelt.className = 'aetcar-nav-btn';
                    toSteinzelt.href = `steinzelt.html?ids=${inv}`;
                    toSteinzelt.innerHTML = `<span class="material-symbols-outlined">roofing</span> Steinzelt`;
                    container.appendChild(toSteinzelt);
                }
            }
        } catch (e) {
            console.warn('Could not check Steinzelt availability', e);
        }
    }

    function getObjectTitle(obj) {
        const raw = firstNonEmpty(
            obj && obj['Titel / Darstellung'],
            obj && obj.Titel,
            obj && obj.title,
            obj && obj.Bezeichnung,
            obj && obj.Objektname,
            obj && obj.Typ
        );
        if (!raw) return '';
        return String(raw).trim();
    }

    function getInventory(obj) {
        return firstNonEmpty(obj && obj.Inventarnummer, obj && obj.inv, obj && obj.inventory);
    }

    function openObjectModal(obj, options = {}) {
        const backdrop = ensureModal();
        const modal = document.getElementById(MODAL_ID);
        if (!modal) return;

        lastActiveElement = document.activeElement;
        currentOnClose = typeof options.onClose === 'function' ? options.onClose : null;

        // Set up navigation dataset
        if (options.dataset && Array.isArray(options.dataset) && options.dataset.length > 0) {
            currentDataset = options.dataset;
            // Find index of current object in dataset
            const invNum = getInventory(obj);
            currentIndex = currentDataset.findIndex(item => getInventory(item) === invNum);
            if (currentIndex === -1) currentIndex = 0;
        } else {
            currentDataset = [obj];
            currentIndex = 0;
        }

        // Store image URL builder function
        currentImageUrlBuilder = options.imageUrlBuilder || null;

        // Populate modal with current object
        populateModal(obj, options.imageUrl);
        updateNavCounter();

        backdrop.classList.add('active');
        backdrop.setAttribute('aria-hidden', 'false');
        setScrollLock(true);

        requestAnimationFrame(() => {
            adjustImageOrientation();
        });

        const closeBtn = modal.querySelector('#aetcarModalCloseBtn');
        if (closeBtn) closeBtn.focus();
    }

    function populateModal(obj, imageUrl) {
        const modal = document.getElementById(MODAL_ID);
        if (!modal) return;

        // Populate Fields
        const invNum = getInventory(obj);
        const typ = firstNonEmpty(obj && obj.Typ);
        const title = getObjectTitle(obj);
        const displayTitle = title || typ || 'Objekt';
        const displayInv = invNum || '';
        const location = firstNonEmpty(obj && obj.Texteingabe, obj && obj.Fundort);
        const description = firstNonEmpty(obj && obj.Beschreibung, obj && obj.description);
        const dating = firstNonEmpty(obj && obj.Datierung, obj && obj.datierung);
        const material = firstNonEmpty(obj && obj['Material / Technik (für Objektbeschriftung)'], obj && obj.Material);
        const dimensions = firstNonEmpty(obj && obj['Maße'], obj && obj.Maße);
        const storage = firstNonEmpty(obj && obj.Standort);
        const inscription = firstNonEmpty(obj && obj['Beschriftung(en) / Inschrift(en)']);
        const literature = firstNonEmpty(obj && obj['Literatur / Publikationen'], obj && obj.Literatur);
        const individuals = firstNonEmpty(obj && obj['Individuen'], obj && obj.Individuen);
        const tags = parseTags(firstNonEmpty(obj && obj.Schlagworte, obj && obj.tags));

        // Header
        modal.querySelector('#aetcarModalTitle').textContent = displayTitle;

        const subtitleEl = modal.querySelector('#aetcarModalSubtitle');
        subtitleEl.innerHTML = '';
        if (location) {
            const span = document.createElement('span');
            span.innerHTML = `<span class="material-symbols-outlined" style="font-size:14px; vertical-align:text-bottom">location_on</span> ${location}`;
            subtitleEl.appendChild(span);
        }
        if (displayInv) {
            const span = document.createElement('span');
            span.className = 'inv';
            span.textContent = displayInv;
            if (location) {
                const dot = document.createElement('span');
                dot.textContent = '·';
                dot.style.margin = '0 6px';
                subtitleEl.appendChild(dot);
            }
            subtitleEl.appendChild(span);
        }

        // Actions
        buildActions(modal.querySelector('#aetcarModalActions'), obj);

        const fallbackImageUrl = firstNonEmpty(
            obj && obj.foto_url,
            obj && obj.Foto_URL,
            obj && obj.Abb,
            obj && obj.Abbildung,
            obj && obj.abb,
            obj && obj.abbildung
        );
        const normalizedFallback = fallbackImageUrl ? String(fallbackImageUrl).trim() : '';
        const resolvedImageUrl = imageUrl ? imageUrl : normalizedFallback;

        // Media
        setMedia(
            modal.querySelector('#aetcarModalMainImage'),
            resolvedImageUrl,
            displayTitle,
            imageUrl ? normalizedFallback : ''
        );

        // Make image clickable to open in fullscreen
        const mainImageContainer = modal.querySelector('.aetcar-main-image-container');
        if (mainImageContainer && resolvedImageUrl) {
            mainImageContainer.style.cursor = 'pointer';
            mainImageContainer.onclick = () => {
                window.open(resolvedImageUrl, '_blank');
            };
        } else if (mainImageContainer) {
            mainImageContainer.style.cursor = 'default';
            mainImageContainer.onclick = null;
        }

        // Stats (Dimensions)
        const statsEl = modal.querySelector('#aetcarModalStats');
        if (statsEl) {
            statsEl.innerHTML = '';
            statsEl.style.display = 'none';
        }

        // Public Story
        modal.querySelector('#aetcarModalStory').textContent = description || 'Keine Beschreibung verfügbar.';

        // Research Details - Dating
        const datingEl = modal.querySelector('#aetcarModalDating');
        if (dating) {
            // Format dating - only add "n. Chr." if not already present
            const datingText = String(dating).trim();
            const hasNChr = /n\.\s*Chr\.?/i.test(datingText);
            if (hasNChr) {
                datingEl.innerHTML = datingText;
            } else {
                datingEl.innerHTML = `${datingText}<span class="aetcar-dating-suffix">n. Chr.</span>`;
            }
        } else {
            datingEl.innerHTML = `<span class="aetcar-unknown">Unbekannt</span>`;
        }

        // Dating Status
        const datingStatusEl = modal.querySelector('#aetcarModalDatingStatus');
        if (datingStatusEl) {
            if (dating) {
                datingStatusEl.innerHTML = `
                    <div style="display:flex; align-items:center; gap:0.375rem;">
                        <span class="material-symbols-outlined" style="font-size:14px; color:var(--modal-success);">verified</span>
                        <span style="font-size:0.6875rem; font-weight:700; color:var(--modal-success); text-transform:uppercase; letter-spacing:0.05em;">Gesichert</span>
                    </div>
                `;
            } else {
                datingStatusEl.innerHTML = '';
            }
        }

        // Details List (Material, Erhaltungszustand)
        const detailsList = modal.querySelector('#aetcarModalDetailsList');
        detailsList.innerHTML = '';

        detailsList.appendChild(buildDetailItem('Material', material || 'Unbekannt'));
        detailsList.appendChild(buildDetailItem('Erhaltungszustand',
            firstNonEmpty(obj && obj['Zustandsbeschreibung (kurz, aktuell)']) || 'Unbekannt'));

        const dimensionsText = dimensions ? String(dimensions).replace(/_x000d_/g, '\n').trim() : '';
        const dimensionsHtml = dimensionsText ? dimensionsText.replace(/\n/g, '<br>') : '';
        detailsList.appendChild(buildDetailItem('Maße', dimensionsHtml || 'Unbekannt'));

        // Inschrift / Legende Section
        const inscriptionSection = modal.querySelector('#aetcarModalInscriptionSection');
        const inscriptionEl = modal.querySelector('#aetcarModalInscription');
        if (inscriptionSection && inscriptionEl) {
            if (inscription) {
                const inscriptionText = String(inscription).replace(/_x000d_/g, '\n').trim();
                const inscriptionHtml = inscriptionText.replace(/\n/g, '<br>');
                inscriptionEl.innerHTML = inscriptionHtml;
                inscriptionSection.style.display = '';
            } else {
                inscriptionEl.innerHTML = '';
                inscriptionSection.style.display = 'none';
            }
        }

        // Individuen Section (nur wenn in individuen.json vorhanden)
        const individualsEl = modal.querySelector('#aetcarModalIndividuals');
        individualsEl.innerHTML = '';

        loadIndividuenData().then(() => {
            const individuenList = getIndividuenForSarkophag(invNum);
            individualsEl.innerHTML = '';

            if (individuenList && individuenList.length > 0) {
                // Render from JSON
                individuenList.forEach((ind, idx) => {
                    const isFemale = (ind.geschlecht && ind.geschlecht.toLowerCase() === 'weiblich');
                    const isMale = (ind.geschlecht && ind.geschlecht.toLowerCase() === 'männlich');
                    const iconClass = isFemale ? 'female' : (isMale ? 'male' : 'unknown');
                    const iconName = isFemale ? 'woman' : (isMale ? 'man' : 'person');
                    
                    // Build description text
                    const descParts = [];
                    if (ind.geschlecht) descParts.push(ind.geschlecht);
                    if (ind.sterbealter) descParts.push(`adult (${ind.sterbealter})`);
                    if (ind.kategorie) descParts.push(ind.kategorie);
                    const descText = descParts.join(', ') || '';
                    
                    // Check for C14 data
                    const hasC14 = ind.c14 || ind.C14 || (ind.anmerkungen && ind.anmerkungen.toLowerCase().includes('c14'));

                    const card = document.createElement('div');
                    card.className = 'aetcar-individual-card';
                    card.innerHTML = `
                        <div class="aetcar-individual-icon ${iconClass}">
                            <span class="material-symbols-outlined">${iconName}</span>
                        </div>
                        <div class="aetcar-individual-info">
                            <h4>${ind.bezeichnung || 'Individuum ' + String.fromCharCode(65 + idx)}</h4>
                            ${descText ? `<p>${descText}</p>` : ''}
                        </div>
                        ${hasC14 ? '<span class="aetcar-c14-badge">C14 OK</span>' : ''}
                    `;
                    individualsEl.appendChild(card);
                });
            } else {
                const unknownCard = document.createElement('div');
                unknownCard.className = 'aetcar-individual-card';
                unknownCard.innerHTML = `
                    <div class="aetcar-individual-icon unknown">
                        <span class="material-symbols-outlined">help_outline</span>
                    </div>
                    <div class="aetcar-individual-info">
                        <h4 class="aetcar-unknown">Keine Individuen erfasst</h4>
                    </div>
                `;
                individualsEl.appendChild(unknownCard);
            }
        });

        // Beigaben Section - load from external beigaben.json
        const beigabenEl = modal.querySelector('#aetcarModalBeigaben');
        const beigabenCountEl = modal.querySelector('#aetcarModalBeigabenCount');
        beigabenEl.innerHTML = '';

        // Show loading state
        beigabenCountEl.textContent = '...';

        // Load beigaben data and render as simple cards
        loadBeigabenData().then(() => {
            const beigabenList = getBeigabenForSarkophag(invNum);
            beigabenEl.innerHTML = '';

            if (beigabenList.length > 0) {
                beigabenCountEl.textContent = beigabenList.length;

                // Render each beigabe as a simple card
                beigabenList.forEach(beigabe => {
                    const icon = getKategorieIcon(beigabe.kategorie);
                    const card = document.createElement('div');
                    card.className = 'aetcar-beigabe-card';
                    
                    // Build subtitle from available info
                    const subtitle = beigabe.beschreibung || beigabe.material || beigabe.kategorie || '';
                    
                    card.innerHTML = `
                        <div class="aetcar-beigabe-icon">
                            <span class="material-symbols-outlined">${icon}</span>
                        </div>
                        <div class="aetcar-beigabe-info">
                            <span class="aetcar-beigabe-name">${beigabe.titel || 'Beigabe'}</span>
                            ${subtitle ? `<span class="aetcar-beigabe-subtitle">${subtitle}</span>` : ''}
                        </div>
                    `;
                    
                    // Make card clickable if has eMuseum link
                    if (beigabe.emuseum_url) {
                        card.style.cursor = 'pointer';
                        card.addEventListener('click', () => {
                            window.open(beigabe.emuseum_url, '_blank');
                        });
                    }
                    
                    beigabenEl.appendChild(card);
                });
            } else {
                beigabenCountEl.textContent = '0';
                const unknownCard = document.createElement('div');
                unknownCard.className = 'aetcar-beigabe-card';
                unknownCard.innerHTML = `
                    <div class="aetcar-beigabe-icon">
                        <span class="material-symbols-outlined">help_outline</span>
                    </div>
                    <div class="aetcar-beigabe-info">
                        <span class="aetcar-beigabe-name aetcar-unknown">Noch nicht erfasst</span>
                    </div>
                `;
                beigabenEl.appendChild(unknownCard);
            }
        });

        const tagsEl = modal.querySelector('#aetcarModalTags');
        if (tagsEl) {
            tagsEl.innerHTML = '';
            if (tags.length > 0) {
                tags.forEach(t => {
                    const chip = document.createElement('span');
                    chip.className = 'aetcar-individual-tag';
                    chip.textContent = t;
                    chip.tabIndex = 0;
                    chip.setAttribute('role', 'button');
                    chip.style.cursor = 'pointer';

                    const addToTagFilter = () => {
                        if (!window.FilterToolbar) return;
                        if (typeof FilterToolbar.addFacetValue === 'function') {
                            FilterToolbar.addFacetValue('tags', t);
                            return;
                        }
                        if (typeof FilterToolbar.getState === 'function' && typeof FilterToolbar.setFacetValues === 'function') {
                            const state = FilterToolbar.getState() || {};
                            const current = Array.isArray(state.tags) ? state.tags : [];
                            if (!current.includes(t)) {
                                FilterToolbar.setFacetValues('tags', current.concat([t]));
                            }
                        }
                    };

                    chip.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        addToTagFilter();
                    });

                    chip.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            addToTagFilter();
                        }
                    });
                    tagsEl.appendChild(chip);
                });
            } else {
                const chip = document.createElement('span');
                chip.className = 'aetcar-individual-tag aetcar-unknown';
                chip.textContent = 'Keine Schlagworte';
                tagsEl.appendChild(chip);
            }
        }

        // Literature / Bibliography
        const bibList = modal.querySelector('#aetcarModalBib');
        bibList.innerHTML = '';
        if (literature) {
            // Split by semicolon and clean up
            const items = literature.split(';').map(s => s.trim()).filter(Boolean);
            if (items.length > 0) {
                items.forEach(item => {
                    const li = document.createElement('li');
                    li.className = 'aetcar-bib-item';
                    li.textContent = item;
                    bibList.appendChild(li);
                });
            } else {
                bibList.innerHTML = '<li class="aetcar-bib-item aetcar-unknown">Unbekannt</li>';
            }
        } else {
            bibList.innerHTML = '<li class="aetcar-bib-item aetcar-unknown">Unbekannt</li>';
        }

        // Footer
        modal.querySelector('#aetcarModalId').textContent = invNum || 'Unbekannt';

        // Scroll content to top
        const content = modal.querySelector('.aetcar-modal-content');
        if (content) content.scrollTop = 0;
    }

    function closeObjectModal() {
        const backdrop = document.getElementById(MODAL_BACKDROP_ID);
        if (!backdrop) return;

        backdrop.classList.remove('active');
        backdrop.setAttribute('aria-hidden', 'true');
        setScrollLock(false);

        if (currentOnClose) {
            try { currentOnClose(); } catch { }
        }
        currentOnClose = null;

        if (lastActiveElement) {
            try { lastActiveElement.focus(); } catch { }
        }
        lastActiveElement = null;
    }

    // Preload all data on page load for faster modal opening
    function preloadAllData() {
        // On steinzelt page, steinzelt.js loads all data - skip preloading
        if (window.location.pathname.includes('steinzelt')) {
            return;
        }
        loadIndividuenData();
        loadBeigabenData();
        loadCoordinatesData();
    }

    // Start preloading after page is fully loaded (not on steinzelt)
    window.addEventListener('load', () => {
        setTimeout(preloadAllData, 200);
    });

    window.openObjectModal = openObjectModal;
    window.closeObjectModal = closeObjectModal;
    window.preloadModalData = preloadAllData;
})();
