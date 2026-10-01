// Header.tsx — Barra de navegación principal

"use client";

import { useState } from "react";
import Link from "next/link";
import Logo from "./Logos";
import NavLinks from "./NavLinks";
import MenuButton from "./MenuBoton";
import { useBackendSyncStatus } from "@/hooks/useBackendSyncStatus";

const Header = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const { isSynced } = useBackendSyncStatus();

    const closeMenu = () => {
        setIsMenuOpen(false);
    };

    // Indicador de color: Verde (sincronizado), Rojo (no sincronizado / error), Gris/Amarillo (conectando)
    const syncDotClass =
        isSynced === true
            ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"
            : isSynced === false
            ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)] animate-pulse"
            : "bg-amber-400 animate-pulse";

    const syncTooltip =
        isSynced === true
            ? "Sincronización activa con Backend (OK)"
            : isSynced === false
            ? "Sin sincronización con Backend (Desconectado)"
            : "Comprobando sincronización...";

    return (
        <header className="fixed left-0 top-0 z-50 w-full border-b border-gray-200 bg-white">
            <div className="px-8 py-4">

                {/* Navegación principal: links, ingreso y menú mobile */}
                <div className="flex items-center justify-between gap-6">
                    <Logo />

                    <div className="flex items-center gap-10">
                        <NavLinks />

                        {/* Botón de acceso. Apunta a /login con indicador de sincronización a la izquierda */}
                        <Link href="/login"
                            className="hidden items-center gap-2 rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-bold text-gray-800 transition hover:bg-black hover:text-white xl:inline-flex"
                            title={syncTooltip}
                        >
                            <span 
                                className={`inline-block h-2 w-2 rounded-full transition-colors duration-300 ${syncDotClass}`}
                                aria-label={syncTooltip}
                            />
                            <span>Ingresar</span>
                        </Link>

                        <MenuButton
                            isOpen={isMenuOpen}
                            onClick={() => setIsMenuOpen((open) => !open)}
                        />
                    </div>
                </div>
            </div>

            {/* Cerrar el menú al dar click fuera */}
            {isMenuOpen && (
                <button
                    type="button"
                    aria-label="Cerrar menú"
                    onClick={closeMenu}
                    className="fixed inset-0 z-40 bg-black/20 xl:hidden"
                />
            )}

            {/* Menú lateral para pantallas menores a xl */}
            <aside
                className={`fixed right-0 top-0 z-50 h-full w-[280px] bg-white shadow-xl transition-transform duration-300 xl:hidden ${
                    isMenuOpen ? "translate-x-0" : "translate-x-full"
                }`}
            >
                <div className="flex h-full flex-col p-6">

                    {/* Botón para cerrar el menú */}
                    <div className="flex items-center justify-end border-b border-gray-200 pb-5">
                        <MenuButton isOpen={isMenuOpen} onClick={closeMenu} />
                    </div>

                    <div className="mt-5">
                        <NavLinks mobile onLinkClick={closeMenu} />
                    </div>

                    {/* Mantener sincronizado con el botón de acceso del navbar */}
                    <Link href="/login" onClick={closeMenu}
                        className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-bold text-gray-800 transition hover:bg-black hover:text-white"
                        title={syncTooltip}
                    >
                        <span 
                            className={`inline-block h-2 w-2 rounded-full transition-colors duration-300 ${syncDotClass}`}
                            aria-label={syncTooltip}
                        />
                        <span>Ingresar</span>
                    </Link>
                </div>
            </aside>
        </header>
    );
};

export default Header;