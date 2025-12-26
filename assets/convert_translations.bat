@echo off
echo ========================================
echo  AETCAR Translations Konvertierung
echo ========================================
echo.

cd /d "%~dp0"
python convert_translations.py

echo.
pause

