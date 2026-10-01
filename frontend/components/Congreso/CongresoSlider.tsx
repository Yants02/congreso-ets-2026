"use client";

import { useState } from "react";

const images = [
    "/1. IMAGENES/CONGRESO/congreso-1.jpg",
    "/1. IMAGENES/CONGRESO/congreso-2.jpg",
    "/1. IMAGENES/CONGRESO/congreso-3.jpg",
];

const CongresoSlider = () => {
    const [currentImage, setCurrentImage] = useState(0);

    // Mostrar la imagen anterior
    const previousImage = () => {
        setCurrentImage(
            (current) => (current - 1 + images.length) % images.length
        );
    };

    // Mostrar la imagen siguiente
    const nextImage = () => {
        setCurrentImage((current) => (current + 1) % images.length);
    };

    return (
        <div className="relative">

            {/* Espacio reservado para las imágenes */}
            <div className="relative aspect-[16/9] overflow-hidden bg-azul-oscuro/10">
            </div>

            {/* Botón para volver a la imagen anterior */}
            <button
                type="button"
                onClick={previousImage}
                aria-label="Imagen anterior"
                className="absolute left-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center bg-white/90 text-xl text-azul-oscuro transition hover:bg-amarillo"
            >
                ‹
            </button>

            {/* Botón para avanzar a la siguiente imagen */}
            <button
                type="button"
                onClick={nextImage}
                aria-label="Imagen siguiente"
                className="absolute right-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center bg-white/90 text-xl text-azul-oscuro transition hover:bg-amarillo"
            >
                ›
            </button>

            {/* Indicadores de la imagen actual */}
            <div className="mt-4 flex justify-center gap-2">
                {images.map((_, index) => (
                    <button
                        key={index}
                        type="button"
                        onClick={() => setCurrentImage(index)}
                        aria-label={`Ver imagen ${index + 1}`}
                        className={`h-2.5 w-2.5 rounded-full transition ${
                            index === currentImage
                                ? "bg-azul-claro"
                                : "bg-azul-oscuro/20"
                        }`}
                    />
                ))}
            </div>
        </div>
    );
};

export default CongresoSlider;