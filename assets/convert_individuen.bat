@echo off
echo Konvertiere Individuen Excel zu JSON...
cd /d "%~dp0"
python convert_individuen.py
pause
