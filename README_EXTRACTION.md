# Sarkophag-Bilder Extraktion

## Übersicht
Dieses Skript extrahiert automatisch einzelne Sarkophag-Bilder aus dem Gesamtbild basierend auf den Koordinaten in `coordinates.json`.

## Dateien
- **extract_sarcophagi.py** - Python-Skript zur Extraktion
- **extract_sarcophagi.bat** - Batch-Datei zum einfachen Ausführen
- **extracted_sarcophagi/** - Ausgabeordner mit allen extrahierten Bildern

## Verwendung

### Methode 1: Batch-Datei (einfach)
Doppelklick auf `extract_sarcophagi.bat`

### Methode 2: Kommandozeile
```bash
python extract_sarcophagi.py
```

## Konfiguration
Im Skript können folgende Parameter angepasst werden:

```python
INPUT_IMAGE = "assets/map.jpg"           # Quellbild
COORDINATES_FILE = "assets/coordinates.json"  # Koordinaten-Datei
OUTPUT_DIR = "extracted_sarcophagi"      # Ausgabeordner
MARGIN_PIXELS = 50                       # Rand um jedes Objekt (in Pixeln)
```

## Ergebnis
- **Erfolgreich extrahiert:** 152 Sarkophag-Bilder
- **Fehlgeschlagen:** 9 (Koordinaten außerhalb des Bildbereichs)
- **Format:** JPEG mit 95% Qualität
- **Dateinamen:** Entsprechen den Inventarnummern (z.B. `CAR-S-2001.jpg`)

## Funktionsweise
1. Lädt das Hauptbild (`map.jpg`)
2. Liest alle Koordinaten aus `coordinates.json`
3. Für jedes Objekt:
   - Berechnet die Bounding Box (für Rechtecke und Polygone)
   - Fügt einen konfigurierbaren Rand hinzu (Standard: 50px)
   - Schneidet das Bild aus
   - Speichert es mit der Inventarnummer als Dateinamen

## Unterstützte Koordinatentypen
- **rectangle:** Rechteckige Bereiche mit bounds
- **polygon:** Polygonale Bereiche (wird zu Bounding Box konvertiert)

## Fehlgeschlagene Extraktionen
Folgende Objekte konnten nicht extrahiert werden (Koordinaten außerhalb des Bildes):
- CAR-S-1932
- CAR-S-1930
- CAR-S-1931
- CAR-S-1998
- CAR-S-1997
- CAR-S-2041
- CAR-S-2042
- CAR-S-2056
- CAR-S-2057
