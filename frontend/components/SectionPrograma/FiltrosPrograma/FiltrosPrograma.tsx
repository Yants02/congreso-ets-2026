"use client"; 

const categorias = ["Todos", "Institucional", "Masterclass", "Talleres / Actividades simultáneas"];

interface FiltrosProgramaProps {
    categoriaSeleccionada: string;
    onSelectCategoria: (categoria: string) => void;
}

const FiltrosPrograma = ({ categoriaSeleccionada, onSelectCategoria }: FiltrosProgramaProps) => {
    return (
        <div className="flex flex-wrap gap-3 mb-8">
            {categorias.map((cat) => {
                const isActive = categoriaSeleccionada === cat;
                return (
                    <button
                        key={cat}
                        onClick={() => onSelectCategoria(cat)}
                        className={`px-6 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm ${isActive
                                ? "bg-azul-oscuro text-blanco shadow-md"
                                : "bg-white border border-gray-200 text-azul-oscuro hover:border-azul-claro"
                            }`}
                    >
                        {cat}
                    </button>
                );
            })}
        </div>
    );
};

export default FiltrosPrograma;