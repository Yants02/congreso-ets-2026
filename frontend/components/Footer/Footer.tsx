import Image from "next/image"
import logoMinisterioGobierno from "@/assets/LOGOS/MINISTERIO DE EDUCACIÓN/Bajada_blanco.png";
import logoCongreso from "@/assets/LOGOS/Congreso/MARCA BLANCO.svg"

const Footer = () => {
    return (
        <footer className="flex flex-col bg-azul-oscuro px-6 pb-4 pt-8 text-blanco ">
            <div className="border-b-1 border-b-blanco flex flex-wrap justify-between pb-2 gap-3 sm:gap-1">
                <div className="flex-shrink-0 mr-auto">
                    <Image 
                        className="w-auto h-12 sm:h-20 object-contain object-left" 
                        alt="Logo Ministerio" 
                        src={logoMinisterioGobierno}/>             
                </div>
                
                <div className="flex items-center w-auto gap-3 sm:gap-5 text-center">
                    <Image  
                    className="h-15 sm:h-25 w-auto " 
                    alt="Logo Ministerio" 
                    src={logoCongreso}/> 
                    <p className="font-semibold text-xs sm:text-base">1° Congreso de Educación Técnica Superior</p>
                                
                </div>
                
            </div>

            <div className="flex flex-col items-center justify-center pt-4 text-center text-blanco">
                <p>
                    Consultas institucionales:
                    <a className="ml-2 font-semibold underline hover:no-underline" href="mailto:congreso.dets@bue.edu.ar">
                        congreso.dets@bue.edu.ar
                    </a>
                </p>
            </div>

            <div className="mx-auto max-w-5xl pt-4 text-center">
                <p className="text-xs text-blanco/60">
                    © 2026 · Todos los derechos reservados · Equipo Desarrollo IFTS°4 {/* Esto hay que comentarlo porque en la documentacion figura PENDIENTE*/}
                </p>
            </div>
            
        </footer>
    )
}

export default Footer