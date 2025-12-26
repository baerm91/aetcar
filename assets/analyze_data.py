"""
Konvertiert die Sarkophage-Daten von Google Sheets in JSON.
Ersetzt die frühere Excel-basierte Lösung.

Ausgabe: data.json
"""

import pandas as pd
import json
import sys
from pathlib import Path
import math

# Import des Google Sheets Utilities
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
from assets.gsheet_utils import fetch_sarkophage

JSON_PATH = PROJECT_ROOT / "data.json"


def normalize_tags(value):
    """
    Ensure Schlagworte are stored as a single comma-separated string.
    Accepts comma or semicolon separated input, trims whitespace, drops empties.
    """
    if pd.isna(value) or value is None:
        return ""
    text = str(value)
    # Split on comma or semicolon
    parts = []
    for chunk in text.replace(";", ",").split(","):
        cleaned = chunk.strip()
        if cleaned:
            parts.append(cleaned)
    return ", ".join(parts)


def _to_float(value):
    if value is None or pd.isna(value):
        return None
    text = str(value).strip()
    if not text:
        return None
    if "," in text and "." not in text:
        text = text.replace(",", ".")
    try:
        return float(text)
    except (TypeError, ValueError):
        return None


def _maybe_web_mercator_to_wgs84(lat_value, lon_value):
    if lat_value is None or lon_value is None:
        return (None, None)
    if abs(lat_value) <= 90 and abs(lon_value) <= 180:
        return (lat_value, lon_value)

    def _web_mercator_xy_to_wgs84(x, y):
        lon = (x / 20037508.34) * 180.0
        lat = (y / 20037508.34) * 180.0
        lat = 180.0 / math.pi * (2.0 * math.atan(math.exp(lat * math.pi / 180.0)) - math.pi / 2.0)
        return (lat, lon)

    def _looks_like_carnuntum(lat, lon):
        return 47.8 <= lat <= 48.6 and 16.3 <= lon <= 17.4

    cand_a = _web_mercator_xy_to_wgs84(lon_value, lat_value)
    cand_b = _web_mercator_xy_to_wgs84(lat_value, lon_value)

    if _looks_like_carnuntum(*cand_a):
        return cand_a
    if _looks_like_carnuntum(*cand_b):
        return cand_b

    return cand_a


def convert_sarkophage():
    try:
        df = fetch_sarkophage()
        # Normalize column names (Google Sheets exports can contain trailing spaces)
        df.columns = [str(c).strip() for c in df.columns]

        # Ensure expected casing for the new 'Typ' column if present with different casing
        lower_to_original = {str(c).strip().lower(): c for c in df.columns}
        if 'Typ' not in df.columns and 'typ' in lower_to_original:
            df.rename(columns={lower_to_original['typ']: 'Typ'}, inplace=True)

        print("Columns:", df.columns.tolist())
        print("First 5 rows:")
        print(df.head().to_string())

        # Ensure Schlagworte column exists and is normalized
        if "Schlagworte" not in df.columns:
            df["Schlagworte"] = ""
        else:
            df["Schlagworte"] = df["Schlagworte"].apply(normalize_tags)

        lower_to_original = {str(c).strip().lower(): c for c in df.columns}
        if "foto_url" not in df.columns:
            candidates = [
                "foto_url",
                "foto url",
                "foto-link",
                "foto link",
                "foto",
                "abb",
                "abb.",
                "abbildung",
                "bild_url",
                "bild url",
                "bild-link",
                "bild link",
                "bild",
                "image_url",
                "image url",
                "photo_url",
                "photo url",
            ]

            source_col = None
            for key in candidates:
                if key in lower_to_original:
                    source_col = lower_to_original[key]
                    break

            if source_col is None:
                for col in df.columns:
                    low = str(col).strip().lower()
                    if ("foto" in low or "bild" in low or "image" in low or "photo" in low) and (
                        "url" in low or "link" in low
                    ):
                        source_col = col
                        break

            if source_col is not None:
                df.rename(columns={source_col: "foto_url"}, inplace=True)
            else:
                df["foto_url"] = ""
        else:
            df["foto_url"] = df["foto_url"].apply(lambda v: "" if pd.isna(v) else str(v).strip())

        coord_col_pairs = [
            ("y_webmercator", "x_webmercator"),  # preferred: y = northing, x = easting in EPSG:3857
            ("lat (Web Mercator)", "lon (Web Mercator)"),  # backward compatibility
        ]
        lat_col = lon_col = None
        for cand_lat, cand_lon in coord_col_pairs:
            if cand_lat in df.columns and cand_lon in df.columns:
                lat_col, lon_col = cand_lat, cand_lon
                break

        if lat_col and lon_col:
            def _convert_coords(row):
                lat_raw = _to_float(row.get(lat_col))  # northing (Y)
                lon_raw = _to_float(row.get(lon_col))  # easting (X)
                lat, lng = _maybe_web_mercator_to_wgs84(lat_raw, lon_raw)
                return pd.Series({"lat": lat, "lng": lng})

            df[["lat", "lng"]] = df.apply(_convert_coords, axis=1)
        else:
            if "lat" in df.columns:
                df["lat"] = pd.to_numeric(df["lat"], errors="coerce")
            if "lng" in df.columns:
                df["lng"] = pd.to_numeric(df["lng"], errors="coerce")

        # Replace NaN with None for valid JSON
        df = df.where(pd.notnull(df), None)

        # Convert to JSON (UTF-8, readable)
        json_str = df.to_json(orient="records", force_ascii=False)
        JSON_PATH.write_text(json_str, encoding="utf-8")
        print(f"\n[OK] Konvertierung abgeschlossen: {JSON_PATH}")
        print(f"  - {len(df)} Sarkophage")

    except Exception as e:
        print(f"Fehler: {e}")
        raise


if __name__ == "__main__":
    convert_sarkophage()
