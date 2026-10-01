#!/bin/bash
set -e
PROJECT_ROOT="/home/nestor/Documentos/0_AplicacionesWEB/CongresoNew"

echo "=== [1/2] Verificando y Compilando BACKEND (tsc) ==="
cd "$PROJECT_ROOT/backend"
npm run build

echo "=== [2/2] Verificando y Compilando FRONTEND (next build) ==="
cd "$PROJECT_ROOT/frontend"
npm run build

echo "✅ Verificación exitosa: Backend y Frontend compilaron sin errores."
