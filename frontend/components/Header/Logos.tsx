// Logos.tsx — Logos institucionales de la barra de navegación

import Image from "next/image";
import logoMinisterio from "@/assets/LOGOS/MINISTERIO DE EDUCACIÓN/Bajada_azul.png";

const Logos = () => {
    return (
        <div className="flex items-center gap-5">

            {/* Logo del Congreso reservado para incorporar cuando corresponda */}

            <Image
                src={logoMinisterio}
                alt="Dirección de Educación Técnica Superior - Ministerio de Educación - Gobierno de la Ciudad de Buenos Aires"
                width={280}
                height={70}
                className="h-auto w-[250px] md:w-[280px]"
                priority
            />
        </div>
    );
};

export default Logos;