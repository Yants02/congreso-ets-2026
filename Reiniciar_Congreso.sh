#!/bin/bash
# ==============================================================================
# Script: Reiniciar Sistema Congreso ETS 2026 (DETS - GCABA)
# Detiene limpiamente los servicios y los vuelve a inicializar
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

CYAN="\033[1;36m"
RESET="\033[0m"

echo -e "${CYAN}========================================================================${RESET}"
echo -e "${CYAN}   REINICIANDO SISTEMA CONGRESO ETS 2026 - DETS GCABA (LINUX)${RESET}"
echo -e "${CYAN}========================================================================${RESET}"
echo ""

# 1. Detener servicios
if [ -f "$SCRIPT_DIR/Detener_Congreso.sh" ]; then
    bash "$SCRIPT_DIR/Detener_Congreso.sh"
else
    echo "No se encontró Detener_Congreso.sh, forzando liberación de puertos..."
    fuser -k 3000/tcp 2>/dev/null || true
    fuser -k 4000/tcp 2>/dev/null || true
fi

# Pequeña espera para asegurar liberación de memoria y sockets
sleep 2

# 2. Iniciar servicios nuevamente
if [ -f "$SCRIPT_DIR/Iniciar_Congreso.sh" ]; then
    exec bash "$SCRIPT_DIR/Iniciar_Congreso.sh"
else
    echo "Error: No se encontró Iniciar_Congreso.sh en $SCRIPT_DIR"
    exit 1
fi
