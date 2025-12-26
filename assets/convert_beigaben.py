"""
Konvertiert die Beigaben-Daten von Google Sheets in JSON.
Die JSON-Datei wird nach Sarkophag-Inventarnummer gruppiert.

Ausgabe: beigaben.json
"""

import json
import os
import sys
import pandas as pd

# Import des Google Sheets Utilities
from gsheet_utils import fetch_beigaben

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_FILE = os.path.join(BASE_DIR, 'beigaben.json')

def convert_beigaben():
    df = fetch_beigaben()
    
    # Header aus DataFrame
    headers = df.columns.tolist()
    
    # Mapping für JSON-Keys (saubere Namen)
    key_mapping = {
        'Sarkophag_Inventarnummer': 'sarkophag_id',
        'Beigabe_ID': 'id',
        'Titel': 'titel',
        'Kategorie': 'kategorie',
        'Beschreibung': 'beschreibung',
        'Bild_URL': 'bild_url',
        'Bild_URL_Rueckseite': 'bild_url_rueckseite',
        'Emuseum_URL': 'emuseum_url',
        'Datierung': 'datierung',
        'Material': 'material',
        'Masse': 'masse',
        'Fundlage': 'fundlage',
        'Bemerkungen': 'bemerkungen'
    }
    
    # Daten sammeln
    beigaben_by_sarkophag = {}
    all_beigaben = []
    row_count = 0
    
    for _, row in df.iterrows():
        # Leere Zeilen überspringen
        if pd.isna(row.get('Sarkophag_Inventarnummer')):
            continue
        
        # Beispielzeile überspringen
        beigabe_id = row.get('Beigabe_ID')
        titel = row.get('Titel')
        if beigabe_id and 'B001' in str(beigabe_id) and titel and 'Bronzemünze' in str(titel):
            continue
            
        beigabe = {}
        for header in headers:
            value = row.get(header)
            if pd.notna(value):
                json_key = key_mapping.get(header, header.lower().replace(' ', '_'))
                # Leere Strings ignorieren
                if isinstance(value, str) and value.strip() == '':
                    continue
                beigabe[json_key] = value
        
        if beigabe.get('sarkophag_id'):
            sarkophag_id = beigabe['sarkophag_id']
            
            # Zur Liste für diesen Sarkophag hinzufügen
            if sarkophag_id not in beigaben_by_sarkophag:
                beigaben_by_sarkophag[sarkophag_id] = []
            beigaben_by_sarkophag[sarkophag_id].append(beigabe)
            
            # Auch zur flachen Liste
            all_beigaben.append(beigabe)
            row_count += 1
    
    # Ausgabe-Struktur
    output = {
        'meta': {
            'description': 'Beigaben zu Sarkophagen',
            'total_count': row_count,
            'sarkophage_count': len(beigaben_by_sarkophag)
        },
        'by_sarkophag': beigaben_by_sarkophag,
        'all': all_beigaben
    }
    
    # JSON speichern
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    
    print(f"[OK] Konvertierung abgeschlossen: {OUTPUT_FILE}")
    print(f"  - {row_count} Beigaben")
    print(f"  - {len(beigaben_by_sarkophag)} Sarkophage mit Beigaben")
    
    # Statistik nach Kategorie
    kategorien = {}
    for b in all_beigaben:
        kat = b.get('kategorie', 'Unbekannt')
        kategorien[kat] = kategorien.get(kat, 0) + 1
    
    if kategorien:
        print("\n  Kategorien:")
        for kat, count in sorted(kategorien.items()):
            print(f"    - {kat}: {count}")

if __name__ == "__main__":
    convert_beigaben()
