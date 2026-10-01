'use client';

import React, { useState } from "react";
import Header from "../../components/Header/Header";
import Footer from "@/components/Footer/Footer";


interface FAQ {
    id: number;
    question: string;
    answer: string;
}

const faqData: FAQ[] = [
    {
        id: 1,
        question: '¿Qué es el Congreso ETS 2026?',
        answer:
            'Es una instancia institucional, académico-aplicada, demostrativa y formativa destinada a mostrar y poner en diálogo experiencias de enseñanza, prácticas profesionalizantes, proyectos, producciones estudiantiles y modelos de gestión y enseñanza de la Educación Técnica Superior.',
    },
    {
        id: 2,
        question: '¿Cuándo se realiza?',
        answer:
            'El 6 de noviembre de 2026.',
    },
    {
        id: 3,
        question: '¿Dónde se realiza?',
        answer:
            'La sede prevista es el Auditorio Polo Saavedra, Crisólogo Larralde 5085, Ciudad de Buenos Aires.',
    },
    {
        id: 4,
        question: '¿La participación es gratuita?',
        answer:
            'Sí. El Congreso es una iniciativa pública, abierta y gratuita.',
    },
    {
        id: 5,
        question: '¿Cómo me inscribo como asistente?',
        answer:
            'La inscripción se realizará desde esta web. El formulario estará disponible próximamente.',
    },
    {
        id: 6,
        question: '¿Tengo que inscribirme en cada actividad?',
        answer:
            'No. La inscripción es general al Congreso. El formulario podrá relevar intereses, pero esa selección no constituye una reserva de lugar en actividades específicas.',
    },
    {
        id: 7,
        question: '¿La inscripción tiene cupo?',
        answer:
            'Sí. La cantidad de inscripciones confirmadas está sujeta a la capacidad de la sede. Una vez alcanzado el cupo, el sistema permitirá registrarse en lista de espera.',
    },
    {
        id: 8,
        question: '¿Para qué sirve el QR?',
        answer:
            'Las personas con inscripción confirmada recibirán un QR personal que se utilizará para acreditar el ingreso y registrar la asistencia a actividades durante la jornada.',
    },
    {
        id: 9,
        question: '¿Debo presentar el DNI al ingresar?',
        answer:
            'En principio, la acreditación se realizará mediante el QR generado por el sistema y no está previsto solicitar el documento al momento del ingreso.',
    },
    {
        id: 10,
        question: '¿Habrá constancia o microcredencial de participación?',
        answer:
            'Se prevé la emisión posterior de una constancia o microcredencial a partir de la participación efectiva. El criterio operativo definido requiere acreditación general al Congreso y registro de asistencia a al menos una actividad.',
    },
    {
        id: 11,
        question: '¿Cómo se presentan propuestas institucionales?',
        answer:
            'Las instituciones de Formación Técnica Superior dependientes de la DETS cuentan con un circuito específico de carga de propuestas. Ese circuito es diferente de la inscripción de asistentes.',
    },
];

export default function Contacto() {
    const [openId, setOpenId] = useState<number | null>(0);

    const toggleFAQ = (id: number) => {
        setOpenId(openId === id ? null : id);
    };

    return (
        <div className="min-h-screen bg-white pt-24">
            <title>Contacto | DETS 2026</title>
            <Header />

            <main className="max-w-3xl mx-auto px-4 py-12 flex flex-col items-center">

                <div className="text-center mb-10">
                    <h2 className="text-sm uppercase tracking-widest text-[var(--color-azul-claro)] font-bold mb-1">
                        Preguntas Frecuentes
                    </h2>
                    <h1 className="text-2xl text-[var(--color-azul-oscuro)] md:text-3xl font-extrabold">
                        Todo lo que necesitás saber
                    </h1>
                </div>

                {/* Desplegables */}
                <div className="w-full space-y-4">
                    {faqData.map((faq) => {
                        const isOpen = openId === faq.id;
                        return (
                            <div
                                key={faq.id}
                                className={`border rounded-xl transition-all duration-200 overflow-hidden bg-white ${isOpen
                                    ? 'border-gray-200 shadow-md'
                                    : 'border-gray-200 hover:border-gray-300'
                                    }`}
                            >
                                <button
                                    onClick={() => toggleFAQ(faq.id)}
                                    className="w-full p-5 text-left flex justify-between items-center focus:outline-none"
                                >
                                    <span className="font-bold text-[var(--color-azul-claro)] text-sm md:text-base">
                                        {faq.question}
                                    </span>

                                    {/* Icono + / X */}
                                    <span className="ml-4 flex-shrink-0">
                                        {isOpen ? (
                                            <div className="w-6 h-6 rounded-full bg-[var(--color-amarillo)] text-white flex items-center justify-center text-xs font-bold">
                                                ✕
                                            </div>
                                        ) : (
                                            <div className="w-6 h-6 rounded-full bg-gray-100 text-[var(--color-azul-oscuro)] flex items-center justify-center text-sm font-bold">
                                                +
                                            </div>
                                        )}
                                    </span>
                                </button>

                                {/* Contenido desplegado */}
                                {isOpen && (
                                    <div className="px-5 pb-5 text-xs md:text-sm text-[var(--color-azul-oscuro)] leading-relaxed border-t border-gray-100 pt-3">
                                        {faq.answer}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="w-full mt-8 bg-gray-50/60 border border-gray-100 rounded-xl p-8 text-center">
                    <p className="font-medium text-[var(--color-azul-oscuro)] md:text-lg mb-1">
                        ¿Tenés alguna duda que no está respondida aquí?
                    </p>
                    <a
                        href="mailto:congreso.dets@bue.edu.ar"
                        className="font-bold underline text-[var(--color-azul-claro)] underline-offset-4 hover:text-gray-700 text-sm md:text-base"
                    >
                        Contactate con nosotros
                    </a>
                </div>

            </main>
            <Footer />
        </div>

    );
}