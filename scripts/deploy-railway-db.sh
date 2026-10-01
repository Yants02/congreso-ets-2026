#!/usr/bin/env bash
# ==============================================================================
# SCRIPT DE MIGRACIÓN Y CARGA INICIAL DE BASE DE DATOS EN RAILWAY POSTGRESQL
# ==============================================================================
# Uso:
#   ./scripts/deploy-railway-db.sh "postgresql://postgres:pass@host:port/railway"
# ==============================================================================

set -e

DATABASE_TARGET_URL="$1"

if [ -z "$DATABASE_TARGET_URL" ]; then
  echo "❌ Error: Debe proporcionar la URL de conexión a la base de PostgreSQL de Railway."
  echo "Ejemplo: ./scripts/deploy-railway-db.sh \"postgresql://postgres:password@roundhouse.proxy.rlwy.net:12345/railway\""
  exit 1
fi

echo "========================================================================"
echo "   MIGRACIÓN DE BASE DE DATOS A RAILWAY POSTGRESQL - CONGRESO ETS 2026"
echo "========================================================================"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
SCHEMA_FILE="$ROOT_DIR/backend/database/schema_3fn.sql"
SEED_FILE="$ROOT_DIR/backend/database/seed.sql"

if [ ! -f "$SCHEMA_FILE" ]; then
  echo "❌ No se encontró el archivo de esquema: $SCHEMA_FILE"
  exit 1
fi

if [ ! -f "$SEED_FILE" ]; then
  echo "❌ No se encontró el archivo de datos semilla: $SEED_FILE"
  exit 1
fi

echo "• Verificando conectividad con PostgreSQL de Railway..."
psql "$DATABASE_TARGET_URL" -c "SELECT version();" > /dev/null

echo "• [1/2] Aplicando Esquema Relacional (Tablas, Índices, Triggers)..."
psql "$DATABASE_TARGET_URL" -f "$SCHEMA_FILE" > /dev/null

echo "• [2/2] Insertando Datos Iniciales (Usuarios, Operadores, Configuración)..."
psql "$DATABASE_TARGET_URL" -f "$SEED_FILE" > /dev/null

echo "========================================================================"
echo "   ✓ BASE DE DATOS EN RAILWAY INICIALIZADA CON ÉXITO"
echo "========================================================================"
