"""
Script to extract individual sarcophagus images from the main map image
based on coordinates.json with added margin.
"""

import json
import os
from PIL import Image

# Configuration
INPUT_IMAGE = "assets/map.jpg"
COORDINATES_FILE = "assets/coordinates.json"
OUTPUT_DIR = "extracted_sarcophagi"
MARGIN_PIXELS = 50  # Margin to add around each sarcophagus

def _to_image_point(latlng):
    """Leaflet stores coordinates as [lat (y), lng (x)]; convert to (x, y)."""
    lat, lng = latlng
    return (lng, lat)


def get_bounding_box(coord_entry, img_height):
    """
    Extract bounding box from coordinate entry.
    Coordinates are already in image pixel format (not inverted).
    Returns (min_x, min_y, max_x, max_y)
    """
    if coord_entry["type"] == "rectangle":
        bounds = coord_entry["bounds"]
        x1, y1 = _to_image_point(bounds[0])
        x2, y2 = _to_image_point(bounds[1])

        return (min(x1, x2), min(y1, y2), max(x1, x2), max(y1, y2))
    
    elif coord_entry["type"] == "polygon":
        latlngs = coord_entry["latlngs"]
        xs = []
        ys = []
        for point in latlngs:
            x, y = _to_image_point(point)
            xs.append(x)
            ys.append(y)
        return (min(xs), min(ys), max(xs), max(ys))
    
    return None

def extract_sarcophagi():
    """
    Main function to extract all sarcophagus images
    """
    # Load the main image
    print(f"Loading image: {INPUT_IMAGE}")
    img = Image.open(INPUT_IMAGE)
    img_width, img_height = img.size
    print(f"Image size: {img_width}x{img_height}")
    
    # Load coordinates
    print(f"Loading coordinates: {COORDINATES_FILE}")
    with open(COORDINATES_FILE, 'r', encoding='utf-8') as f:
        coordinates = json.load(f)
    print(f"Found {len(coordinates)} entries")
    
    # Create output directory
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print(f"Output directory: {OUTPUT_DIR}")
    
    # Process each sarcophagus
    extracted_count = 0
    skipped_count = 0
    
    for entry in coordinates:
        inv_num = entry.get("Inventarnummer", "unknown")
        
        # Get bounding box
        bbox = get_bounding_box(entry, img_height)
        if bbox is None:
            print(f"  Skipping {inv_num}: Unknown type")
            skipped_count += 1
            continue
        
        min_x, min_y, max_x, max_y = bbox
        
        # Check if coordinates are outside image bounds
        if min_x >= img_width or min_y >= img_height or max_x <= 0 or max_y <= 0:
            print(f"  [WARNING] {inv_num} is outside image bounds: ({min_x:.0f},{min_y:.0f}) to ({max_x:.0f},{max_y:.0f})")
            skipped_count += 1
            continue
        
        # Clip to image bounds first, then add margin
        min_x = max(0, min(img_width - 1, min_x))
        min_y = max(0, min(img_height - 1, min_y))
        max_x = max(0, min(img_width, max_x))
        max_y = max(0, min(img_height, max_y))
        
        # Add margin after clipping
        min_x = max(0, int(min_x - MARGIN_PIXELS))
        min_y = max(0, int(min_y - MARGIN_PIXELS))
        max_x = min(img_width, int(max_x + MARGIN_PIXELS))
        max_y = min(img_height, int(max_y + MARGIN_PIXELS))
        
        # Final validation
        if min_x >= max_x or min_y >= max_y:
            print(f"  [WARNING] Invalid bbox for {inv_num} after processing: ({min_x},{min_y}) to ({max_x},{max_y})")
            skipped_count += 1
            continue
        
        # Crop the image
        try:
            cropped = img.crop((min_x, min_y, max_x, max_y))
            
            # Save the cropped image
            output_filename = f"{inv_num}.jpg"
            output_path = os.path.join(OUTPUT_DIR, output_filename)
            cropped.save(output_path, "JPEG", quality=95)
            
            extracted_count += 1
            print(f"  [OK] Extracted {inv_num}: {max_x-min_x}x{max_y-min_y}px -> {output_filename}")
            
        except Exception as e:
            print(f"  [ERROR] Error extracting {inv_num}: {e}")
            skipped_count += 1
    
    # Summary
    print("\n" + "="*60)
    print(f"Extraction complete!")
    print(f"  Successfully extracted: {extracted_count}")
    print(f"  Skipped/Failed: {skipped_count}")
    print(f"  Output directory: {OUTPUT_DIR}")
    print("="*60)

if __name__ == "__main__":
    extract_sarcophagi()
