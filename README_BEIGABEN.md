# Beigaben-System für Sarkophage

Dieses System ermöglicht das Erfassen und Anzeigen von Grabbeigaben zu den Sarkophagen.

## Workflow

### 1. Excel-Vorlage erstellen (einmalig)
```bash
python create_beigaben_template.py
```
Erstellt `assets/beigaben.xlsx` mit:
- Dropdown für Sarkophag-Inventarnummern (aus data.json)
- Dropdown für Kategorien
- Beispielzeile (bitte überschreiben)

### 2. Beigaben in Excel eintragen

Öffne `assets/beigaben.xlsx` und fülle die Spalten aus:

| Spalte | Beschreibung | Beispiel |
|--------|--------------|----------|
| **Sarkophag_Inventarnummer** | Inventarnummer des Sarkophags | CAR-S-1845 |
| **Beigabe_ID** | Eindeutige ID | CAR-S-1845-B001 |
| **Titel** | Bezeichnung | Bronzemünze des Antoninus Pius |
| **Kategorie** | Münze, Keramik, Schmuck, Glas, Metall, Knochen, Textil, Sonstiges | Münze |
| **Beschreibung** | Kurze Beschreibung | Sesterz mit Porträt des Kaisers |
| **Bild_URL** | Link zum Objektfoto | https://... |
| **Bild_URL_Rueckseite** | Zweiter Link (z.B. Münz-Rückseite) | https://... |
| **Emuseum_URL** | Link zur eMuseum-Detailseite | https://emuseum... |
| **Datierung** | Zeitliche Einordnung | 138-161 n. Chr. |
| **Material** | Material der Beigabe | Bronze |
| **Masse** | Maße/Gewicht | Ø 32mm, 25g |
| **Fundlage** | Position im Sarkophag | Kopfbereich |
| **Bemerkungen** | Zusätzliche Anmerkungen | Gut erhalten |

### 3. JSON konvertieren
```bash
python convert_beigaben.py
```
Oder per Doppelklick auf `convert_beigaben.bat`

Erstellt `assets/beigaben.json` mit:
- Gruppierung nach Sarkophag-Inventarnummer
- Statistik nach Kategorien

### 4. Anzeige im Modal

Die Beigaben werden automatisch im Objekt-Detail-Modal angezeigt, wenn ein Sarkophag geöffnet wird.

**Features:**
- Kategorie-spezifische Icons (Münze, Keramik, Schmuck, etc.)
- Vorschaubilder (Vorder- und Rückseite bei Münzen)
- Link zu eMuseum für Details
- Metadaten (Datierung, Material, Fundlage)

## Dateien

```
AETCAR/
├── assets/
│   ├── create_beigaben_template.py  # Erstellt Excel-Vorlage
│   ├── convert_beigaben.py          # Konvertiert Excel → JSON
│   ├── convert_beigaben.bat         # Batch-Datei für Konvertierung
│   ├── beigaben.xlsx                # Excel-Datei zum Bearbeiten
│   └── beigaben.json                # Generierte JSON (nicht manuell bearbeiten)
└── objectModal.js                   # Lädt und zeigt Beigaben an
```

## Voraussetzungen

- Python 3.x
- openpyxl (`pip install openpyxl`)

## Kategorie-Icons

| Kategorie | Icon |
|-----------|------|
| Münze | 💰 (paid) |
| Keramik | 🏺 (vase) |
| Schmuck | 💎 (diamond) |
| Glas | 🍷 (wine_bar) |
| Metall | 🔧 (hardware) |
| Knochen | 🦴 (skeleton) |
| Textil | 👔 (checkroom) |
| Sonstiges | 📦 (category) |
