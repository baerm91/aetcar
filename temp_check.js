// Map Configuration
        const CONFIG = {
            CENTER: [48.115, 16.865],
            ZOOM: 13,
            MIN_ZOOM: 10,
            MAX_ZOOM: 18
        };

        // Check for embed mode
        if (new URLSearchParams(window.location.search).has('embed')) {
            document.body.classList.add('embed');
        }

        // State
        let allData = [];
        let filteredData = [];
        let themesData = null;
        let themesLoaded = false;
        let markers = L.markerClusterGroup({
            maxClusterRadius: 30,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            iconCreateFunction: function (cluster) {
                const count = cluster.getChildCount();

                // Check if all markers in cluster are dimmed
                const allMarkers = cluster.getAllChildMarkers();
                const allDimmed = allMarkers.every(marker =>
                    marker.options.icon && marker.options.icon.options.className.includes('dimmed')
                );

                let size = 'small';
                if (count > 10) size = 'medium';
                if (count > 50) size = 'large';

                const className = 'marker-cluster marker-cluster-' + size + (allDimmed ? ' dimmed' : '');

                return L.divIcon({
                    html: '<div>' + count + '</div>',
                    className: className,
                    iconSize: L.point(40, 40)
                });
            }
        });

        let annotationLayer = L.layerGroup();

        let selectedFilters = {
            dateMin: 100,
            dateMax: 400,
            types: new Set(),
            materials: new Set(),
            tags: new Set(),
            search: '',
            ids: null
        };

        // Themen-Daten - werden dynamisch aus themes.json geladen
        let THEMES = [];
        let currentTheme = null;

        // Themen aus themes.json laden
        function loadThemesFromJson() {
            return fetch('assets/themes.json')
                .then(res => res.json())
                .then(data => {
                    themesData = data;
                    themesLoaded = true;

                    // Themen für Fundkarte filtern (pages enthält "fundkarte" oder "fundkarte.html")
                    const fundkarteThemeIds = data.by_page?.fundkarte || [];

                    THEMES = fundkarteThemeIds.map(themeId => {
                        const theme = data.themes[themeId];
                        if (!theme) return null;

                        // Filter-Funktion basierend auf inv-Array erstellen
                        const invSet = new Set(theme.inv || []);
                        const filterFn = invSet.size > 0
                            ? (obj => obj.Inventarnummer && invSet.has(obj.Inventarnummer))
                            : (obj => true);

                        return {
                            id: theme.theme_id,
                            icon: '📍',  // Default Icon
                            title: theme.title,
                            subtitle: theme.subtitle || '',
                            description: theme.story || '',
                            filter: filterFn,
                            center: (theme.center_lat && theme.center_lng)
                                ? [theme.center_lat, theme.center_lng]
                                : [48.115, 16.865],  // Default Carnuntum
                            zoom: theme.zoom || 13,
                            inv: theme.inv || []
                        };
                    }).filter(Boolean);

                    console.log(`Themen für Fundkarte geladen: ${THEMES.length}`);
                    return THEMES;
                })
                .catch(err => {
                    console.error('Fehler beim Laden der Themen:', err);
                    THEMES = [];
                    return THEMES;
                });
        }

        // Initialize Map with dark tiles
        const map = L.map('map', {
            center: CONFIG.CENTER,
            zoom: CONFIG.ZOOM,
            minZoom: CONFIG.MIN_ZOOM,
            maxZoom: CONFIG.MAX_ZOOM,
            zoomControl: true
        });

        // Dark map tiles (CartoDB Dark Matter)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(map);

        map.addLayer(markers);
        map.addLayer(annotationLayer);

        // Karten-Daten Layer (archäologische Bereiche aus karten_daten.json)
        let kartenDatenLayers = {};
        let kartenDatenLayerGroup = L.layerGroup().addTo(map);

        // Lade karten_daten.json und erstelle GeoJSON-Layer
        fetch('assets/karten_daten.json')
            .then(res => res.json())
            .then(data => {
                if (data.layers) {
                    Object.entries(data.layers).forEach(([layerName, layerData]) => {
                        const color = layerData.color || '#3498db';
                        const geojsonLayer = L.geoJSON(layerData.geojson, {
                            style: {
                                color: color,
                                weight: 2,
                                opacity: 0.8,
                                fillColor: color,
                                fillOpacity: 0.2
                            },
                            onEachFeature: (feature, layer) => {
                                layer.bindPopup(`<div class="popup-content"><div class="popup-body"><div class="popup-title">${layerName}</div></div></div>`, {
                                    maxWidth: 250,
                                    minWidth: 200
                                });
                            }
                        });
                        kartenDatenLayers[layerName] = geojsonLayer;
                        geojsonLayer.addTo(kartenDatenLayerGroup);
                    });
                    console.log('Karten-Daten Layer geladen:', Object.keys(kartenDatenLayers));
                }
            })
            .catch(err => console.error('Fehler beim Laden der Karten-Daten:', err));

        // Move zoom control to right
        map.zoomControl.setPosition('topright');

        // Load Data (Sarkophage) + Annotationen + Themen parallel
        Promise.all([
            fetch('data.json').then(res => res.json()),
            fetch('assets/annotationen.json').then(res => res.json()).catch(() => null),
            loadThemesFromJson()
        ])
            .then(([data, annotations, themes]) => {
                allData = (Array.isArray(data) ? data : [])
                    .map(obj => {
                        if (!obj) return null;
                        const latRaw = obj.lat;
                        const lngRaw = obj.lng;
                        if (latRaw === null || latRaw === undefined || latRaw === '') return null;
                        if (lngRaw === null || lngRaw === undefined || lngRaw === '') return null;
                        const lat = Number(latRaw);
                        const lng = Number(lngRaw);
                        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
                        obj.lat = lat;
                        obj.lng = lng;
                        if (typeof obj.certain !== 'boolean') {
                            obj.certain = true;
                        }
                        return obj;
                    })
                    .filter(Boolean);

                // Themen-Liste rendern (THEMES wurde durch loadThemesFromJson befüllt)
                renderThemesList();

                // Handle ids parameter (comma-separated inventory numbers)
                const urlParams = new URLSearchParams(window.location.search);
                const idsParam = urlParams.get('ids');
                let idsFilter = null;
                let idsSet = null;
                if (idsParam) {
                    idsSet = new Set(idsParam.split(',').map(id => decodeURIComponent(id.trim())));
                    idsFilter = obj => obj.Inventarnummer && idsSet.has(obj.Inventarnummer);
                    console.log('IDs Filter aktiv:', idsSet);
                }

                // Initialize FilterToolbar with central logic
                FilterToolbar.init({
                    facets: ['material', 'type', 'tags', 'gender', 'beigaben'],
                    onFilterChange: (filtered, state) => {
                        // Apply idsFilter on top of toolbar filtering
                        if (idsFilter) {
                            filteredData = filtered.filter(idsFilter);
                        } else {
                            filteredData = filtered;
                        }
                        updateMarkers();
                        updateResultCount();

                        // Zoom to filtered objects if ids parameter is set
                        if (idsSet && filteredData.length > 0) {
                            zoomToObjects(filteredData);

                            // Open popup for first matching object after a short delay
                            setTimeout(() => {
                                const firstObj = filteredData.find(obj => obj.lat && obj.lng);
                                if (firstObj) {
                                    // Find and click the marker for this object
                                    markers.eachLayer(marker => {
                                        const markerLatLng = marker.getLatLng();
                                        if (Math.abs(markerLatLng.lat - firstObj.lat) < 0.0001 &&
                                            Math.abs(markerLatLng.lng - firstObj.lng) < 0.0001) {
                                            showPopup(firstObj, marker);
                                        }
                                    });
                                }
                            }, 1500); // Wait 1.5 seconds after zoom
                        }
                    },
                    onReset: () => {
                        // Don't reset idsFilter - keep URL parameter active
                    }
                });

                // Set data - FilterToolbar will trigger onFilterChange
                FilterToolbar.setData(allData);

                if (annotations && annotations.items) {
                    renderAnnotations(annotations.items);
                }
            })
            .catch(err => {
                console.error('Error loading data:', err);
            });

        // Get approximate location from Standort text
        function getLocationFromStandort(text) {
            const locations = {
                'Bad Deutsch-Altenburg': { lat: 48.1311, lng: 16.9064 },
                'Petronell-Carnuntum': { lat: 48.1128, lng: 16.8567 },
                'Hainburg': { lat: 48.1467, lng: 16.9456 },
                'Carnuntum': { lat: 48.1150, lng: 16.8600 },
                'default': { lat: 48.115, lng: 16.865 }
            };

            for (const [key, coords] of Object.entries(locations)) {
                if (text && text.toLowerCase().includes(key.toLowerCase())) {
                    return coords;
                }
            }
            return locations.default;
        }

        // Burial Type zu CSS-Klasse mapping (fuer Graeber)
        function getBurialTypeClass(burialType) {
            if (!burialType) return 'unbekannt';
            const type = burialType.toLowerCase()
                .replace(/ae/g, 'ae').replace(/oe/g, 'oe').replace(/ue/g, 'ue')
                .replace(/\s+/g, '');
            
            if (type.includes('sarkophag')) return 'sarkophag';
            if (type.includes('koerpergrab') || type.includes('korpergrab')) return 'koerpergrab';
            if (type.includes('skelett')) return 'skelett';
            if (type.includes('brandgrab') || type.includes('brandgrubengrab')) return 'brandgrubengrab';
            if (type.includes('bustum')) return 'bustum';
            if (type.includes('urne')) return 'urne';
            if (type.includes('grabbau')) return 'grabbau';
            if (type.includes('grabstein')) return 'grabstein';
            if (type.includes('ziegelplattengrab')) return 'ziegelplattengrab';
            if (type.includes('steinplattengrab')) return 'steinplattengrab';
            if (type.includes('ziegelgrab')) return 'ziegelgrab';
            if (type.includes('steinkiste')) return 'steinkiste';
            if (type.includes('knochenreste')) return 'knochenreste';
            if (type.includes('mumie')) return 'mumie';
            return 'unbekannt';
        }

        // Update Markers (Sarkophage + Graeber)
        // Always show ALL markers, highlight filtered ones, dim the rest
        function updateMarkers() {
            markers.clearLayers();

            // Build set of filtered inventory numbers for quick lookup
            const filteredInvs = new Set(filteredData.map(obj => obj.Inventarnummer).filter(Boolean));
            const hasActiveFilter = filteredData.length < allData.length;

            allData.forEach(obj => {
                if (!obj.lat || !obj.lng) return;

                const inv = obj.Inventarnummer || '';
                const isFiltered = !hasActiveFilter || filteredInvs.has(inv);
                const isGrab = obj._source === 'grab';

                // Determine marker class based on source type
                let className;
                let markerSize;
                let markerAnchor;

                if (isGrab) {
                    // Graeber: Use burial-marker with type-specific color
                    const typeClass = getBurialTypeClass(obj._burial_type || obj.Typ);
                    className = 'burial-marker ' + typeClass;
                    markerSize = [18, 18];
                    markerAnchor = [9, 9];
                } else {
                    // Sarkophage: Use custom-marker
                    className = 'custom-marker';
                    if (!obj.certain) className += ' uncertain';
                    markerSize = [24, 24];
                    markerAnchor = [12, 12];
                }

                // Apply dimming based on filter state
                if (hasActiveFilter) {
                    className += isFiltered ? ' highlighted' : ' dimmed';
                }

                const markerIcon = L.divIcon({
                    html: '',
                    className: className,
                    iconSize: markerSize,
                    iconAnchor: markerAnchor
                });

                const marker = L.marker([obj.lat, obj.lng], { icon: markerIcon });
                marker.on('click', () => showPopup(obj, marker));
                markers.addLayer(marker);
            });
        }

        // Render annotations (separate layer)
        function renderAnnotations(items) {
            annotationLayer.clearLayers();
            if (!Array.isArray(items)) return;

            items.forEach(item => {
                if (!item) return;
                const lat = Number(item.lat);
                const lng = Number(item.lng);
                if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

                const color = item.color || '#f6b15d';
                const title = item.title || item.label || 'Landmarke';
                const description = item.kurzbeschreibung || item.description || '';

                // 3D-Modell Links verarbeiten (kann Array oder String sein)
                let modelLinksHtml = '';
                if (item['3d_modell']) {
                    const modelLinks = Array.isArray(item['3d_modell']) ? item['3d_modell'] : [item['3d_modell']];
                    if (modelLinks.length > 0) {
                        modelLinksHtml = '<div style="margin-bottom: 12px;">';
                        modelLinks.forEach((link, index) => {
                            const linkText = modelLinks.length > 1 ? `3D-Modell ${index + 1}` : '3D-Modell';
                            modelLinksHtml += `<a href="${link}" target="_blank" rel="noopener noreferrer" style="display: inline-block; margin-right: 8px; margin-bottom: 6px; padding: 6px 12px; background: rgba(246, 177, 93, 0.16); color: #f6b15d; border-radius: 6px; text-decoration: none; font-size: 12px; font-weight: 600; transition: background 0.2s;" onmouseover="this.style.background='rgba(246, 177, 93, 0.25)'" onmouseout="this.style.background='rgba(246, 177, 93, 0.16)'">${linkText}</a>`;
                        });
                        modelLinksHtml += '</div>';
                    }
                }

                const popupHtml = `
                    <div class="popup-content">
                        <div class="popup-body">
                            <div class="popup-title">${title}</div>
                            ${description ? `<div class="popup-location" style="margin-bottom: 12px; line-height: 1.5;">${description}</div>` : ''}
                            ${modelLinksHtml}
                            ${item.link ? `<button class="popup-details-btn" onclick="window.open('${item.link}', '_blank', 'noopener,noreferrer')">Mehr erfahren</button>` : ''}
                        </div>
                    </div>
                `;

                const icon = L.divIcon({
                    html: item.icon || '⭐',
                    className: 'annotation-icon',
                    iconSize: [26, 26],
                    iconAnchor: [13, 13]
                });

                const popupOpts = { maxWidth: 300, minWidth: 280, closeButton: true, autoClose: true, closeOnClick: true };

                if (item.radius) {
                    const radius = Number(item.radius) || 40;
                    L.circle([lat, lng], {
                        radius,
                        color,
                        weight: item.line_width || 2,
                        fillColor: color,
                        fillOpacity: 0.2
                    }).bindPopup(popupHtml, popupOpts).addTo(annotationLayer);
                }

                L.marker([lat, lng], { icon }).bindPopup(popupHtml, popupOpts).addTo(annotationLayer);
            });
        }

        // Show Popup
        window.aetcarAdjustMapPopupImage = function (imgEl) {
            try {
                if (!imgEl) return;
                const frame = imgEl.closest('.popup-image-frame');
                if (!frame) return;

                imgEl.style.width = '100%';
                imgEl.style.height = '100%';
                imgEl.style.objectFit = 'contain';
                imgEl.style.objectPosition = 'center';
                imgEl.style.position = '';
                imgEl.style.left = '';
                imgEl.style.top = '';
                imgEl.style.transform = '';
                imgEl.style.transformOrigin = '';

                const nw = imgEl.naturalWidth;
                const nh = imgEl.naturalHeight;
                if (!(nw > 0 && nh > 0)) return;

                if (nh > nw) {
                    const w = frame.clientWidth;
                    const h = frame.clientHeight;
                    imgEl.style.width = h + 'px';
                    imgEl.style.height = w + 'px';
                    imgEl.style.position = 'absolute';
                    imgEl.style.left = '50%';
                    imgEl.style.top = '50%';
                    imgEl.style.transformOrigin = 'center';
                    imgEl.style.transform = 'translate(-50%, -50%) rotate(-90deg)';
                }
            } catch (e) {
                // no-op
            }
        };

        function showPopup(obj, marker) {
            const inv = obj.Inventarnummer || '';
            const title = obj['Titel / Darstellung'] || inv || 'Unbekanntes Objekt';
            const location = obj.Standort || obj.Texteingabe || 'Unbekannter Standort';
            const date = obj.Datierung || 'Undatiert';
            const material = obj['Material / Technik (für Objektbeschriftung)'] || 'Unbekannt';
            const imageUrl = inv ? `extracted_sarcophagi/${inv}.jpg` : '';
            const externalImageUrl = obj && obj.foto_url ? String(obj.foto_url).trim() : '';
            const externalImageAttr = externalImageUrl ? externalImageUrl.replace(/\"/g, '&quot;') : '';

            const popupContent = `
                <div class="popup-content">
                    ${imageUrl ? `
                        <div class="popup-image-frame">
                            <img class="popup-image" src="${imageUrl}" data-fallback="${externalImageAttr}" alt="${title}" onload="window.aetcarAdjustMapPopupImage(this)" onerror="const fb=this.dataset.fallback; if(fb){this.onerror=null; this.src=fb;} else {this.parentElement.innerHTML='<div class=popup-image-placeholder>Kein Bild verfügbar</div>'}">
                            ${obj.Objektname ? `<div class="popup-badge">${obj.Objektname}</div>` : ''}
                        </div>
                    ` : '<div class="popup-image-placeholder">Kein Bild verfügbar</div>'}

                    <div class="popup-body">
                        <div class="popup-title">${title}</div>
                        <div class="popup-location">📍 ${location.length > 40 ? location.substring(0, 40) + '...' : location}</div>
                        <div class="popup-meta">
                            <div class="popup-meta-item">
                                <div class="popup-meta-label">Datierung</div>
                                <div class="popup-meta-value">${date}</div>
                            </div>
                            <div class="popup-meta-item">
                                <div class="popup-meta-label">Material</div>
                                <div class="popup-meta-value">${material.length > 15 ? material.substring(0, 15) + '...' : material}</div>
                            </div>
                        </div>
                        <button class="popup-details-btn" onclick="openDetails('${inv}')">Details ansehen</button>
                    </div>
                </div>
            `;

            map.closePopup();
            const opts = { maxWidth: 300, minWidth: 280, closeButton: true, autoClose: true, closeOnClick: true };
            marker.unbindPopup();
            marker.bindPopup(popupContent, opts);
            marker.openPopup();
        }

        // Open Details Modal
        window.openDetails = function (invNum) {
            const obj = allData.find(o => o.Inventarnummer === invNum);
            if (obj && typeof window.openObjectModal === 'function') {
                const imageUrl = invNum ? `extracted_sarcophagi/${invNum}.jpg` : '';
                // Use currently displayed/filtered objects as navigation dataset
                const displayedItems = filteredData.filter(o => o.lat && o.lng);
                window.openObjectModal(obj, {
                    imageUrl,
                    dataset: displayedItems,
                    imageUrlBuilder: (obj) => {
                        const inv = obj && obj.Inventarnummer;
                        return inv && obj && obj.lat && obj.lng ? `extracted_sarcophagi/${inv}.jpg` : '';
                    }
                });
            }
        };

        // Update Result Count
        function updateResultCount() {
            const countEl = document.getElementById('resultCount');
            if (countEl) {
                countEl.textContent = filteredData.length;
            }
            // Also update toolbar count from partial
            const toolbarCountEl = document.getElementById('toolbarObjectCount');
            if (toolbarCountEl) {
                toolbarCountEl.textContent = filteredData.length;
            }
        }

        // Zoom to filtered objects
        function zoomToObjects(objects) {
            if (!objects || objects.length === 0) return;

            const validObjects = objects.filter(obj => obj.lat && obj.lng);
            if (validObjects.length === 0) return;

            if (validObjects.length === 1) {
                // Single object: zoom to it
                map.setView([validObjects[0].lat, validObjects[0].lng], 16);
            } else {
                // Multiple objects: fit bounds
                const bounds = L.latLngBounds(validObjects.map(obj => [obj.lat, obj.lng]));
                map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
            }
        }

        // ========== THEMEN PANEL ==========

        // Render Themes List
        function renderThemesList() {
            const container = document.getElementById('themesList');
            if (!container) return;

            container.innerHTML = '';

            THEMES.forEach(theme => {
                const matchingObjects = allData.filter(theme.filter);
                const count = matchingObjects.length;

                const card = document.createElement('div');
                card.className = 'theme-card';
                card.dataset.themeId = theme.id;
                card.innerHTML = `
                    <div class="theme-card-header">
                        <div class="theme-icon">${theme.icon}</div>
                        <div class="theme-title">${theme.title}</div>
                    </div>
                    <div class="theme-subtitle">${theme.subtitle}</div>
                    <div class="theme-count">${count} Objekte</div>
                `;

                card.addEventListener('click', () => showThemeDetail(theme));
                container.appendChild(card);
            });
        }

        // Show Theme Detail
        function showThemeDetail(theme) {
            currentTheme = theme;
            const matchingObjects = allData.filter(theme.filter);

            // Update detail view
            document.getElementById('themeDetailTitle').innerHTML = `${theme.icon} ${theme.title}`;
            document.getElementById('themeDetailDescription').textContent = theme.description;

            // Calculate stats
            const materials = {};
            const dates = [];
            matchingObjects.forEach(obj => {
                const mat = obj['Material / Technik (für Objektbeschriftung)'] || 'Unbekannt';
                materials[mat] = (materials[mat] || 0) + 1;
                if (obj['Suchdatum Anfang']) dates.push(obj['Suchdatum Anfang']);
            });

            const topMaterial = Object.entries(materials).sort((a, b) => b[1] - a[1])[0];
            const avgDate = dates.length > 0 ? Math.round(dates.reduce((a, b) => a + b, 0) / dates.length) : null;

            document.getElementById('themeDetailStats').innerHTML = `
                <div class="theme-stat">
                    <div class="theme-stat-value">${matchingObjects.length}</div>
                    <div class="theme-stat-label">Objekte</div>
                </div>
                <div class="theme-stat">
                    <div class="theme-stat-value">${avgDate ? avgDate + ' n.Chr.' : '–'}</div>
                    <div class="theme-stat-label">Ø Datierung</div>
                </div>
            `;

            // Switch views
            document.getElementById('themesList').style.display = 'none';
            document.getElementById('themeDetail').classList.add('active');

            // Highlight card
            document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('active'));
            const activeCard = document.querySelector(`.theme-card[data-theme-id="${theme.id}"]`);
            if (activeCard) activeCard.classList.add('active');

            // Apply theme filter to map
            applyThemeToMap(theme);
        }

        // Apply Theme to Map
        function applyThemeToMap(theme) {
            const matchingObjects = allData.filter(theme.filter);

            // Update filtered data
            filteredData = matchingObjects.filter(obj => {
                // Still apply other filters
                if (selectedFilters.search) {
                    const searchText = [
                        obj['Titel / Darstellung'],
                        obj.Beschreibung,
                        obj.Inventarnummer,
                        obj.Objektname
                    ].filter(Boolean).join(' ').toLowerCase();
                    if (!searchText.includes(selectedFilters.search.toLowerCase())) return false;
                }
                return true;
            });

            updateMarkers();
            updateResultCount();

            // Fly to theme location
            map.flyTo(theme.center, theme.zoom, { duration: 1 });
        }

        // Back to Themes List
        function showThemesList() {
            currentTheme = null;
            document.getElementById('themesList').style.display = 'block';
            document.getElementById('themeDetail').classList.remove('active');
            document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('active'));

            // Reset to all data - trigger FilterToolbar to refilter
            FilterToolbar.setData(allData, getAdditionalFilter());
            map.flyTo(CONFIG.CENTER, CONFIG.ZOOM, { duration: 1 });
        }

        // Theme Panel Event Listeners
        document.getElementById('themeBackBtn')?.addEventListener('click', showThemesList);

        document.getElementById('themeShowOnMap')?.addEventListener('click', () => {
            if (currentTheme) {
                map.flyTo(currentTheme.center, currentTheme.zoom + 1, { duration: 1 });
            }
        });

        document.getElementById('themeExploreAll')?.addEventListener('click', () => {
            if (currentTheme) {
                const matchingObjects = allData.filter(currentTheme.filter);
                const ids = matchingObjects.map(obj => obj.Inventarnummer).filter(Boolean);
                const params = new URLSearchParams();
                if (ids.length > 0) {
                    params.set('ids', ids.join(','));
                }
                window.location.href = 'steinzelt.html?' + params.toString();
            }
        });

        document.getElementById('themesCloseBtn')?.addEventListener('click', () => {
            document.getElementById('themesPanel').style.display = 'none';
        });

        // Themen Toggle Button
        document.getElementById('themesToggleBtn')?.addEventListener('click', () => {
            document.getElementById('themesPanel').style.display = 'flex';
        });

        // ========== END THEMEN PANEL ==========

        // Helper function to get additional filters for FilterToolbar
        function getAdditionalFilter() {
            return {
                search: selectedFilters.search
            };
        }

        // Dropdown toggle is now handled by FilterToolbar.js

        // Reset Filters
        document.getElementById('toolbarResetFilters')?.addEventListener('click', () => {
            selectedFilters = {
                dateMin: 100,
                dateMax: 400,
                types: new Set(),
                materials: new Set(),
                tags: new Set(),
                search: ''
            };

            // Reset UI
            document.querySelectorAll('.dropdown-item.checked').forEach(item => {
                item.classList.remove('checked');
            });
            const searchEl = document.getElementById('toolbarSearch');
            if (searchEl) searchEl.value = '';

            // Clear URL parameters to remove ids filter
            const url = new URL(window.location);
            url.searchParams.delete('ids');
            url.searchParams.delete('search');
            url.searchParams.delete('tags');
            url.searchParams.delete('material');
            url.searchParams.delete('type');
            url.searchParams.delete('gender');
            window.history.replaceState({}, '', url);

            FilterToolbar.reset();
        });

        // Global Search
        const globalSearch = document.getElementById('toolbarSearch');
        let searchTimeout;
        globalSearch?.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                selectedFilters.search = e.target.value;
                // Search is handled by FilterToolbar
            }, 300);
        });

        // Start animations after page load
        window.addEventListener('load', () => {
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
        });
    