# 🏛️ Sarkophag Panorama - Komplette Anleitung

## Übersicht
Das Panorama-System zeigt alle extrahierten Sarkophag-Bilder in einer interaktiven Galerie mit intelligenter Filterung und platzsparendem Layout.

## 🚀 Schnellstart

### Option 1: Alles auf einmal (Empfohlen)
```bash
update_panorama.bat
```
Dies führt automatisch aus:
1. Extraktion aller Sarkophag-Bilder
2. Start des Webservers
3. Öffnet Browser automatisch

### Option 2: Schrittweise
```bash
# 1. Bilder extrahieren
extract_sarcophagi.bat

# 2. Server starten
start_panorama.bat
```

### Option 3: Manuell
```bash
# 1. Bilder extrahieren
python extract_sarcophagi.py

# 2. Server starten
python -m http.server 8000

# 3. Browser öffnen
http://localhost:8000/panorama_optimized.html
```

## 📁 Dateistruktur

```
AETCAR/
├── assets/
│   ├── map.jpg                    # Hauptbild
│   └── coordinates.json           # Koordinaten
├── extracted_sarcophagi/          # Extrahierte Bilder (152 Stück)
│   ├── CAR-S-1925.jpg
│   ├── CAR-S-1926.jpg
│   └── ...
├── extract_sarcophagi.py          # Extraktions-Skript
├── panorama_optimized.html        # Hauptansicht (empfohlen)
├── panorama.html                  # Einfache Ansicht
├── panorama.js                    # JavaScript-Logik
├── index_panorama.html            # Übersichtsseite
├── start_panorama.bat             # Server-Start
└── update_panorama.bat            # Kompletter Update-Prozess
```

## 🎯 Funktionen im Detail

### 1. Suchfunktion
- **Echtzeit-Suche**: Tippen Sie einfach los, Ergebnisse erscheinen sofort
- **Inventarnummer-Suche**: Z.B. "2001" findet "CAR-S-2001"
- **Teilstring-Suche**: "19" findet alle 19xx-Sarkophage

### 2. Filter-System
| Filter | Beschreibung | Beispiel |
|--------|--------------|----------|
| **Alle** | Zeigt alle verfügbaren Sarkophage | 152 Objekte |
| **19xx Serie** | Nur Inventarnummern CAR-S-19xx | ~80 Objekte |
| **20xx Serie** | Nur Inventarnummern CAR-S-20xx | ~72 Objekte |

### 3. Layout-Modi

#### Raster-Layout (Standard)
- Gleichmäßige Anordnung in Grid
- Optimale Übersicht
- Beste Performance

#### Kompakt-Layout
- Minimale Abstände
- Maximale Anzahl sichtbar
- Platzsparend

### 4. Größenanpassung
- **Slider-Bereich**: 150px - 400px
- **Standard**: 250px
- **Echtzeit-Anpassung**: Keine Verzögerung
- **Responsive**: Passt sich automatisch an

### 5. Detailansicht (Modal)
Klick auf eine Karte öffnet:
- **Großes Bild**: Bis zu 70% Viewport-Höhe
- **Metadaten**:
  - Inventarnummer
  - Typ
  - Material
  - Maße
  - Fundort
  - Datierung
  - Beschreibung

**Schließen**:
- ESC-Taste
- Klick außerhalb
- "Schließen"-Button

## 🎨 Visuelle Features

### Hover-Effekte
- Karte hebt sich an
- Grüner Schatten erscheint
- Bild zoomt leicht
- Sanfte Animationen

### Farbschema
- **Hintergrund**: Dunkles Grau (#1a1a1a)
- **Karten**: Mittleres Grau (#2d2d2d)
- **Akzent**: Grün (#4CAF50)
- **Text**: Weiß/Hellgrau

### Responsive Breakpoints
- **Desktop**: > 768px - Volle Features
- **Tablet**: 768px - Angepasstes Layout
- **Mobile**: < 768px - Kompakte Ansicht

## 📊 Statistiken & Monitoring

Die Ansicht zeigt live:
```
Angezeigt: 152 von 152 Sarkophagen
```

Nach Filterung z.B.:
```
Angezeigt: 45 von 152 Sarkophagen
```

## ⚙️ Konfiguration

### Extraktions-Parameter ändern
In `extract_sarcophagi.py`:
```python
MARGIN_PIXELS = 50      # Rand um Objekte (Standard: 50px)
OUTPUT_DIR = "..."      # Ausgabeordner
```

### Standard-Kartengröße ändern
In `panorama_optimized.html` (Zeile ~150):
```html
<input type="range" id="sizeSlider" value="250">
```

### Farben anpassen
CSS-Variablen im `<style>`-Bereich von `panorama_optimized.html`

## 🔧 Fehlerbehebung

### Problem: Keine Bilder sichtbar
**Lösung**:
1. Prüfen ob `extracted_sarcophagi/` existiert
2. `extract_sarcophagi.bat` ausführen
3. Browser-Cache leeren (Ctrl+F5)

### Problem: "Keine Sarkophage gefunden"
**Lösung**:
1. Filter auf "Alle" setzen
2. Suchfeld leeren
3. `data.json` prüfen

### Problem: Server startet nicht
**Lösung**:
1. Port bereits belegt? Anderen Port verwenden:
   ```bash
   python -m http.server 8001
   ```
2. Python installiert? Version prüfen:
   ```bash
   python --version
   ```

### Problem: Bilder laden langsam
**Lösung**:
1. Kleinere Kartengröße wählen (150px)
2. Kompakt-Layout verwenden
3. Weniger Objekte filtern

## 🎯 Workflow-Empfehlungen

### Für schnelle Übersicht
1. Panorama öffnen
2. Kompakt-Layout aktivieren
3. Kartengröße auf 150px setzen
4. Nach Serie filtern

### Für detaillierte Analyse
1. Panorama öffnen
2. Raster-Layout verwenden
3. Kartengröße auf 300-400px
4. Einzelne Objekte durchklicken

### Für spezifische Suche
1. Suchfeld nutzen
2. Inventarnummer eingeben
3. Detailansicht öffnen
4. Metadaten prüfen

## 📈 Performance-Tipps

### Optimale Performance
- ✅ Moderne Browser (Chrome, Edge, Firefox)
- ✅ Lokaler Server (nicht über Netzwerk)
- ✅ Bilder bereits extrahiert
- ✅ Keine anderen schweren Prozesse

### Bei langsamer Performance
- 🔧 Kartengröße reduzieren
- 🔧 Weniger Objekte anzeigen (Filter nutzen)
- 🔧 Kompakt-Layout verwenden
- 🔧 Browser-Cache leeren

## 🔐 Datenschutz & Sicherheit

- ✅ Alle Daten lokal
- ✅ Kein Internet erforderlich
- ✅ Keine externen Anfragen
- ✅ Keine Cookies
- ✅ Keine Tracking-Skripte

## 🆕 Zukünftige Features (Geplant)

- [ ] Export-Funktion für gefilterte Auswahl
- [ ] Sortierung nach Datierung/Material
- [ ] Vergleichsansicht (Side-by-Side)
- [ ] Vollbild-Modus
- [ ] Diashow-Funktion
- [ ] Druckansicht
- [ ] PDF-Export
- [ ] Batch-Download
- [ ] Notizen-Funktion
- [ ] Favoriten-System

## 📞 Support & Dokumentation

### Weitere Dokumentation
- `README_EXTRACTION.md` - Extraktion im Detail
- `README_PANORAMA.md` - Panorama-Features
- `README.md` - Projekt-Übersicht

### Logs & Debugging
Browser-Konsole öffnen (F12) für:
- Lade-Status der Bilder
- Fehler-Meldungen
- Performance-Metriken

## 💡 Tipps & Tricks

1. **Schnelle Navigation**: Nutzen Sie die Tastatur
   - Tab: Zwischen Elementen wechseln
   - Enter: Auswahl bestätigen
   - ESC: Modal schließen

2. **Effiziente Suche**: Kombinieren Sie Filter und Suche
   - Erst Filter wählen (z.B. "19xx")
   - Dann spezifisch suchen (z.B. "1925")

3. **Beste Ansicht**: Vollbild-Modus
   - F11 drücken für Vollbild
   - Mehr Platz für Karten
   - Bessere Übersicht

4. **Schneller Zugriff**: Lesezeichen setzen
   - `http://localhost:8000/panorama_optimized.html`
   - Direkt zur Panorama-Ansicht

## 📝 Changelog

### Version 1.0 (2025-11-28)
- ✨ Initiale Version
- ✨ 152 Sarkophag-Bilder extrahiert
- ✨ Interaktive Panorama-Ansicht
- ✨ Filter- und Suchfunktion
- ✨ Responsive Design
- ✨ Modal-Detailansicht

---

**Viel Erfolg mit der Panorama-Ansicht! 🏛️**
