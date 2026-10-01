interface CardProgramaProps {
    
    horario: string;
    duracion: string;
    categoria: string;
    title: string;
    expositor: string;
    descripcion?: string; // Opcional
    estado: string;
    sala: string
}

const CardPrograma = ({ horario, duracion, categoria, title, expositor, descripcion, estado, sala}: CardProgramaProps) => {
    return (
        <div className="border rounded-xl p-4 md:p-6 shadow-sm border-azul-oscuro mb-3 md:mb-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
                <div className="flex items-start md:items-center gap-3 md:gap-4">
                    <div className="min-w-[4rem]">
                        <span className="font-bold text-base md:text-lg block">{horario}</span>
                        <p className="text-[10px] md:text-xs text-gray-500">{duracion}</p>
                    </div>

                    <div className="h-full min-h-[3rem] md:min-h-[4rem] border-l border-black-300 mx-1 md:mx-2"></div>

                    
                    <div className="flex-1">
                        <span className="text-[10px] md:text-xs px-2 py-0.5 md:px-3 md:py-1 bg-gray-100 border border-black rounded-full inline-block mb-1.5 md:mb-2 leading-none">{categoria}</span>
                        <h3 className="font-semibold text-azul-claro text-sm md:text-lg leading-tight">{title}</h3>
                        <p className="text-xs md:text-sm text-gray-600 mt-0.5 md:mt-1">{expositor}</p>
                    </div>
                </div>
                {/* Sala y Estado */}
                <div className="flex flex-col gap-1 md:gap-2 w-full md:w-auto md:min-w-[180px] bg-gray-50 md:bg-transparent p-2 md:p-0 rounded-lg">
                    <div className="text-[10px] md:text-xs font-semibold">
                        <p className="text-[10px] md:text-xs">Estado: <span className="font-normal">{estado}</span></p>
                    </div>
                    <div className="text-[10px] md:text-xs font-semibold">
                        <p className="text-[10px] md:text-xs">Sala: <span className="font-normal">{sala}</span></p>
                    </div>
                </div>
            </div>
            {descripcion && (
                <p className="mt-3 md:mt-4 text-xs md:text-sm text-gray-600 border-t pt-3 md:pt-4">{descripcion}</p>
            )}
        </div>
    );
};

export default CardPrograma;