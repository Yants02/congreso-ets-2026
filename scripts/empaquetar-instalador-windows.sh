#!/bin/bash
# ==============================================================================
# Script de Empaquetado del Instalador Autónomo para Windows 10 y Windows 11
# DETS - GCABA | Sistema Congreso ETS 2026
# ==============================================================================

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist_windows"
PACKAGE_NAME="CongresoETS2026_Instalador_Windows"
STAGE_DIR="$DIST_DIR/$PACKAGE_NAME"
ZIP_OUTPUT="$DIST_DIR/${PACKAGE_NAME}.zip"

echo "========================================================================"
echo "  EMPAQUETANDO INSTALADOR AUTÓNOMO PARA WINDOWS 10 Y 11"
echo "========================================================================"
echo "Directorio raíz: $ROOT_DIR"
echo "Destino staging: $STAGE_DIR"
echo ""

# 1. Limpiar directorio temporal previo
rm -rf "$STAGE_DIR"
mkdir -p "$STAGE_DIR/app_payload"

# 2. Copiar componentes del instalador
echo "[1/4] Copiando scripts y lanzadores del instalador..."
cp -r "$ROOT_DIR/windows-installer/Instalar_CongresoETS2026.bat" "$STAGE_DIR/"
cp -r "$ROOT_DIR/windows-installer/Revisar_Servicios.bat" "$STAGE_DIR/"
cp -r "$ROOT_DIR/windows-installer/MANUAL_INSTALACION_WINDOWS.md" "$STAGE_DIR/"
cp -r "$ROOT_DIR/windows-installer/scripts" "$STAGE_DIR/"
cp -r "$ROOT_DIR/windows-installer/plantillas" "$STAGE_DIR/"

# 3. Empaquetar Backend limpio dentro de app_payload
echo "[2/4] Empaquetando Backend (excluyendo node_modules y backups)..."
mkdir -p "$STAGE_DIR/app_payload/backend"
rsync -av \
  --exclude="node_modules" \
  --exclude="backups/*.zip" \
  --exclude=".env" \
  --exclude="coverage" \
  --exclude="dist" \
  "$ROOT_DIR/backend/" "$STAGE_DIR/app_payload/backend/" > /dev/null

# 4. Empaquetar Frontend limpio dentro de app_payload
echo "[3/4] Empaquetando Frontend (excluyendo node_modules y .next)..."
mkdir -p "$STAGE_DIR/app_payload/frontend"
rsync -av \
  --exclude="node_modules" \
  --exclude=".next" \
  --exclude="*.zip" \
  "$ROOT_DIR/frontend/" "$STAGE_DIR/app_payload/frontend/" > /dev/null

# 5. Empaquetar manuales, certs, scripts raíz y metadatos
echo "Copiando manuales interactivos, scripts y certificados..."
if [ -d "$ROOT_DIR/manuales" ]; then
  cp -r "$ROOT_DIR/manuales" "$STAGE_DIR/app_payload/"
fi
if [ -d "$ROOT_DIR/certs" ]; then
  cp -r "$ROOT_DIR/certs" "$STAGE_DIR/app_payload/"
fi
cp -r "$ROOT_DIR/scripts" "$STAGE_DIR/app_payload/"
if [ -f "$ROOT_DIR/package.json" ]; then
  cp "$ROOT_DIR/package.json" "$STAGE_DIR/app_payload/"
fi

# 6. Generar archivo comprimido ZIP
echo "[4/4] Comprimiendo archivo ZIP distribuible..."
cd "$DIST_DIR"
rm -f "$ZIP_OUTPUT"
zip -r -q "$ZIP_OUTPUT" "$PACKAGE_NAME"

SIZE=$(du -h "$ZIP_OUTPUT" | cut -f1)
echo ""
echo "========================================================================"
echo "  PAQUETE INSTALADOR GENERADO CON ÉXITO"
echo "========================================================================"
echo "Carpeta autónoma : $STAGE_DIR"
echo "Archivo ZIP listo: $ZIP_OUTPUT ($SIZE)"
echo "========================================================================"
echo "Instrucciones de uso:"
echo "1. Copie '$PACKAGE_NAME.zip' a un pendrive o unidad de red."
echo "2. En la máquina Windows 10/11, descomprima el ZIP en cualquier carpeta."
echo "3. Haga doble clic en 'Instalar_CongresoETS2026.bat'."
