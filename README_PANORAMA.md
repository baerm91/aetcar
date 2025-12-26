# 🏛️ Sarkophag Panorama Ansicht

## Übersicht
Die Panorama-Ansicht zeigt alle extrahierten Sarkophag-Bilder in einer interaktiven Galerie mit Filterfunktionen.

## Dateien
- **panorama_optimized.html** - Optimierte Panorama-Ansicht (empfohlen)
- **panorama.html** - Einfache Panorama-Ansicht
- **panorama.js** - JavaScript-Logik für beide Versionen
- **start_panorama.bat** - Server starten und Browser öffnen

## Verwendung

### Methode 1: Batch-Datei (einfachste Methode)
1. Doppelklick auf `start_panorama.bat`
2. Browser öffnet sich automatisch
3. Zum Beenden: Strg+C im Terminal-Fenster

### Methode 2: Manuell
1. Server starten:
   ```bash
   python -m http.server 8000
   ```
2. Browser öffnen: `http://localhost:8000/panorama_optimized.html`

## Features

### 🔍 Suchfunktion
- Suche nach Inventarnummer in Echtzeit
- Automatische Filterung während der Eingabe

### 🏷️ Filter
- **Alle** - Zeigt alle Sarkophage
- **19xx Serie** - Nur Sarkophage mit Inventarnummer CAR-S-19xx
- **20xx Serie** - Nur Sarkophage mit Inventarnummer CAR-S-20xx

### 📏 Größenanpassung
- Slider zur dynamischen Anpassung der Kartengröße
- Bereich: 150px - 400px
- Standard: 250px

### 🎨 Layout-Modi
- **Raster** - Gleichmäßiges Grid-Layout
- **Kompakt** - Platzsparendes Layout mit kleineren Abständen

### 🖼️ Detailansicht
- Klick auf eine Karte öffnet Modal mit großem Bild
- Zeigt alle verfügbaren Metadaten
- Schließen mit ESC-Taste oder Klick außerhalb

## Interaktive Elemente

### Karten-Hover-Effekte
- Vergrößerung beim Überfahren
- Hervorhebung mit grünem Schatten
- Sanfte Animationen

### Responsive Design
- Automatische Anpassung an Bildschirmgröße
- Mobile-optimiert
- Touch-freundlich

## Technische Details

### Datenquelle
Die Ansicht lädt Daten aus `data.json` und zeigt nur Einträge an, für die ein Bild in `extracted_sarcophagi/` existiert.

### Bildpfade
Bilder werden erwartet unter: `extracted_sarcophagi/{Inventarnummer}.jpg`

### Performance
- Lazy Loading der Bilder
- Optimiertes Grid-Layout mit CSS Grid
- Effiziente Filterung ohne Neuladen

## Statistik
Die Ansicht zeigt in Echtzeit:
- Anzahl der aktuell angezeigten Sarkophage
- Gesamtanzahl der verfügbaren Sarkophage

## Tastaturkürzel
- **ESC** - Modal schließen
- **Strg+F** - Suche fokussieren (Browser-Standard)

## Browser-Kompatibilität
- Chrome/Edge (empfohlen)
- Firefox
- Safari
- Opera

Mindestens moderne Browser mit CSS Grid Support erforderlich.

## Fehlerbehebung

### Bilder werden nicht angezeigt
1. Prüfen ob `extracted_sarcophagi/` Ordner existiert
2. Prüfen ob Bilder extrahiert wurden (siehe `extract_sarcophagi.py`)
3. Server muss laufen (Port 8000)

### "Keine Sarkophage gefunden"
1. Prüfen ob `data.json` existiert und gültig ist
2. Filter zurücksetzen (auf "Alle" klicken)
3. Suchfeld leeren

### Server startet nicht
1. Prüfen ob Port 8000 bereits belegt ist
2. Anderen Port verwenden: `python -m http.server 8001`
3. Python muss installiert sein

## Anpassungen

### Margin der extrahierten Bilder ändern
In `extract_sarcophagi.py`:
```python
MARGIN_PIXELS = 50  # Wert anpassen
```

### Standard-Kartengröße ändern
In `panorama_optimized.html`:
```html
<input type="range" id="sizeSlider" min="150" max="400" value="250">
```

### Farben anpassen
CSS-Variablen in `panorama_optimized.html` im `<style>`-Bereich ändern.

## Workflow

1. **Extraktion** - `extract_sarcophagi.py` ausführen
2. **Server starten** - `start_panorama.bat` oder manuell
3. **Filtern** - Nach Bedarf filtern und suchen
4. **Details ansehen** - Auf Karten klicken für Detailansicht

## Zukünftige Erweiterungen
- Export-Funktion für gefilterte Auswahl
- Sortierung nach verschiedenen Kriterien
- Vergleichsansicht für mehrere Sarkophage
- Download einzelner Bilder
- Druckansicht
