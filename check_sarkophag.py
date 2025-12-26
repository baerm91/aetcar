import json

# Load data
with open('assets/coordinates.json', encoding='utf-8') as f:
    coords = json.load(f)

with open('data.json', encoding='utf-8') as f:
    data = json.load(f)

# Get all inventory numbers with coordinates
coord_inv = set([c['Inventarnummer'] for c in coords])

# Find all sarkophage
sarkophage = [obj for obj in data if 'Sarkophag' in obj.get('Titel / Darstellung', '')]

print(f'Sarkophage gesamt: {len(sarkophage)}')

sarkophage_mit_coords = [s for s in sarkophage if s.get('Inventarnummer') in coord_inv]
sarkophage_ohne_coords = [s for s in sarkophage if s.get('Inventarnummer') not in coord_inv]

print(f'Mit Koordinaten: {len(sarkophage_mit_coords)}')
print(f'Ohne Koordinaten: {len(sarkophage_ohne_coords)}')

print('\nSarkophage OHNE Koordinaten:')
for s in sarkophage_ohne_coords[:15]:
    inv = s.get('Inventarnummer', 'N/A')
    title = s.get('Titel / Darstellung', '')[:60]
    print(f"  {inv}: {title}")
