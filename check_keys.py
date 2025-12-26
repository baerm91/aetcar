import json
import os

file_path = 'd:/Prog-Proj/AETCAR/data.json'
with open(file_path, 'r', encoding='utf-8') as f:
    data = json.load(f)
    
if data:
    first = data[0]
    print("Keys in first object:")
    for k in first.keys():
        print(f"'{k}'")
        
    print("\nValue of 'Titel / Darstellung':")
    print(first.get('Titel / Darstellung'))
