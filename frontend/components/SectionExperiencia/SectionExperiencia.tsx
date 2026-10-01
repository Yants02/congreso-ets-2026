import VideoIframe from "./VideoIframe/VideoIframe";


const SectionExperiencia = () => {
    return(
        <section className="p-5 sm:p-10 text-center --color-blanco">
            <h4 className="text-azul-oscuro text-base sm:text-2xl font-bold  mb-4">Sumate a la experiencia ETS</h4>

            <div className="mx-auto w-full max-w-4xl">
               <VideoIframe 
                    videoUrl="https://www.youtube.com/embed/fFaAyN6sBus?si=7NMzlsDyW2jo-esW"
                    videoTitle="Prueba"/>
            </div>
        </section>
    )
}

export default SectionExperiencia;