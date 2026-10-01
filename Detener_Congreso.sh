#!/bin/bash
# ==============================================================================
# Script: Detener Sistema Congreso ETS 2026 (DETS - GCABA)
# Detiene Backend (Puerto 4000) y Frontend (Puerto 3000)
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

YELLOW="\033[1;33m"
GREEN="\033[1;32m"
CYAN="\033[1;36m"
RED="\033[1;31m"
RESET="\033[0m"

echo -e "${CYAN}========================================================================${RESET}"
echo -e "${CYAN}   DETENIENDO SERVICIOS - CONGRESO ETS 2026 (LINUX)${RESET}"
echo -e "${CYAN}========================================================================${RESET}"
echo ""

# 1. Detener por archivo PID Frontend si existe
if [ -f "$SCRIPT_DIR/.frontend.pid" ]; then
    FPID=$(cat "$SCRIPT_DIR/.frontend.pid" 2>/dev/null || true)
    if [ -n "$FPID" ] && kill -0 "$FPID" 2>/dev/null; then
        echo "  • Deteniendo proceso Frontend (PID: $FPID)..."
        kill "$FPID" 2>/dev/null || true
        sleep 1
        kill -9 "$FPID" 2>/dev/null || true
    fi
    rm -f "$SCRIPT_DIR/.frontend.pid"
fi

# 2. Detener por archivo PID Backend si existe
if [ -f "$SCRIPT_DIR/.backend.pid" ]; then
    BPID=$(cat "$SCRIPT_DIR/.backend.pid" 2>/dev/null || true)
    if [ -n "$BPID" ] && kill -0 "$BPID" 2>/dev/null; then
        echo "  • Deteniendo proceso Backend (PID: $BPID)..."
        kill "$BPID" 2>/dev/null || true
        sleep 1
        kill -9 "$BPID" 2>/dev/null || true
    fi
    rm -f "$SCRIPT_DIR/.backend.pid"
fi

# 3. Asegurar liberación de puertos 3000 y 4000
echo "  • Verificando y liberando puertos de red 3000 y 4000..."
if command -v fuser >/dev/null 2>&1; then
    fuser -k 3000/tcp 2>/dev/null || true
    fuser -k 4000/tcp 2>/dev/null || true
elif command -v lsof >/dev/null 2>&1; then
    PIDS_3000=$(lsof -t -i:3000 2>/dev/null || true)
    PIDS_4000=$(lsof -t -i:4000 2>/dev/null || true)
    [ -n "$PIDS_3000" ] && kill -9 $PIDS_3000 2>/dev/null || true
    [ -n "$PIDS_4000" ] && kill -9 $PIDS_4000 2>/dev/null || true
fi

# Pausa breve para cierre de sockets
sleep 1

# Verificar si quedaron puertos ocupados
PORTS_STILL_OPEN=false
if (echo > /dev/tcp/127.0.0.1/3000) 2>/dev/null; then
    PORTS_STILL_OPEN=true
fi
if (echo > /dev/tcp/127.0.0.1/4000) 2>/dev/null; then
    PORTS_STILL_OPEN=true
fi

echo ""
if [ "$PORTS_STILL_OPEN" = true ]; then
    echo -e "${YELLOW}  [AVISO] Alguno de los puertos (3000 o 4000) sigue respondiendo.${RESET}"
    echo "  Puede requerir permisos de superusuario si el servicio fue iniciado por otro usuario."
else
    echo -e "${GREEN}  ========================================================================${RESET}"
    echo -e "${GREEN}    SERVICIOS DE CONGRESO ETS 2026 DETENIDOS CORRECTAMENTE${RESET}"
    echo -e "${GREEN}    Puertos 3000 y 4000 liberados.${RESET}"
    echo -e "${GREEN}  ========================================================================${RESET}"
fi
echo ""
