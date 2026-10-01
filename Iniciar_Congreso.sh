#!/bin/bash
# ==============================================================================
# Script: Iniciar Sistema Congreso ETS 2026 (DETS - GCABA)
# Backend (Puerto 4000) + Frontend (Puerto 3000)
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

GREEN="\033[1;32m"
CYAN="\033[1;36m"
YELLOW="\033[1;33m"
RED="\033[1;31m"
RESET="\033[0m"

echo -e "${CYAN}========================================================================${RESET}"
echo -e "${CYAN}   INICIANDO SISTEMA CONGRESO ETS 2026 - DETS GCABA (LINUX)${RESET}"
echo -e "${CYAN}========================================================================${RESET}"
echo ""

# Verificar si ya está en ejecución
BACKEND_ACTIVE=false
FRONTEND_ACTIVE=false

if (echo > /dev/tcp/127.0.0.1/4000) 2>/dev/null; then
    BACKEND_ACTIVE=true
fi

if (echo > /dev/tcp/127.0.0.1/3000) 2>/dev/null; then
    FRONTEND_ACTIVE=true
fi

if [ "$BACKEND_ACTIVE" = true ] && [ "$FRONTEND_ACTIVE" = true ]; then
    echo -e "${YELLOW}  [AVISO] El sistema ya se encuentra en ejecución en los puertos 4000 y 3000.${RESET}"
    echo "  Abriendo navegador web..."
    xdg-open "http://localhost:3000" 2>/dev/null || sensible-browser "http://localhost:3000" 2>/dev/null || true
    exit 0
fi

# 1. Iniciar Backend (Puerto 4000) si no está activo
if [ "$BACKEND_ACTIVE" = true ]; then
    echo -e "${YELLOW}  [1/2] El Backend ya está escuchando en el puerto 4000.${RESET}"
else
    echo "  [1/2] Iniciando Servidor Backend API (Puerto 4000)..."
    if [ -d "$SCRIPT_DIR/backend" ]; then
        (
            cd "$SCRIPT_DIR/backend"
            setsid nohup npm start > "$SCRIPT_DIR/backend.log" 2>&1 < /dev/null &
            echo $! > "$SCRIPT_DIR/.backend.pid"
        )
        BACKEND_PID=$(cat "$SCRIPT_DIR/.backend.pid" 2>/dev/null || true)
        echo -e "        ${GREEN}✓ Proceso Backend lanzado (PID: $BACKEND_PID). Log: backend.log${RESET}"
    else
        echo -e "        ${RED}✗ No se encontró el directorio backend en $SCRIPT_DIR${RESET}"
        exit 1
    fi
fi

# Esperar disponibilidad del Backend antes de arrancar Frontend
echo "        Esperando disponibilidad del Backend en http://localhost:4000/health..."
BACKEND_READY=false
for i in {1..20}; do
    if (echo > /dev/tcp/127.0.0.1/4000) 2>/dev/null; then
        BACKEND_READY=true
        break
    fi
    sleep 0.5
done

if [ "$BACKEND_READY" = true ]; then
    echo -e "        ${GREEN}✓ Backend disponible en puerto 4000.${RESET}"
else
    echo -e "        ${YELLOW}⚠ El Backend tardó en responder. Continuando con Frontend...${RESET}"
fi

# 2. Iniciar Frontend (Puerto 3000) si no está activo
if [ "$FRONTEND_ACTIVE" = true ]; then
    echo -e "${YELLOW}  [2/2] El Frontend ya está escuchando en el puerto 3000.${RESET}"
else
    echo "  [2/2] Iniciando Interfaz Frontend Web (Puerto 3000)..."
    if [ -d "$SCRIPT_DIR/frontend" ]; then
        (
            cd "$SCRIPT_DIR/frontend"
            setsid nohup npm start > "$SCRIPT_DIR/frontend.log" 2>&1 < /dev/null &
            echo $! > "$SCRIPT_DIR/.frontend.pid"
        )
        FRONTEND_PID=$(cat "$SCRIPT_DIR/.frontend.pid" 2>/dev/null || true)
        echo -e "        ${GREEN}✓ Proceso Frontend lanzado (PID: $FRONTEND_PID). Log: frontend.log${RESET}"
    else
        echo -e "        ${RED}✗ No se encontró el directorio frontend en $SCRIPT_DIR${RESET}"
        exit 1
    fi
fi

echo ""
echo "  Esperando disponibilidad de la plataforma..."
for i in {1..30}; do
    if (echo > /dev/tcp/127.0.0.1/3000) 2>/dev/null; then
        echo ""
        echo -e "${GREEN}  ========================================================================${RESET}"
        echo -e "${GREEN}    SISTEMA INICIADO EXITOSAMENTE${RESET}"
        echo -e "${GREEN}    Portal Público   : http://localhost:3000${RESET}"
        echo -e "${GREEN}    Panel de Control : http://localhost:3000/admin${RESET}"
        echo -e "${GREEN}    PWA Operador     : http://localhost:3000/pwa-operador${RESET}"
        echo -e "${GREEN}    Backend Health   : http://localhost:4000/health${RESET}"
        echo -e "${GREEN}  ========================================================================${RESET}"
        echo ""
        xdg-open "http://localhost:3000" 2>/dev/null || sensible-browser "http://localhost:3000" 2>/dev/null || true
        exit 0
    fi
    sleep 1
done

echo -e "${YELLOW}  [AVISO] Los servicios están iniciando en segundo plano.${RESET}"
echo "  Abriendo http://localhost:3000..."
xdg-open "http://localhost:3000" 2>/dev/null || sensible-browser "http://localhost:3000" 2>/dev/null || true
echo "  Para detener el sistema ejecute: ./Detener_Congreso.sh"
echo "  Para reiniciar el sistema ejecute: ./Reiniciar_Congreso.sh"
