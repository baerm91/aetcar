"""
Utility-Modul für den Zugriff auf Google Sheets.
Verwendet die öffentliche CSV-Export-URL für das AETCAR-Spreadsheet.

Spreadsheet: https://docs.google.com/spreadsheets/d/11A8nD_5blrr4xcw4sKOGTjAY56kfUFmgto7bzEw9MWg
Tabs: Sarkophage, Individuen, Beigaben
"""

import pandas as pd
import io
import requests

# Google Sheets ID
SPREADSHEET_ID = "11A8nD_5blrr4xcw4sKOGTjAY56kfUFmgto7bzEw9MWg"

# GID für jeden Tab (aus der URL ermittelt)
# Format: https://docs.google.com/spreadsheets/d/{ID}/edit#gid={GID}
SHEET_GIDS = {
    "Sarkophage": 900376901,
    "Individuen": 0,
    "Beigaben": 901841083,
    "Annotationen": 326679605,
    "Translations": 1232879418,  # TODO: GID eintragen nach Erstellen des Tabs
}


def get_csv_url(sheet_name: str, gid: int) -> str:
    """Erstellt die CSV-Export-URL für ein bestimmtes Sheet."""
    return f"https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/export?format=csv&gid={gid}"


def fetch_sheet_as_dataframe(sheet_name: str, gid: int = None) -> pd.DataFrame:
    """
    Lädt ein Google Sheet als pandas DataFrame.
    
    Args:
        sheet_name: Name des Sheets (für Fehlermeldungen)
        gid: Die GID des Sheets (aus der URL)
        
    Returns:
        pandas DataFrame mit den Sheet-Daten
    """
    if gid is None:
        gid = SHEET_GIDS.get(sheet_name)
        if gid is None:
            raise ValueError(f"GID für Sheet '{sheet_name}' nicht bekannt. Bitte manuell angeben.")
    
    url = get_csv_url(sheet_name, gid)
    
    print(f"Lade Daten von Google Sheets: {sheet_name}...")
    
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        
        # CSV in DataFrame einlesen (UTF-8 encoding)
        response.encoding = 'utf-8'
        df = pd.read_csv(io.StringIO(response.text), encoding='utf-8')
        
        print(f"  -> {len(df)} Zeilen geladen")
        return df
        
    except requests.exceptions.RequestException as e:
        raise RuntimeError(f"Fehler beim Laden von Google Sheets '{sheet_name}': {e}")


def fetch_sarkophage() -> pd.DataFrame:
    """Lädt das Sarkophage-Sheet."""
    return fetch_sheet_as_dataframe("Sarkophage", gid=SHEET_GIDS["Sarkophage"])


def fetch_individuen() -> pd.DataFrame:
    """Lädt das Individuen-Sheet."""
    return fetch_sheet_as_dataframe("Individuen", gid=SHEET_GIDS["Individuen"])


def fetch_beigaben() -> pd.DataFrame:
    """Lädt das Beigaben-Sheet."""
    return fetch_sheet_as_dataframe("Beigaben", gid=SHEET_GIDS["Beigaben"])


def fetch_annotationen() -> pd.DataFrame:
    """Lädt das Annotationen-Sheet (Marker/Overlays für die Fundkarte)."""
    return fetch_sheet_as_dataframe("Annotationen", gid=SHEET_GIDS["Annotationen"])


def fetch_translations() -> pd.DataFrame:
    """Lädt das Translations-Sheet (UI-Texte in DE/EN/MP)."""
    gid = SHEET_GIDS.get("Translations")
    if gid is None:
        raise ValueError(
            "GID für 'Translations' nicht gesetzt. "
            "Bitte Tab in Google Sheets erstellen und GID in gsheet_utils.py eintragen."
        )
    return fetch_sheet_as_dataframe("Translations", gid=gid)


if __name__ == "__main__":
    # Test: Alle Sheets laden
    print("=== Test: Google Sheets Zugriff ===\n")
    
    for sheet_name in ["Sarkophage", "Individuen", "Beigaben"]:
        try:
            df = fetch_sheet_as_dataframe(sheet_name)
            print(f"\n{sheet_name}:")
            print(f"  Spalten: {df.columns.tolist()[:5]}...")
            print(f"  Zeilen: {len(df)}")
        except Exception as e:
            print(f"  Fehler: {e}")
