#!/bin/bash
# ==============================================================================
# Script de Empaquetado del Instalador Autónomo para Linux (Ubuntu / Debian / etc)
# DETS - GCABA | Sistema Congreso ETS 2026
# ==============================================================================

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist_linux"
PACKAGE_NAME="CongresoETS2026_Instalador_Linux"
STAGE_DIR="$DIST_DIR/$PACKAGE_NAME"
TAR_OUTPUT="$DIST_DIR/${PACKAGE_NAME}.tar.gz"

echo "========================================================================"
echo "  EMPAQUETANDO INSTALADOR AUTÓNOMO PARA LINUX (x86_64)"
echo "========================================================================"
echo "Directorio raíz : $ROOT_DIR"
echo "Destino staging : $STAGE_DIR"
echo ""

# 1. Limpiar directorio temporal previo
rm -rf "$STAGE_DIR"
mkdir -p "$STAGE_DIR/app_payload"

# 2. Copiar componentes del instalador
echo "[1/4] Copiando scripts y lanzadores del instalador para Linux..."
cp -r "$ROOT_DIR/linux-installer/instalar.sh" "$STAGE_DIR/"
cp -r "$ROOT_DIR/linux-installer/revisar_servicios.sh" "$STAGE_DIR/"
cp -r "$ROOT_DIR/linux-installer/MANUAL_INSTALACION_LINUX.md" "$STAGE_DIR/"
cp -r "$ROOT_DIR/linux-installer/scripts" "$STAGE_DIR/"
cp -r "$ROOT_DIR/linux-installer/plantillas" "$STAGE_DIR/"
chmod +x "$STAGE_DIR/instalar.sh" "$STAGE_DIR/revisar_servicios.sh" "$STAGE_DIR/scripts/"*.sh "$STAGE_DIR/plantillas/"*.sh 2>/dev/null || true

# 3. Empaquetar Backend limpio dentro de app_payload
echo "[2/4] Empaquetando Backend (excluyendo node_modules y backups)..."
mkdir -p "$STAGE_DIR/app_payload/backend"
rsync -a \
  --exclude="node_modules" \
  --exclude="backups/*.zip" \
  --exclude=".env" \
  --exclude="coverage" \
  --exclude="dist" \
  "$ROOT_DIR/backend/" "$STAGE_DIR/app_payload/backend/"

# 4. Empaquetar Frontend limpio dentro de app_payload
echo "[3/4] Empaquetando Frontend (excluyendo node_modules y .next)..."
mkdir -p "$STAGE_DIR/app_payload/frontend"
rsync -a \
  --exclude="node_modules" \
  --exclude=".next" \
  --exclude="*.zip" \
  "$ROOT_DIR/frontend/" "$STAGE_DIR/app_payload/frontend/"

# 5. Empaquetar manuales, certs, scripts raíz y package.json
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

# 6. Generar archivo comprimido .tar.gz
echo "[4/4] Comprimiendo archivo TAR.GZ distribuible..."
cd "$DIST_DIR"
rm -f "$TAR_OUTPUT"
tar -czf "$TAR_OUTPUT" "$PACKAGE_NAME"

SIZE=$(du -h "$TAR_OUTPUT" | cut -f1)
echo ""
echo "========================================================================"
echo "  PAQUETE INSTALADOR DE LINUX GENERADO CON ÉXITO"
echo "========================================================================"
echo "Carpeta autónoma    : $STAGE_DIR"
echo "Archivo TAR.GZ listo: $TAR_OUTPUT ($SIZE)"
echo "========================================================================"
echo "Instrucciones de uso en Linux:"
echo "1. Descomprima con: tar -xzf $PACKAGE_NAME.tar.gz"
echo "2. Ingrese a: cd $PACKAGE_NAME"
echo "3. Ejecute: ./instalar.sh"
echo "========================================================================"
