import CongresoSlider from "./CongresoSlider";

const SobreCongreso = () => {
    return (
        <section id="congreso" className="scroll-mt-24 bg-blanco px-6 py-20 md:px-10 lg:px-16 lg:py-24">
            <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2 lg:gap-20">

                {/* Información sobre el Congreso */}
                <div>
                    <p className="mb-3 text-sm font-bold uppercase tracking-wider text-azul-claro">
                        El Congreso
                    </p>

                    <h2 className="text-3xl font-bold text-azul-oscuro md:text-4xl">
                        Un espacio para compartir y construir
                    </h2>

                    <p className="mt-6 leading-relaxed text-azul-oscuro/75">
                        El 1er Congreso de Educación Técnica Superior – ETS 2026
                        es un espacio para visibilizar y compartir el trabajo que
                        se desarrolla en los Institutos de Formación Técnica
                        Superior de la Ciudad de Buenos Aires.
                    </p>

                    <p className="mt-4 leading-relaxed text-azul-oscuro/75">
                        A través de experiencias de enseñanza, prácticas
                        profesionalizantes, proyectos reales y producciones
                        estudiantiles, el Congreso busca poner en diálogo los
                        procesos, aprendizajes y capacidades que se construyen
                        en la Educación Técnica Superior.
                    </p>
                </div>

                {/* Slider de imágenes */}
                <CongresoSlider />
            </div>
        </section>
    );
};

export default SobreCongreso;