#!/usr/bin/env bash
set -e

REMOTE_PATH="/media/nestor/960GB/GIT_CongresoNew"

if [ ! -d "$REMOTE_PATH" ]; then
  echo "⚠️ El repositorio de destino en $REMOTE_PATH no se encuentra montado o accesible."
  exit 1
fi

COMMIT_MSG="${1:-chore: sincronizacion de cambios en CongresoNew}"

git add .

if git diff-index --quiet HEAD -- 2>/dev/null; then
  echo "ℹ️ No hay cambios nuevos en el directorio de trabajo."
else
  git commit -m "$COMMIT_MSG"
fi

git push origin main
echo "✅ Repositorio local sincronizado exitosamente en: $REMOTE_PATH"
