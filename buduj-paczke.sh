#!/bin/bash
# ─── Buduje offline paczki z wbudowanym Node.js ───
# Generuje ZIP dla macOS (ARM + Intel) i Windows
# Odbiorca nie musi mieć NICZEGO zainstalowanego!

set -e
cd "$(dirname "$0")"

NODE_VERSION="v22.12.0"
BUILD_DIR="$(pwd)/build"
GAME_DIR="$(pwd)"

rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

echo ""
echo "  📦 Budowanie paczek dystrybucyjnych..."
echo "  Node.js: $NODE_VERSION"
echo ""

# ─── Function to build a package ───
build_package() {
  local PLATFORM=$1   # darwin, win
  local ARCH=$2       # arm64, x64
  local NODE_URL=$3
  local LABEL=$4
  local EXT=$5        # tar.gz or zip

  echo "  ⏳ Budowanie: $LABEL..."

  local WORK="$BUILD_DIR/${LABEL}"
  mkdir -p "$WORK/wspolne-pastwisko"

  # Copy game files
  cp server.js package.json INSTRUKCJA.txt "$WORK/wspolne-pastwisko/"
  cp -r public "$WORK/wspolne-pastwisko/"
  # Install production-only dependencies (no devDependencies)
  cd "$WORK/wspolne-pastwisko"
  npm install --omit=dev --silent 2>/dev/null
  cd "$GAME_DIR"

  # Download Node.js
  local NODE_FILE="$BUILD_DIR/node-${PLATFORM}-${ARCH}.${EXT}"
  if [ ! -f "$NODE_FILE" ]; then
    echo "    Pobieranie Node.js ($PLATFORM-$ARCH)..."
    curl -sL "$NODE_URL" -o "$NODE_FILE"
  fi

  # Extract Node binary
  if [ "$EXT" = "tar.gz" ]; then
    local NODE_DIR=$(tar -tzf "$NODE_FILE" | head -1 | cut -d/ -f1)
    tar -xzf "$NODE_FILE" -C "$BUILD_DIR" "${NODE_DIR}/bin/node" 2>/dev/null || true
    cp "$BUILD_DIR/${NODE_DIR}/bin/node" "$WORK/wspolne-pastwisko/node-bin"
    chmod +x "$WORK/wspolne-pastwisko/node-bin"
    rm -rf "$BUILD_DIR/${NODE_DIR}"
  else
    # Windows ZIP
    local NODE_DIR=$(unzip -l "$NODE_FILE" | grep "node.exe" | head -1 | awk '{print $NF}')
    unzip -jo "$NODE_FILE" "$NODE_DIR" -d "$WORK/wspolne-pastwisko/" 2>/dev/null
    mv "$WORK/wspolne-pastwisko/node.exe" "$WORK/wspolne-pastwisko/node.exe" 2>/dev/null || true
  fi

  # Create start scripts
  if [ "$PLATFORM" = "win" ]; then
    cat > "$WORK/wspolne-pastwisko/URUCHOM.bat" << 'WINEOF'
@echo off
chcp 65001 >nul 2>&1
title Wspolne Pastwisko
cd /d "%~dp0"
echo.
echo   Uruchamianie gry Wspolne Pastwisko...
echo.
node.exe server.js
echo.
echo   Serwer zatrzymany.
pause
WINEOF
  else
    cat > "$WORK/wspolne-pastwisko/URUCHOM.command" << 'MACEOF'
#!/bin/bash
cd "$(dirname "$0")"
echo ""
echo "  Uruchamianie gry Wspólne Pastwisko..."
echo ""
./node-bin server.js
echo ""
echo "  Serwer zatrzymany. Naciśnij Enter aby zamknąć."
read
MACEOF
    chmod +x "$WORK/wspolne-pastwisko/URUCHOM.command"
  fi

  # Create ZIP
  local OUT_ZIP="$BUILD_DIR/wspolne-pastwisko-${LABEL}.zip"
  cd "$WORK"
  zip -rq "$OUT_ZIP" wspolne-pastwisko/
  cd "$GAME_DIR"

  local SIZE=$(du -h "$OUT_ZIP" | cut -f1)
  echo "  ✅ $LABEL → wspolne-pastwisko-${LABEL}.zip ($SIZE)"

  rm -rf "$WORK"
}

# ─── Build all platforms ───

# macOS ARM (Apple Silicon — M1/M2/M3)
build_package "darwin" "arm64" \
  "https://nodejs.org/dist/${NODE_VERSION}/node-${NODE_VERSION}-darwin-arm64.tar.gz" \
  "macos-apple-silicon" "tar.gz"

# macOS Intel
build_package "darwin" "x64" \
  "https://nodejs.org/dist/${NODE_VERSION}/node-${NODE_VERSION}-darwin-x64.tar.gz" \
  "macos-intel" "tar.gz"

# Windows x64
build_package "win" "x64" \
  "https://nodejs.org/dist/${NODE_VERSION}/node-${NODE_VERSION}-win-x64.zip" \
  "windows" "zip"

echo ""
echo "  ────────────────────────────────────────"
echo "  📦 Wszystkie paczki w folderze: build/"
echo ""
ls -lh "$BUILD_DIR"/wspolne-pastwisko-*.zip
echo ""
echo "  Odbiorca:"
echo "    1. Rozpakowuje ZIP"
echo "    2. Klika URUCHOM.command (Mac) lub URUCHOM.bat (Windows)"
echo "    3. Gotowe! Otwiera przeglądarkę."
echo ""
