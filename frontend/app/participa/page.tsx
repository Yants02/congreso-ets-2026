import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import FormularioInscripcion from "@/components/FormularioInscripcion";

export default function Participa() {
    return (
        <div className="min-h-screen bg-slate-50/50 pt-24 flex flex-col">
            <title>Inscripción al Congreso | DETS 2026</title>
            <Header />

            <main className="max-w-4xl mx-auto px-4 py-8 flex flex-col items-center flex-1 w-full">
                <div className="text-center mb-8 max-w-2xl">
                    <span className="inline-block px-3.5 py-1 mb-3 text-xs font-bold tracking-widest uppercase bg-blue-100 text-[var(--color-azul-claro)] rounded-full">
                        Inscripciones Abiertas · Cupos Limitados
                    </span>
                    <h1 className="text-2xl text-[var(--color-azul-oscuro)] md:text-4xl font-extrabold tracking-tight mb-2">
                        ¡Asegurá tu lugar hoy mismo!
                    </h1>
                    <h2 className="text-xs md:text-sm uppercase tracking-wider text-gray-500 font-bold mb-3">
                        Gratuito, presencial y con streaming en vivo. Certificado oficial del GCBA incluido.
                    </h2>
                    <p className="text-xs md:text-sm text-gray-600">
                        Completá el formulario oficial para reservar tu vacante en el Auditorio Polo Saavedra o acceder a la transmisión oficial con control de asistencia digital.
                    </p>
                </div>

                <FormularioInscripcion />
            </main>

            <Footer />
        </div>
    );
}
