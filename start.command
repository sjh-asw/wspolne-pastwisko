#!/bin/bash
# ─── Wspólne Pastwisko — Uruchomienie (macOS / Linux) ───
# Kliknij dwukrotnie ten plik aby uruchomić grę!

cd "$(dirname "$0")"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
  echo ""
  echo "  ❌ Node.js nie jest zainstalowany!"
  echo ""
  echo "  Zainstaluj go z: https://nodejs.org"
  echo "  (wystarczy wersja LTS)"
  echo ""
  echo "  Naciśnij Enter aby zamknąć."
  read
  exit 1
fi

echo ""
echo "  🐇🐑🐷🐄  Wspólne Pastwisko"
echo ""

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "  Instalowanie zależności (pierwszy raz)..."
  npm install --silent
  if [ $? -ne 0 ]; then
    echo ""
    echo "  ❌ Błąd instalacji. Sprawdź połączenie z internetem."
    echo "  Naciśnij Enter aby zamknąć."
    read
    exit 1
  fi
  echo "  ✅ Zależności zainstalowane!"
fi

echo "  Uruchamianie serwera..."
echo ""

node server.js

echo ""
echo "  Serwer zatrzymany. Naciśnij Enter aby zamknąć."
read
