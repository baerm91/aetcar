"""
Intelligent extraction script that detects coordinate orientation
(Lat,Lng) vs (X,Y) based on image dimensions.
"""

import json
import os
from PIL import Image

# Configuration
INPUT_IMAGE = "assets/map.jpg"
COORDINATES_FILE = "assets/coordinates.json"
OUTPUT_DIR = "extracted_sarcophagi_smart"
MARGIN_PIXELS = 50

def parse_point(point, max_width, max_height):
    """
    Heuristically determine X and Y from a point [a, b].
    
    Leaflet (Lat, Lng) usually maps to:
    Lat (Index 0) -> Y (Height)
    Lng (Index 1) -> X (Width)
    
    However, if we interpret [a, b] as [Y, X]:
    a must be < max_height
    b must be < max_width
    
    If a > max_width (and max_width < max_height), a MUST be Y.
    """
    a, b = point
    
    # Default assumption: [Y, X] (Lat, Lng)
    y, x = a, b
    
    # If interpreted as [Y, X]:
    # Check if X is out of bounds (X > max_width) but would fit as Y?
    # No, because max_height > max_width (8192 > 7069).
    # Anything that fits in Width fits in Height.
    # But something might fit in Height but NOT in Width.
    
    # If b > max_width (7069), it CANNOT be X.
    # So if b > max_width, then the assumption [Y, X] is wrong?
    # No, if b is X, and b > Width, it's out of bounds.
    # But if [a, b] is [X, Y], then a = X, b = Y.
    # If b > max_width, b fits in Height (8192).
    # So maybe it is [X, Y]?
    
    # Let's look at the data:
    # CAR-S-2041: [7716, 5428]
    # 7716 > 7069. So 7716 CANNOT be X.
    # So 7716 MUST be Y.
    # So Y=7716.
    # If Y=7716, then the other value 5428 is X.
    # So X=5428, Y=7716.
    # This means [7716, 5428] corresponds to [Y, X].
    
    # So for CAR-S-2041, the order is [Y, X].
    
    # Let's look at CAR-S-1930 (Polygon):
    # [8061, 3365]
    # 8061 > 7069. So 8061 MUST be Y.
    # So Y=8061, X=3365.
    # Order is [Y, X].
    
    # Conclusion: The data seems consistently [Y, X] (Lat, Lng).
    # BUT: Do we need to invert Y? (Height - Y)
    # If Y=7716 (CAR-S-2041) is used directly (as in original script):
    # It is near the bottom of the image (since 7716 is close to 8192).
    # Does CAR-S-2041 appear near the bottom of the map?
    # If bounds are [[0,0], [8192, 7069]], 8192 is usually TOP (North).
    # If Leaflet says Lat 7716, it is near the Top.
    # In PIL, Y=0 is Top.
    # So Lat 7716 (Top) should correspond to Y ~ 476 (Top).
    # So we MUST invert Y.
    
    # Wait, why did the original script work for some?
    # Maybe those objects were symmetric or in the middle?
    # OR maybe the image Y-axis IS inverted relative to standard Leaflet?
    
    # Let's try generating with Y-inversion.
    
    # However, the user said "simple script (no swap)" failed.
    # Simple script: x=7716 (FAIL).
    # Original script: x=5428, y=7716. (Log said min_x=7716? No, maybe I was confused.
    # Let's assume Original script: x=5428, y=7716.
    # 7716 is near bottom.
    # If the object IS near the bottom, it's fine.
    
    # Let's try to produce BOTH versions for a sample (Inverted and Non-Inverted) 
    # and see which one looks like a sarcophagus?
    # No, I can't see the images.
    
    # But standard mapping for L.imageOverlay with [[0,0], [H,W]] is:
    # Image (0,0) -> Lat 0, Lng 0? No.
    # Leaflet docs: "The first point is the south-west corner, the second is the north-east corner."
    # South-West: (0,0). North-East: (8192, 7069).
    # South (Lat 0) corresponds to Image Bottom (Y=H).
    # North (Lat 8192) corresponds to Image Top (Y=0).
    # So Lat L -> Image Y = H - L.
    # THIS IS IT.
    
    # So:
    # 1. Identify Y and X. (Y is the one that can be > 7069, or if both < 7069, assume Index 0).
    # 2. Y_pil = Height - Y_leaflet.
    # 3. X_pil = X_leaflet.
    
    # Let's apply this logic.
    
    # Robust mapping:
    if a > max_width:
        # a must be Y
        lat, lng = a, b
    elif b > max_width:
        # b must be Y
        lat, lng = b, a
    else:
        # Default [Lat, Lng] -> [Y, X]
        lat, lng = a, b
        
    x = lng
    y = max_height - lat
    
    return x, y

def extract_sarcophagi():
    print(f"Loading image: {INPUT_IMAGE}")
    img = Image.open(INPUT_IMAGE)
    img_width, img_height = img.size
    print(f"Image size: {img_width}x{img_height}")
    
    print(f"Loading coordinates: {COORDINATES_FILE}")
    with open(COORDINATES_FILE, 'r', encoding='utf-8') as f:
        coordinates = json.load(f)
        
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    count = 0
    for entry in coordinates:
        inv_num = entry.get("Inventarnummer", "unknown")
        
        xs = []
        ys = []
        
        if entry["type"] == "rectangle":
            for p in entry["bounds"]:
                x, y = parse_point(p, img_width, img_height)
                xs.append(x)
                ys.append(y)
        elif entry["type"] == "polygon":
            for p in entry["latlngs"]:
                x, y = parse_point(p, img_width, img_height)
                xs.append(x)
                ys.append(y)
        else:
            continue
            
        min_x, min_y = min(xs), min(ys)
        max_x, max_y = max(xs), max(ys)
        
        # Margin
        min_x = max(0, int(min_x - MARGIN_PIXELS))
        min_y = max(0, int(min_y - MARGIN_PIXELS))
        max_x = min(img_width, int(max_x + MARGIN_PIXELS))
        max_y = min(img_height, int(max_y + MARGIN_PIXELS))
        
        if min_x >= max_x or min_y >= max_y:
            print(f"Skipping {inv_num}: Invalid bounds")
            continue
            
        try:
            cropped = img.crop((min_x, min_y, max_x, max_y))
            cropped.save(os.path.join(OUTPUT_DIR, f"{inv_num}.jpg"), quality=95)
            count += 1
        except Exception as e:
            print(f"Error {inv_num}: {e}")
            
    print(f"Extracted {count} images to {OUTPUT_DIR}")

if __name__ == "__main__":
    extract_sarcophagi()
