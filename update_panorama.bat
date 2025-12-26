@echo off
echo ========================================
echo  AETCAR Panorama Update
echo ========================================
echo.
echo Schritt 1: Extrahiere Sarkophag-Bilder...
python extract_sarcophagi.py
echo.
echo ========================================
echo Schritt 2: Starte Panorama-Server...
echo.
echo Oeffne Browser auf: http://localhost:8000/index_panorama.html
echo.
echo Druecke Ctrl+C zum Beenden
echo ========================================
echo.
python -m http.server 8000
