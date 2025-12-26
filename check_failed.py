import json

with open('assets/coordinates.json', encoding='utf-8') as f:
    coords = json.load(f)

failed = ['CAR-S-1930', 'CAR-S-1931', 'CAR-S-1932', 'CAR-S-1997', 'CAR-S-1998', 
          'CAR-S-2041', 'CAR-S-2042', 'CAR-S-2056', 'CAR-S-2057']

for c in coords:
    if c['Inventarnummer'] in failed:
        print(f"\n{c['Inventarnummer']}:")
        print(f"  Type: {c['type']}")
        if c['type'] == 'rectangle':
            bounds = c['bounds']
            print(f"  Bounds: {bounds}")
            print(f"  Point 1: {bounds[0]}")
            print(f"  Point 2: {bounds[1]}")
        else:
            print(f"  Latlngs: {c['latlngs']}")
