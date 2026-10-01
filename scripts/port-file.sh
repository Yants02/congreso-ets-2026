#!/bin/bash
set -e
WIN_SRC="/media/nestor/KINGSTON/Congreso2026/$1"
LIN_DEST="/home/nestor/Documentos/0_AplicacionesWEB/CongresoNew/$1"

if [ ! -f "$WIN_SRC" ]; then
  echo "❌ Error: El archivo fuente no existe en Windows: $WIN_SRC"
  exit 1
fi

mkdir -p "$(dirname "$LIN_DEST")"
cp "$WIN_SRC" "$LIN_DEST"
echo "✅ Copiado con éxito: $1"
