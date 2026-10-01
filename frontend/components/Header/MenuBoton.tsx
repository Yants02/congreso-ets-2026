// MenuBoton.tsx — Botón para abrir y cerrar el menú de navegación

"use client";

interface MenuBotonProps {
    isOpen: boolean;
    onClick: () => void;
}

const MenuBoton = ({ isOpen, onClick }: MenuBotonProps) => {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={isOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={isOpen}
            className="flex h-10 w-10 items-center justify-center rounded-md text-gray-800 transition hover:bg-gray-100 xl:hidden"
        >
            <div className="flex w-6 flex-col gap-1.5">

                {/* Las tres líneas forman el ícono y se transforman en una X al abrirse */}
                <span className={`h-0.5 w-full bg-current transition ${
                    isOpen ? "translate-y-2 rotate-45" : ""
                }`} />
                <span className={`h-0.5 w-full bg-current transition ${
                    isOpen ? "opacity-0" : ""
                }`} />
                <span className={`h-0.5 w-full bg-current transition ${
                    isOpen ? "-translate-y-2 -rotate-45" : ""
                }`} />

            </div>
        </button>
    );
};

export default MenuBoton;