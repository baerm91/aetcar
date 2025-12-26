@echo off
echo Konvertiere Beigaben Excel zu JSON...
cd /d "%~dp0"
python convert_beigaben.py
pause
