"""
Konvertiert die Individuen-Daten von Google Sheets in JSON.
Die JSON-Datei wird nach Sarkophag-Inventarnummer gruppiert.

Ausgabe: assets/individuen.json
"""

import json
import os
import sys
import pandas as pd

# Import des Google Sheets Utilities
from gsheet_utils import fetch_individuen

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_FILE = os.path.join(BASE_DIR, 'individuen.json')

def convert_individuen():
    df = fetch_individuen()
    
    # Header aus DataFrame
    headers = df.columns.tolist()
    
    # Mapping für JSON-Keys
    key_mapping = {
        'Sarkophag_Inventarnummer': 'sarkophag_id',
        'Individuum_ID': 'id',
        'Bezeichnung': 'bezeichnung',
        'Geschlecht': 'geschlecht',
        'Sterbealter': 'sterbealter',
        'Kategorie': 'kategorie',
        'Erhaltung': 'erhaltung',
        'Anmerkungen': 'anmerkungen'
    }
    
    # Daten sammeln
    individuen_by_sarkophag = {}
    all_individuen = []
    row_count = 0
    
    for _, row in df.iterrows():
        # Leere Zeilen überspringen (anhand Inventarnummer)
        if pd.isna(row.get('Sarkophag_Inventarnummer')):
            continue
            
        ind = {}
        for header in headers:
            value = row.get(header)
            if pd.notna(value):
                json_key = key_mapping.get(header, header.lower().replace(' ', '_'))
                # Leere Strings zu None oder ignorieren
                if isinstance(value, str) and value.strip() == '':
                    continue
                ind[json_key] = value
        
        if ind.get('sarkophag_id'):
            sarkophag_id = ind['sarkophag_id']
            
            # Zur Liste für diesen Sarkophag hinzufügen
            if sarkophag_id not in individuen_by_sarkophag:
                individuen_by_sarkophag[sarkophag_id] = []
            individuen_by_sarkophag[sarkophag_id].append(ind)
            
            # Auch zur flachen Liste
            all_individuen.append(ind)
            row_count += 1
    
    # Ausgabe-Struktur
    output = {
        'meta': {
            'description': 'Individuen (Bestattungen) in Sarkophagen',
            'total_count': row_count,
            'sarkophage_count': len(individuen_by_sarkophag),
            'version': '1.0'
        },
        'by_sarkophag': individuen_by_sarkophag,
        'all': all_individuen
    }
    
    # JSON speichern
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    
    print(f"[OK] Konvertierung abgeschlossen: {OUTPUT_FILE}")
    print(f"  - {row_count} Individuen")
    print(f"  - {len(individuen_by_sarkophag)} Sarkophage mit Individuen")

if __name__ == "__main__":
    convert_individuen()
