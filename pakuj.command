#!/bin/bash
# ─── Tworzy paczkę ZIP gotową do dystrybucji offline ───
# Zawiera node_modules — odbiorca nie potrzebuje internetu!

cd "$(dirname "$0")"

echo ""
echo "  📦 Tworzenie paczki dystrybucyjnej..."
echo ""

# Ensure dependencies are installed
if [ ! -d "node_modules" ]; then
  echo "  Instalowanie zależności..."
  npm install --silent
fi

# Clean old zip
rm -f wspolne-pastwisko.zip

# Create zip with everything needed
zip -r wspolne-pastwisko.zip \
  server.js \
  package.json \
  start.command \
  start.bat \
  public/ \
  node_modules/ \
  -x "*.DS_Store" \
  -x "__MACOSX/*"

SIZE=$(du -h wspolne-pastwisko.zip | cut -f1)

echo ""
echo "  ✅ Gotowe: wspolne-pastwisko.zip ($SIZE)"
echo ""
echo "  Odbiorca:"
echo "    1. Rozpakowuje ZIP"
echo "    2. Klika start.command (Mac) lub start.bat (Windows)"
echo "    3. Otwiera dashboard w przeglądarce"
echo ""
echo "  Wymagania: Node.js zainstalowany na komputerze."
echo ""
