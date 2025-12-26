@echo off
echo Starting Sarkophag Panorama Server...
echo.
echo Oeffne Browser auf: http://localhost:8000/panorama_optimized.html
echo.
echo Druecke Ctrl+C zum Beenden
echo.
python -m http.server 8000
