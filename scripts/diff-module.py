#!/usr/bin/env python3
import sys
import difflib
from pathlib import Path

WIN_BASE = Path("/media/nestor/KINGSTON/Congreso2026")
LINUX_BASE = Path("/home/nestor/Documentos/0_AplicacionesWEB/CongresoNew")

if len(sys.argv) < 2:
    print("Uso: diff-module.py <ruta_relativa_archivo>")
    sys.exit(1)

rel_path = sys.argv[1]
w_path = WIN_BASE / rel_path
l_path = LINUX_BASE / rel_path

if not w_path.exists():
    print(f"❌ No existe en Windows: {w_path}")
    sys.exit(1)
if not l_path.exists():
    print(f"❌ No existe en Linux: {l_path}")
    sys.exit(1)

with open(w_path, 'r', encoding='utf-8', errors='replace') as fw:
    w_lines = fw.readlines()

with open(l_path, 'r', encoding='utf-8', errors='replace') as fl:
    l_lines = fl.readlines()

diff = list(difflib.unified_diff(l_lines, w_lines, fromfile=f"Linux:{rel_path}", tofile=f"Win:{rel_path}"))
if not diff:
    print(f"✅ Archivo idéntico en ambas versiones: {rel_path}")
else:
    print("".join(diff[:150]))
    if len(diff) > 150:
        print(f"\n... [Truncado: total de {len(diff)} líneas de diff]")
