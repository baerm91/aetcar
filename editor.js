const MAP_IMAGE_PATH = 'assets/map.jpg';
const EXPORT_MARGIN = 30;
const EXPORT_ZIP_NAME = 'sarcophagi_export.zip';

// Initialize Map
const map = L.map('map', {
    crs: L.CRS.Simple,
    minZoom: -2,
    maxZoom: 2,
    zoomSnap: 0.5,
    zoomDelta: 0.5
});

// Image Dimensions
const bounds = [[0, 0], [8192, 7069]]; // Height, Width
const image = L.imageOverlay(MAP_IMAGE_PATH, bounds, { crossOrigin: true }).addTo(map);
map.fitBounds(bounds);

// Load source image for canvas exports
const sourceImage = new Image();
sourceImage.crossOrigin = 'anonymous';
sourceImage.src = MAP_IMAGE_PATH;
const sourceImageReady = new Promise((resolve, reject) => {
    sourceImage.onload = () => resolve(sourceImage);
    sourceImage.onerror = (err) => reject(err || new Error('Quelle konnte nicht geladen werden.'));
});

// Feature Group to store drawn items
const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

// Initialize Draw Control
const drawControl = new L.Control.Draw({
    draw: {
        polygon: {
            allowIntersection: false,
            showArea: true
        },
        polyline: false,
        circle: false,
        circlemarker: false,
        marker: false,
        rectangle: true
    },
    edit: {
        featureGroup: drawnItems
    }
});
map.addControl(drawControl);

// Handle Created Event
map.on(L.Draw.Event.CREATED, function (e) {
    const layer = e.layer;

    // Prompt for Inventory Number
    const invNum = prompt("Bitte Inventarnummer eingeben (z.B. CAR-S-1234):");

    if (invNum) {
        layer.feature = layer.feature || {};
        layer.feature.properties = layer.feature.properties || {};
        layer.feature.properties.Inventarnummer = invNum;

        // Add tooltip
        layer.bindTooltip(invNum, { permanent: true, direction: 'center' });

        drawnItems.addLayer(layer);
    }
});

// Export Functionality
document.getElementById('export-btn').addEventListener('click', function () {
    const data = [];

    drawnItems.eachLayer(function (layer) {
        const invNum = layer.feature.properties.Inventarnummer;

        if (layer instanceof L.Polygon && !(layer instanceof L.Rectangle)) {
            const latlngs = layer.getLatLngs();
            // Leaflet Polygons can be nested arrays (holes/multipolygons).
            // We assume simple polygons (first ring).
            let coords = latlngs;
            if (Array.isArray(latlngs[0]) && typeof latlngs[0][0] !== 'number') {
                // It's likely [ [lat,lng], ... ] or [ [ [lat,lng], ... ] ]
                // Check if the first element is an array (inner ring) or object (LatLng)
                // L.LatLng is an object, not an array.
                if (Array.isArray(latlngs[0])) {
                    coords = latlngs[0]; // Take outer ring
                }
            }

            const simpleCoords = coords.map(ll => [ll.lat, ll.lng]);

            data.push({
                Inventarnummer: invNum,
                type: 'polygon',
                latlngs: simpleCoords
            });
        } else if (layer instanceof L.Rectangle) {
            const bounds = layer.getBounds();
            data.push({
                Inventarnummer: invNum,
                type: 'rectangle',
                bounds: [
                    [bounds.getSouthWest().lat, bounds.getSouthWest().lng],
                    [bounds.getNorthEast().lat, bounds.getNorthEast().lng]
                ]
            });
        }
    });

    // Create and download JSON file
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "coordinates.json");
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
});

// Load Functionality
const exportImagesBtn = document.getElementById('export-images-btn');

document.getElementById('load-btn').addEventListener('click', function () {
    document.getElementById('file-input').click();
});

document.getElementById('file-input').addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = JSON.parse(e.target.result);

            // Clear existing items? Maybe ask user? For now, let's just add to them.
            // drawnItems.clearLayers(); 

            data.forEach(item => {
                let layer;
                if (item.type === 'rectangle' && item.bounds) {
                    layer = L.rectangle(item.bounds);
                } else if (item.type === 'polygon' && item.latlngs) {
                    layer = L.polygon(item.latlngs);
                }

                if (layer) {
                    layer.feature = {
                        type: 'Feature',
                        properties: {
                            Inventarnummer: item.Inventarnummer
                        }
                    };
                    layer.bindTooltip(item.Inventarnummer, { permanent: true, direction: 'center' });
                    drawnItems.addLayer(layer);
                }
            });

            alert('Daten erfolgreich geladen!');
        } catch (err) {
            console.error(err);
            alert('Fehler beim Laden der Datei.');
        }
    };
    reader.readAsText(file);
});

exportImagesBtn.addEventListener('click', async () => {
    const layers = [];
    drawnItems.eachLayer(layer => layers.push(layer));

    if (!layers.length) {
        alert('Keine Flächen vorhanden, die exportiert werden könnten.');
        return;
    }

    exportImagesBtn.disabled = true;
    const originalLabel = exportImagesBtn.textContent;
    exportImagesBtn.textContent = 'Export läuft…';

    try {
        await sourceImageReady;
    } catch (error) {
        console.error('Fehler beim Laden des Kartenbildes:', error);
        alert('Das Kartenbild konnte nicht geladen werden. Bitte lade die Seite neu.');
        return;
    }

    try {
        const imgWidth = sourceImage.width;
        const imgHeight = sourceImage.height;
        const zip = new JSZip();
        const folder = zip.folder('sarcophagi');
        let successCount = 0;
        let skippedCount = 0;

        for (const layer of layers) {
            const invNum = layer?.feature?.properties?.Inventarnummer || 'unbenannt';
            const latlngs = extractLatLngs(layer);
            if (!latlngs.length) {
                skippedCount += 1;
                continue;
            }

            const bbox = computeBoundingBox(latlngs);
            if (!bbox) {
                skippedCount += 1;
                continue;
            }

            const expanded = expandAndClampBoundingBox(bbox, imgWidth, imgHeight, EXPORT_MARGIN);
            if (!expanded) {
                skippedCount += 1;
                continue;
            }

            const { minX, minY, width, height } = expanded;

            try {
                const blob = await renderRegionToBlob(sourceImage, minX, minY, width, height);
                const safeName = sanitizeFilename(invNum) || `sarcophagus_${successCount + 1}`;
                folder.file(`${safeName}.jpg`, blob);
                successCount += 1;
            } catch (err) {
                console.error(`Fehler beim Rendern von ${invNum}:`, err);
                skippedCount += 1;
            }
        }

        if (!successCount) {
            alert('Keine Ausschnitte konnten exportiert werden.');
            return;
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        saveAs(zipBlob, EXPORT_ZIP_NAME);
        alert(`Export abgeschlossen: ${successCount} Bilder, ${skippedCount} übersprungen.`);
    } catch (error) {
        console.error('Exportfehler:', error);
        alert('Beim Export ist ein Fehler aufgetreten. Details siehe Konsole.');
    } finally {
        exportImagesBtn.disabled = false;
        exportImagesBtn.textContent = originalLabel;
    }
});

function extractLatLngs(layer) {
    if (!layer || typeof layer.getLatLngs !== 'function') {
        return [];
    }
    let latlngs = layer.getLatLngs();
    if (!Array.isArray(latlngs)) {
        return [];
    }
    // Leaflet rectangles/polygons can nest arrays (first ring)
    if (Array.isArray(latlngs[0])) {
        latlngs = latlngs[0];
    }
    return latlngs;
}

function computeBoundingBox(latlngs) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    latlngs.forEach(point => {
        const x = point.lng;
        const y = point.lat;
        if (Number.isFinite(x) && Number.isFinite(y)) {
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
        }
    });

    if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
        return null;
    }

    return { minX, minY, maxX, maxY };
}

function expandAndClampBoundingBox(bbox, imgWidth, imgHeight, margin) {
    const minX = Math.max(0, Math.floor(bbox.minX - margin));
    const minY = Math.max(0, Math.floor(bbox.minY - margin));
    const maxX = Math.min(imgWidth, Math.ceil(bbox.maxX + margin));
    const maxY = Math.min(imgHeight, Math.ceil(bbox.maxY + margin));

    const width = maxX - minX;
    const height = maxY - minY;

    if (width <= 0 || height <= 0) {
        return null;
    }

    return { minX, minY, width, height };
}

function renderRegionToBlob(image, sx, sy, width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, sx, sy, width, height, 0, 0, width, height);

    return new Promise((resolve, reject) => {
        canvas.toBlob(blob => {
            if (blob) {
                resolve(blob);
            } else {
                reject(new Error('Canvas konnte nicht in Blob konvertiert werden.'));
            }
        }, 'image/jpeg', 0.95);
    });
}

function sanitizeFilename(name) {
    return String(name).trim().replace(/[\\/:*?"<>|]/g, '_');
}
