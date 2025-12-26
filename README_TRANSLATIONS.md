# 🌐 AETCAR Mehrsprachigkeit (DE / EN / MP)

Dieses System ermöglicht Übersetzungen der UI-Texte über Google Sheets.

## Schnellstart

1. **Google Sheet Tab erstellen** (siehe unten)
2. **GID eintragen** in `assets/gsheet_utils.py`
3. **Skript ausführen**: `assets/convert_translations.bat`
4. Ergebnis: `assets/translations.json`

---

## 1. Google Sheets Tab erstellen

### Tab-Name: `Translations`

### Spalten-Struktur:

| page | key | DE | EN | MP |
|------|-----|----|----|-----|
| _global | nav.start | Start | Home | Run Away! |
| _global | nav.fundkarte | Fundkarte | Find Map | What is your favourite colour? |
| _global | nav.steinzelt | Steinzelt | Stone Tent | Camelot! (It's only a model) |
| _global | nav.sarkophage | Sarkophage | Sarcophagi | Very Expensive Boxes |
| _global | btn.reset | Zurücksetzen | Reset | Run away! Run away! |
| _global | filter.search | Suche... | Search... | African or European? |
| index | hero.title | Römische Sarkophage | Roman Sarcophagi | Very Expensive Coffins |
| index | hero.subtitle | aus dem Raum Carnuntum | from the Carnuntum Region | for people not quite dead yet |
| index | focus.title | Objekte im Fokus | Objects in Focus | She turned me into a newt! |
| fundkarte | title | Fundkarte | Find Map | The Quest for the Holy Grail |
| ... | ... | ... | ... | ... |

### Spalten-Erklärung:

- **page**: Seitenname oder `_global` für übergreifende Texte
  - `_global` – Navigation, Footer, gemeinsame UI-Elemente
  - `index` – Startseite
  - `fundkarte` – Fundkarte
  - `steinzelt` – Steinzelt
  - `panorama` – Sarkophage-Übersicht
  
- **key**: Eindeutiger Schlüssel für den Text (z.B. `nav.start`, `hero.title`)

- **DE**: Deutscher Text (Standardsprache)

- **EN**: Englischer Text

- **MP**: Monty Python Modus 🐍

---

## 2. GID eintragen

Nach Erstellen des Tabs:

1. Öffne den Tab `Translations` in Google Sheets
2. Kopiere die GID aus der URL:
   ```
   https://docs.google.com/spreadsheets/d/11A8nD_5blrr4xcw4sKOGTjAY56kfUFmgto7bzEw9MWg/edit#gid=123456789
                                                                                              ↑↑↑↑↑↑↑↑↑
                                                                                              Diese Zahl!
   ```
3. Trage sie in `assets/gsheet_utils.py` ein:
   ```python
   SHEET_GIDS = {
       ...
       "Translations": 123456789,  # ← Hier eintragen
   }
   ```

---

## 3. Konvertierung ausführen

### Windows:
```batch
assets\convert_translations.bat
```

### Kommandozeile:
```bash
cd assets
python convert_translations.py
```

### Ausgabe:
```
Lade Daten von Google Sheets: Translations...
  -> 45 Zeilen geladen
  Gefundene Spalten: ['page', 'key', 'DE', 'EN', 'MP']
  Verfügbare Sprachen: ['de', 'en', 'mp']
[OK] Konvertierung abgeschlossen: assets/translations.json
  - 45 Übersetzungsschlüssel
  - 5 Seiten/Bereiche
  - Sprachen: de, en, mp
```

---

## 4. JSON-Struktur

Die generierte `translations.json` hat folgende Struktur:

```json
{
  "meta": {
    "description": "UI-Übersetzungen für AETCAR",
    "languages": ["de", "en", "mp"],
    "pages": ["_global", "index", "fundkarte", "steinzelt", "panorama"],
    "total_keys": 45
  },
  "languages": ["de", "en", "mp"],
  "pages": {
    "_global": {
      "nav.start": { "de": "Start", "en": "Home", "mp": "Run Away!" },
      "nav.fundkarte": { "de": "Fundkarte", "en": "Find Map", "mp": "..." }
    },
    "index": {
      "hero.title": { "de": "Römische Sarkophage", "en": "Roman Sarcophagi", "mp": "..." }
    }
  }
}
```

---

## 5. Frontend-Verwendung

### URL-Parameter:
```
?lang=de   (Standard)
?lang=en   (Englisch)
?lang=mp   (Monty Python 🐍)
```

### JavaScript-Zugriff:
```javascript
// Laden
const translations = await fetch('assets/translations.json').then(r => r.json());

// Aktuelle Sprache aus URL
const lang = new URLSearchParams(location.search).get('lang') || 'de';

// Text abrufen
function t(page, key) {
    const pageData = translations.pages[page] || translations.pages['_global'] || {};
    const keyData = pageData[key] || translations.pages['_global']?.[key] || {};
    return keyData[lang] || keyData['de'] || key;
}

// Verwendung
document.querySelector('.nav-start').textContent = t('_global', 'nav.start');
document.querySelector('h1').textContent = t('index', 'hero.title');
```

---

## 6. Sprachen-Kürzel

| Kürzel | Sprache | Beschreibung |
|--------|---------|--------------|
| `de` | Deutsch | Standardsprache |
| `en` | English | Englische Übersetzung |
| `mp` | Monty Python | 🐍 Humorvolle Variante |

---

## 7. Beispiel-Übersetzungen (Monty Python)

| DE | MP |
|----|-----|
| Start | Run Away! |
| Fundkarte | What is your favourite colour? |
| Steinzelt | Camelot! (It's only a model) |
| Sarkophage | Very Expensive Boxes |
| Suche... | African or European? |
| Zurücksetzen | Run away! Run away! |
| Keine Ergebnisse | We are the knights who say Ni! |
| Objekte im Fokus | She turned me into a newt! |
| ~1900 Jahre unter der Erde | I got better! |
| Alle Objekte ansehen | Bring out your dead! |
| Grabungen | Killer Rabbit Encounters |
| Mit Beigaben | Holy Hand Grenades |

---

## 8. Neue Sprache hinzufügen

1. Neue Spalte im Google Sheet (z.B. `FR` für Französisch)
2. In `convert_translations.py` ergänzen:
   ```python
   SUPPORTED_LANGUAGES = ['DE', 'EN', 'MP', 'FR']
   ```
3. Konvertierung neu ausführen

---

## Dateien

| Datei | Beschreibung |
|-------|--------------|
| `assets/gsheet_utils.py` | Google Sheets Verbindung |
| `assets/convert_translations.py` | Konvertierungsskript |
| `assets/convert_translations.bat` | Windows Batch-Starter |
| `assets/translations.json` | Generierte Übersetzungen |

