import HeroAddress from "./HeroAddress";
import HeroHeading from "./HeroHeading";
import HeroButton from "./HeroButton";

import heroImage from "@/assets/LOGOS/CONGRESO ETS/Logo_Cong_ETS_blanco.svg";

const Hero = () => {
    return (
        <section className="bg-azul-oscuro">
        <div className="flex min-h-[520px] flex-col items-center justify-center text-white px-6 py-10">

                {/* Nombre del Congreso */}
                <h4 className="text-lg font-medium uppercase tracking-[0.2em] text-white/80 md:text-xl">
                    1° Congreso
                </h4>

                <HeroHeading
                    text="Educación Técnica Superior"
                    src={heroImage}
                />

                {/* Fecha y ubicación */}
                <HeroAddress text="6 de noviembre · Auditorio Polo Saavedra 5085 · Buenos Aires" />

                {/* Botón de inscripción */}
                <HeroButton text="Inscribirse" />
            </div>
        </section>
    );
};

export default Hero;