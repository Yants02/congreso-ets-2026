#!/usr/bin/env python3
import os
import hashlib
import json
from pathlib import Path

WIN_BASE = Path("/media/nestor/KINGSTON/Congreso2026")
LINUX_BASE = Path("/home/nestor/Documentos/0_AplicacionesWEB/CongresoNew")

IGNORE_DIRS = {
    'node_modules', '.next', 'dist', '.git', '.system_generated', 
    'scratch', '.turbo', 'build'
}

def file_hash(path):
    h = hashlib.sha256()
    try:
        with open(path, 'rb') as f:
            while chunk := f.read(65536):
                h.update(chunk)
        return h.hexdigest()
    except Exception:
        return None

def scan_files(base_dir):
    file_map = {}
    for root, dirs, files in os.walk(base_dir):
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
        for f in files:
            p = Path(root) / f
            rel = p.relative_to(base_dir)
            file_map[str(rel)] = p
    return file_map

def main():
    print("==================================================")
    print("🔍 REPORTE AUTOMÁTICO DE DISCREPANCIAS WIN vs LINUX")
    print("==================================================")
    
    if not WIN_BASE.exists():
        print(f"❌ No se encontró la ruta de Windows: {WIN_BASE}")
        return

    win_files = scan_files(WIN_BASE)
    linux_files = scan_files(LINUX_BASE)

    missing_in_linux = []
    different_files = []
    identical_count = 0

    for rel_path, win_full in win_files.items():
        if rel_path not in linux_files:
            missing_in_linux.append(rel_path)
        else:
            linux_full = linux_files[rel_path]
            h_win = file_hash(win_full)
            h_lin = file_hash(linux_full)
            if h_win and h_lin and h_win != h_lin:
                different_files.append(rel_path)
            else:
                identical_count += 1

    print(f"\n📁 Archivos analizados en Windows: {len(win_files)}")
    print(f"📁 Archivos analizados en Linux:   {len(linux_files)}")
    print(f"✅ Archivos idénticos sincronizados: {identical_count}")

    print(f"\n🚨 ARCHIVOS PRESENTES EN WINDOWS PERO FALTANTES EN LINUX ({len(missing_in_linux)}):")
    for f in sorted(missing_in_linux):
        print(f"  + {f}")

    print(f"\n⚠️ ARCHIVOS CON DIFERENCIAS DE CONTENIDO ({len(different_files)}):")
    for f in sorted(different_files):
        print(f"  ~ {f}")

    print("\n==================================================")

if __name__ == '__main__':
    main()
