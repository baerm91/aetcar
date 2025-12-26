"""
Konvertiert die Translations-Daten von Google Sheets in JSON.
Die JSON-Datei wird nach Seite und Sprache strukturiert.

Google Sheets Struktur:
| page    | key              | DE                  | EN                | MP                          |
|---------|------------------|---------------------|-------------------|------------------------------|
| _global | nav.start        | Start               | Home              | Run Away!                   |
| _global | nav.fundkarte    | Fundkarte           | Find Map          | What is your favorite colour?|
| index   | hero.title       | Römische Sarkophage | Roman Sarcophagi  | Very Expensive Coffins      |
| index   | hero.subtitle    | aus dem Raum...     | from the...       | 'Tis but a scratch          |
| ...     | ...              | ...                 | ...               | ...                          |

Ausgabe: assets/translations.json

Struktur des JSON:
{
  "meta": { ... },
  "languages": ["de", "en", "mp"],
  "pages": {
    "_global": {
      "nav.start": { "de": "Start", "en": "Home", "mp": "Run Away!" },
      ...
    },
    "index": { ... },
    "fundkarte": { ... }
  }
}
"""

import json
import os
import sys
import pandas as pd

# Import des Google Sheets Utilities
from gsheet_utils import fetch_translations, SHEET_GIDS

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_FILE = os.path.join(BASE_DIR, 'translations.json')

# Unterstützte Sprachen (Spaltenüberschriften im Sheet)
SUPPORTED_LANGUAGES = ['DE', 'EN', 'MP']


def convert_translations():
    """Hauptfunktion: Lädt Translations aus Google Sheets und erstellt JSON."""
    
    # Prüfe ob GID gesetzt ist
    gid = SHEET_GIDS.get("Translations")
    if gid is None:
        print("[INFO] GID für 'Translations' Tab nicht gesetzt.")
        print("       Bitte:")
        print("       1. Tab 'Translations' in Google Sheets erstellen")
        print("       2. GID aus URL kopieren (nach #gid=)")
        print("       3. In gsheet_utils.py eintragen: 'Translations': <GID>")
        print("")
        print("       Erstelle stattdessen Beispiel-Datei...")
        create_example_json()
        return
    
    try:
        df = fetch_translations()
    except Exception as e:
        print(f"[FEHLER] Konnte Translations nicht laden: {e}")
        print("         Erstelle stattdessen Beispiel-Datei...")
        create_example_json()
        return
    
    # Verfügbare Spalten prüfen
    columns = df.columns.tolist()
    print(f"  Gefundene Spalten: {columns}")
    
    # Pflichtfelder prüfen
    if 'page' not in columns or 'key' not in columns:
        print("[FEHLER] Spalten 'page' und 'key' sind erforderlich!")
        return
    
    # Verfügbare Sprachen ermitteln
    available_languages = []
    for lang in SUPPORTED_LANGUAGES:
        if lang in columns:
            available_languages.append(lang.lower())
    
    if not available_languages:
        print(f"[FEHLER] Keine Sprachspalten gefunden! Erwartet: {SUPPORTED_LANGUAGES}")
        return
    
    print(f"  Verfügbare Sprachen: {available_languages}")
    
    # Daten strukturieren
    pages = {}
    row_count = 0
    
    for _, row in df.iterrows():
        page = row.get('page')
        key = row.get('key')
        
        # Leere Zeilen überspringen
        if pd.isna(page) or pd.isna(key):
            continue
        
        page = str(page).strip()
        key = str(key).strip()
        
        if not page or not key:
            continue
        
        # Seite initialisieren falls nötig
        if page not in pages:
            pages[page] = {}
        
        # Übersetzungen für diesen Key sammeln
        translations = {}
        for lang_upper in SUPPORTED_LANGUAGES:
            if lang_upper in columns:
                value = row.get(lang_upper)
                lang_lower = lang_upper.lower()
                if pd.notna(value) and str(value).strip():
                    translations[lang_lower] = str(value).strip()
        
        if translations:
            pages[page][key] = translations
            row_count += 1
    
    # Ausgabe-Struktur
    output = {
        'meta': {
            'description': 'UI-Übersetzungen für AETCAR',
            'languages': available_languages,
            'pages': list(pages.keys()),
            'total_keys': row_count,
            'version': '1.0'
        },
        'languages': available_languages,
        'pages': pages
    }
    
    # JSON speichern
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    
    print(f"[OK] Konvertierung abgeschlossen: {OUTPUT_FILE}")
    print(f"  - {row_count} Übersetzungsschlüssel")
    print(f"  - {len(pages)} Seiten/Bereiche")
    print(f"  - Sprachen: {', '.join(available_languages)}")
    
    # Statistik pro Seite
    print("\n  Schlüssel pro Seite:")
    for page, keys in sorted(pages.items()):
        print(f"    - {page}: {len(keys)} Schlüssel")


def create_example_json():
    """Erstellt eine Beispiel-JSON-Datei mit typischen Übersetzungen."""
    
    example_data = {
        'meta': {
            'description': 'UI-Übersetzungen für AETCAR (BEISPIEL)',
            'languages': ['de', 'en', 'mp'],
            'pages': ['_global', 'index', 'fundkarte', 'steinzelt', 'panorama'],
            'total_keys': 0,
            'version': '1.0',
            'note': 'BEISPIELDATEI - Bitte Google Sheet erstellen und convert_translations.py ausführen'
        },
        'languages': ['de', 'en', 'mp'],
        'pages': {
            '_global': {
                'nav.brand': {
                    'de': 'ÆTCAR',
                    'en': 'ÆTCAR',
                    'mp': 'ÆTCAR'
                },
                'nav.start': {
                    'de': 'Start',
                    'en': 'Home',
                    'mp': 'Run Away!'
                },
                'nav.fundkarte': {
                    'de': 'Fundkarte',
                    'en': 'Find Map',
                    'mp': 'What... is your favourite colour?'
                },
                'nav.steinzelt': {
                    'de': 'Steinzelt',
                    'en': 'Stone Tent',
                    'mp': 'Camelot! (It\'s only a model)'
                },
                'nav.sarkophage': {
                    'de': 'Sarkophage',
                    'en': 'Sarcophagi',
                    'mp': 'Very Expensive Boxes'
                },
                'footer.copyright': {
                    'de': 'Archäologischer Park Carnuntum',
                    'en': 'Archaeological Park Carnuntum',
                    'mp': 'The Knights Who Say Ni'
                },
                'btn.reset': {
                    'de': 'Zurücksetzen',
                    'en': 'Reset',
                    'mp': 'Run away! Run away!'
                },
                'filter.search': {
                    'de': 'Suche...',
                    'en': 'Search...',
                    'mp': 'African or European?'
                },
                'filter.no_results': {
                    'de': 'Keine Ergebnisse',
                    'en': 'No results',
                    'mp': 'We are the knights who say Ni!'
                }
            },
            'index': {
                'hero.pill': {
                    'de': 'Pro Aeternitate Carnunti',
                    'en': 'Pro Aeternitate Carnunti',
                    'mp': 'Tis But A Scratch'
                },
                'hero.title': {
                    'de': 'Römische Sarkophage',
                    'en': 'Roman Sarcophagi',
                    'mp': 'Very Expensive Coffins'
                },
                'hero.subtitle': {
                    'de': 'aus dem Raum Carnuntum',
                    'en': 'from the Carnuntum Region',
                    'mp': 'for people who are not quite dead yet'
                },
                'hero.description': {
                    'de': 'Im Folgenden sehen Sie steinerne Behältnisse für die Toten...',
                    'en': 'Below you will see stone containers for the dead...',
                    'mp': 'Bring out your dead! *clang* Bring out your dead!'
                },
                'section.entry_points': {
                    'de': 'Einstiegspunkte',
                    'en': 'Entry Points',
                    'mp': 'None Shall Pass!'
                },
                'section.collection': {
                    'de': 'Sammlung & Kontexte',
                    'en': 'Collection & Contexts',
                    'mp': 'The Holy Grail Collection'
                },
                'focus.eyebrow': {
                    'de': 'Kuratierte Einblicke',
                    'en': 'Curated Insights',
                    'mp': 'I\'m not dead yet!'
                },
                'focus.title': {
                    'de': 'Objekte im Fokus',
                    'en': 'Objects in Focus',
                    'mp': 'She turned me into a newt!'
                },
                'focus.btn': {
                    'de': 'Alle Objekte ansehen',
                    'en': 'View All Objects',
                    'mp': 'Bring out your dead!'
                },
                'stats.sarkophage': {
                    'de': 'Sarkophage',
                    'en': 'Sarcophagi',
                    'mp': 'Dead Parrot Storage'
                },
                'stats.grabungen': {
                    'de': 'Grabungen',
                    'en': 'Excavations',
                    'mp': 'Killer Rabbit Encounters'
                },
                'stats.beigaben': {
                    'de': 'Mit Beigaben',
                    'en': 'With Grave Goods',
                    'mp': 'Holy Hand Grenades'
                },
                'stats.years': {
                    'de': '~1900 Jahre',
                    'en': '~1900 years',
                    'mp': 'I got better!'
                },
                'stats.years_label': {
                    'de': 'Unter der Erde',
                    'en': 'Underground',
                    'mp': 'She turned me into a newt'
                }
            },
            'fundkarte': {
                'title': {
                    'de': 'Fundkarte',
                    'en': 'Find Map',
                    'mp': 'The Quest for the Holy Grail'
                },
                'layer.satellite': {
                    'de': 'Satellit',
                    'en': 'Satellite',
                    'mp': 'Swallow\'s Eye View'
                },
                'layer.historical': {
                    'de': 'Historisch',
                    'en': 'Historical',
                    'mp': 'When Knights Were Bold'
                }
            },
            'steinzelt': {
                'title': {
                    'de': 'Steinzelt',
                    'en': 'Stone Tent',
                    'mp': 'Camelot! (It\'s only a model)'
                }
            },
            'panorama': {
                'title': {
                    'de': 'Sarkophage',
                    'en': 'Sarcophagi',
                    'mp': 'The Parrot Collection'
                },
                'layout.grid': {
                    'de': 'Raster',
                    'en': 'Grid',
                    'mp': 'Organised Chaos'
                },
                'layout.masonry': {
                    'de': 'Masonry',
                    'en': 'Masonry',
                    'mp': 'Beautiful Chaos'
                },
                'sort.id': {
                    'de': 'Nach ID',
                    'en': 'By ID',
                    'mp': 'By Deadness'
                }
            }
        }
    }
    
    # Zähle Keys
    total_keys = sum(len(keys) for keys in example_data['pages'].values())
    example_data['meta']['total_keys'] = total_keys
    
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(example_data, f, ensure_ascii=False, indent=2)
    
    print(f"[OK] Beispiel-Datei erstellt: {OUTPUT_FILE}")
    print(f"  - {total_keys} Beispiel-Schlüssel")
    print(f"  - Bitte Google Sheet erstellen und GID eintragen")


if __name__ == "__main__":
    convert_translations()

