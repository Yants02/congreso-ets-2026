"use client";
import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Card from "./Card";
import imgCard1 from "@/assets/ICONOS CARD/card1.svg";
import imgCard2 from "@/assets/ICONOS CARD/card2.svg";
import imgCard3 from "@/assets/ICONOS CARD/card3.svg";
import imgCard4 from "@/assets/ICONOS CARD/card4.svg";
import imgCard5 from "@/assets/ICONOS CARD/card5.svg";
import Link from "next/link";


const CardsInfo = () => {
    const [evento, setEvento] = useState<any>(null);
    const searchParams = useSearchParams();

    const DEFAULT_CARDS = [
        {
            id: 1,
            image: imgCard1,
            builtinKey: "card1",
            title: "Aula Abierta",
            badge: "Demostración Práctica",
            description: "Instancias programadas para mostrar el saber hacer técnico-profesional en acción. Permiten presentar procedimientos, prácticas, simulaciones, intervenciones, uso de herramientas, resolución de problemas o secuencias de trabajo que necesitan ser observadas de manera dinámica y contextualizada.",
            pdfUrl: "/PDF/1 Aula Abierta - demostraciones aplicadas.pdf"
        },
        {
            id: 2,
            image: imgCard2,
            builtinKey: "card2",
            title: "Muestra permanente / Stands",
            badge: "Exhibición Permanente",
            description: "Espacio institucional de muestra permanente destinado a exhibir experiencias, proyectos, producciones y evidencias formativas. El foco no está solamente en el resultado final, sino también en el proceso, las decisiones técnicas, la participación estudiantil y los aprendizajes construidos.",
            pdfUrl: "/PDF/2 Muestra permanente - Stands.pdf"
        },
        {
            id: 3,
            image: imgCard3,
            builtinKey: "card3",
            title: "Presentaciones académico - aplicadas",
            badge: "Académico",
            description: "Espacios para explicar, analizar y sistematizar experiencias reales vinculadas con la Educación Técnica Superior. Pueden incluir experiencias de enseñanza, prácticas profesionalizantes, investigaciones situadas, sistematizaciones, análisis de casos y modelos de gestión o enseñanza, siempre vinculados con procesos institucionales concretos.",
            pdfUrl: "/PDF/3 Presentaciones académico-aplicadas.pdf"
        },
        {
            id: 4,
            image: imgCard4,
            builtinKey: "card4",
            title: "Proyectos y producciones de estudiantes",
            badge: "Estudiantil",
            description: "Espacio de presentación de proyectos, producciones y desarrollos realizados por estudiantes en el marco de sus trayectorias formativas. Las presentaciones deberán permitir comprender el problema abordado, el proceso de trabajo, las decisiones tomadas, las evidencias producidas y los aprendizajes construidos, con acompañamiento institucional.",
            pdfUrl: "/PDF/4 Proyectos y producciones estudiantiles.pdf"
        },
        {
            id: 5,
            image: imgCard5,
            builtinKey: "card5",
            title: "Talentos ETS",
            badge: "Pitch / Panel",
            description: "Dispositivo de presentación breve de proyectos aplicados con preguntas y devolución formativa de un panel. Su finalidad es enriquecer los proyectos y fortalecer capacidades de comunicación, argumentación y mejora. No constituye una competencia: no hay ranking, ganadores, premiación, reclutamiento ni promesas de oportunidades posteriores.",
            pdfUrl: "/PDF/5 Talentos ETS.pdf"
        }
    ];

    const [cardsData, setCardsData] = useState<any[]>(DEFAULT_CARDS);

    useEffect(() => {
        const previewId = searchParams?.get('preview_id');
        const url = previewId ? `/api/vacantes/evento-activo?preview_id=${previewId}` : '/api/vacantes/evento-activo';
        
        fetch(url)
            .then(res => res.json())
            .then(data => {
                if (data.ok && data.evento) {
                    setEvento(data.evento);
                }
            })
            .catch(console.error);

        // Cargar tarjetas dinámicas del CMS
        fetch('/api/frontend/cards')
            .then(res => res.json())
            .then(data => {
                if (data.ok && Array.isArray(data.cards) && data.cards.length > 0) {
                    // Mapear íconos integrados si corresponde
                    const iconMap: Record<string, any> = {
                        card1: imgCard1,
                        card2: imgCard2,
                        card3: imgCard3,
                        card4: imgCard4,
                        card5: imgCard5,
                    };
                    const resolved = data.cards.map((c: any) => ({
                        ...c,
                        image: (c.builtinKey && iconMap[c.builtinKey]) || c.image || imgCard1,
                    }));
                    setCardsData(resolved);
                }
            })
            .catch(console.error);
    }, [searchParams]);

    const formatearFecha = (fechaStr: string) => {
        if (!fechaStr) return '';
        const justDate = fechaStr.split('T')[0];
        const f = new Date(justDate + 'T12:00:00Z');
        return new Intl.DateTimeFormat('es-AR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        }).format(f).replace(',', '');
    };

    // REFERENCIAS Y ESTADOS PARA EL CARRUSEL
    const carouselRef = useRef<HTMLDivElement>(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);

    // LOGICA PARA ARRASTRAR CON EL MOUSE
    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        if (carouselRef.current) {
            setStartX(e.pageX - carouselRef.current.offsetLeft);
            setScrollLeft(carouselRef.current.scrollLeft);
        }
    };

    const handleMouseLeave = () => setIsDragging(false);
    const handleMouseUp = () => setIsDragging(false);

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !carouselRef.current) return;
        e.preventDefault();
        const x = e.pageX - carouselRef.current.offsetLeft;
        const walk = (x - startX) * 2;
        carouselRef.current.scrollLeft = scrollLeft - walk;
    };

    // ACTUALIZAR PUNTOS AL HACER SCROLL
    const handleScroll = () => {
        if (carouselRef.current) {
            const scrollPosition = carouselRef.current.scrollLeft;
            const cardWidth = carouselRef.current.children[0].clientWidth;
            const newIndex = Math.round(scrollPosition / cardWidth);
            setActiveIndex(newIndex);
        }
    };

    // CLICK EN LOS PUNTOS PARA NAVEGAR
    const scrollToCard = (index: number) => {
        if (carouselRef.current) {
            const container = carouselRef.current;
            const card = container.children[index] as HTMLElement;
            
            if (card) {
                container.scrollTo({
                    left: card.offsetLeft - container.offsetLeft,
                    behavior: "smooth"
                });
            }
            setActiveIndex(index);
        }
    };

    return (
        <section className="flex flex-col items-center w-full pb-10 overflow-hidden bg-white">
            <div className="max-w-6xl w-full mx-auto px-4 pt-16 pb-4">
                <h2 className="text-3xl md:text-4xl font-bold text-[#1D3343] text-left">
                    Actividades
                </h2>
                <p className="text-gray-600 text-base mt-2 text-left"> Conocé las diferentes modalidades de participación y presentación previstas para el congreso.</p>
            </div>

            {/* SECCION DE CARDS Y CARRUSEL */}
            <div className="max-w-6xl w-full mx-auto px-4 pb-16">
                
                {/* Contenedor del Carrusel */}
                <div 
                    ref={carouselRef}
                    onMouseDown={handleMouseDown}
                    onMouseLeave={handleMouseLeave}
                    onMouseUp={handleMouseUp}
                    onMouseMove={handleMouseMove}
                    onScroll={handleScroll}
                    className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth gap-6 pt-4 pb-8 [&::-webkit-scrollbar]:hidden cursor-grab active:cursor-grabbing select-none"
                    style={{ scrollbarWidth: 'none' }}
                >
                    {cardsData.map((card, index) => (
                        <div 
                            key={index} 
                            className="w-[290px] sm:w-[330px] shrink-0 snap-center flex flex-col"
                        >
                            <Card 
                                cardImg={card.image} 
                                title={card.title} 
                                description={card.description}
                                pdfUrl={card.pdfUrl}
                                badge={card.badge}
                            />
                        </div>
                    ))}
                </div>

                {/* PUNTOS */}
                <div className="flex justify-center items-center gap-2 sm:gap-3 mt-2">
                    {cardsData.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => scrollToCard(index)}
                            className={`transition-all duration-300 rounded-full ${
                                activeIndex === index 
                                    ? "w-8 sm:w-10 h-2.5 sm:h-3 bg-[#1D3343]" // Azul Oscuro para el activo
                                    : "w-2.5 sm:w-3 h-2.5 sm:h-3 bg-gray-300 hover:bg-[#035C80]" // Azul Claro en hover
                            }`}
                            aria-label={`Ir a la tarjeta ${index + 1}`}
                        />
                    ))}
                </div>
            </div>

            {/* SECCION DE INFORMACION Y MAPA */}
            <div className="w-full bg-[#FCFCFC] border-t border-gray-200 flex flex-col md:flex-row justify-between items-stretch min-h-[220px] mt-8">
                
                {/* info izquierda */}
                <div className="flex flex-col md:flex-row items-center justify-center flex-1 py-10 px-8 gap-8 md:gap-12">
                    
                    {/* Fecha */}
                    <div className="flex items-start gap-4">
                        <div className="mt-1 text-[#035C80]">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                                <path d="M19 4H18V2H16V4H8V2H6V4H5C3.89 4 3.01 4.9 3.01 6L3 20C3 21.1 3.89 22 5 22H19C20.1 22 21 21.1 21 20V6C21 4.9 20.1 4 19 4ZM19 20H5V10H19V20ZM19 8H5V6H19V8Z"/>
                            </svg>
                        </div>
                        <div>
                            <h4 className="font-bold text-[#1D3343] text-[17px]">Fecha</h4>
                            <p className="text-gray-700 text-sm mt-1 leading-snug">
                                {evento && evento.fecha_inicio ? (
                                    <>
                                        {formatearFecha(evento.fecha_inicio)}
                                        {evento.fecha_fin && evento.fecha_fin !== evento.fecha_inicio ? <><br/>al {formatearFecha(evento.fecha_fin)}</> : ''}
                                    </>
                                ) : (
                                    <>Viernes 6 de<br/>noviembre 2026</>
                                )}
                            </p>
                        </div>
                    </div>
                    
                    {/* Divisores */}
                    <div className="hidden md:block w-px h-16 bg-gray-300"></div>
                    <div className="block md:hidden w-1/2 h-px bg-gray-300"></div>

                    {/* Ubiicación */}
                    <div className="flex items-start gap-4">
                        <div className="mt-1 text-[#035C80]">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2ZM12 11.5C10.62 11.5 9.5 10.38 9.5 9C9.5 7.62 10.62 6.5 12 6.5C13.38 6.5 14.5 7.62 14.5 9C14.5 10.38 13.38 11.5 12 11.5Z"/>
                            </svg>
                        </div>
                        <div>
                            <h4 className="font-bold text-[#1D3343] text-[17px]">{evento?.sede_nombre || "Auditorio Polo Saavedra"}</h4>
                            <p className="text-gray-700 text-sm mt-1 leading-snug">
                                {evento?.sede_direccion ? (
                                    evento.sede_direccion.split(',').map((line: string, i: number) => (
                                        <span key={i}>{line.trim()}{i === 0 && <br/>}</span>
                                    ))
                                ) : (
                                    <>Crisólogo Larralde 5085<br/>Buenos Aires</>
                                )}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Mapa Derecha */}
                <div className="flex-1 relative min-h-[300px] md:min-h-full bg-gray-200">
                    
                    <iframe 
                        src={evento?.sede_mapa_url || "https://maps.google.com/maps?q=Cris%C3%B3logo+Larralde+5085,+Buenos+Aires&t=&z=15&ie=UTF8&iwloc=&output=embed"} 
                        className="absolute inset-0 w-full h-full border-0"
                        allowFullScreen
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                    ></iframe>
                    
                    {/* boton */}
                    <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#1D3343]/40 to-transparent pointer-events-none"></div>

                    <Link 
                        href={evento?.sede_mapa_url || "https://maps.google.com/?q=Crisólogo+Larralde+5085,+Ciudad+Autónoma+de+Buenos+Aires"}
                        className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-10"
                    >
                        <button className="bg-[#FCFCFC] px-6 py-2 rounded text-[#1D3343] text-sm font-bold shadow-[0_4px_12px_rgb(0,0,0,0.25)] flex items-center gap-2 hover:bg-[#FFCD02] hover:scale-105 transition-all cursor-pointer">
                            Cómo llegar &rarr;
                        </button>
                    </Link>
                </div>

            </div>
        </section>
    );
};

export default CardsInfo;