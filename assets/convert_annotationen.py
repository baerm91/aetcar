"""
Konvertiert allgemeine Annotationen (Fundkarte-Overlays) aus Google Sheets in JSON.

Quelle: Google Sheet "Annotationen" (GID 326679605)
Ausgabe: assets/annotationen.json
"""

import json
import os
import math
import pandas as pd

from gsheet_utils import fetch_annotationen

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_FILE = os.path.join(BASE_DIR, "annotationen.json")


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


def _web_mercator_xy_to_wgs84(x, y):
    lon = (x / 20037508.34) * 180.0
    lat = (y / 20037508.34) * 180.0
    lat = 180.0 / math.pi * (2.0 * math.atan(math.exp(lat * math.pi / 180.0)) - math.pi / 2.0)
    return (lat, lon)


def _resolve_lat_lng(row):
    """
    Unterstützt:
    - lat/lng (Grad)
    - y_webmercator/x_webmercator (Meter)
    - lat (Web Mercator) / lon (Web Mercator) (Meter, Abwärtskompatibilität)
    """
    lat = _to_float(row.get("lat"))
    lng = _to_float(row.get("lng"))
    if lat is not None and lng is not None:
        return (lat, lng)

    # Web Mercator Varianten (Y = Northing, X = Easting)
    y_raw = _to_float(row.get("y_webmercator"))
    x_raw = _to_float(row.get("x_webmercator"))
    if y_raw is None or x_raw is None:
        y_raw = _to_float(row.get("lat (Web Mercator)"))
        x_raw = _to_float(row.get("lon (Web Mercator)"))
    if y_raw is not None and x_raw is not None:
        return _web_mercator_xy_to_wgs84(x_raw, y_raw)

    return (None, None)


def convert_annotationen():
    df = fetch_annotationen()

    headers = df.columns.tolist()
    key_mapping = {
        "ID": "id",
        "Titel": "title",
        "Label": "label",
        "Beschreibung": "description",
        "Typ": "type",
        "Kategorie": "category",
        "Farbe": "color",
        "Icon": "icon",
        "Link": "link",
        "Layer": "layer",
        "Radius": "radius",
        "LineWidth": "line_width",
        "Bild_URL": "image_url",
        "GeoJSON": "geojson",
        "Notizen": "notes",
        "Sort": "sort",
        "Startdatum": "start_date",
        "Enddatum": "end_date",
        "Shape": "shape",
    }

    annotations = []
    for _, row in df.iterrows():
        # komplett leere Zeilen überspringen
        if all(pd.isna(row.get(h)) for h in headers):
            continue

        ann = {}

        lat, lng = _resolve_lat_lng(row)
        if lat is not None and lng is not None:
            ann["lat"] = lat
            ann["lng"] = lng

        for header in headers:
            if header in ("lat", "lng", "y_webmercator", "x_webmercator", "lat (Web Mercator)", "lon (Web Mercator)"):
                continue
            value = row.get(header)
            if pd.isna(value):
                continue
            if isinstance(value, str) and value.strip() == "":
                continue
            key = key_mapping.get(header, header.lower().replace(" ", "_"))
            ann[key] = value

        # Nur speichern, wenn wenigstens ein Feld gesetzt ist
        if ann:
            annotations.append(ann)

    output = {
        "meta": {
            "description": "Annotationen für Fundkarte (Overlays/Marker)",
            "total_count": len(annotations),
        },
        "items": annotations,
    }

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"[OK] Konvertierung abgeschlossen: {OUTPUT_FILE}")
    print(f"  - {len(annotations)} Annotationen")


if __name__ == "__main__":
    convert_annotationen()
