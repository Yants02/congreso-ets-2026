"use client";
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

const ComoLlego = () => {
  const [evento, setEvento] = useState<any>(null);
  const searchParams = useSearchParams();

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
  }, [searchParams]);

  return (
    <section className="flex flex-col items-center justify-center py-16 px-4 bg-white text-[#1D3343]">
      <div className="max-w-4xl w-full flex flex-col gap-8">
        
        {/* Encabezado de la sección */}
        <div className="flex flex-col gap-2 text-center">
          <h2 className="text-3xl md:text-4xl font-bold">Cómo Llego</h2>
          <p className="text-lg text-[#1D3343]">
            Te esperamos en el <strong>{evento?.sede_nombre || 'Auditorio Polo Saavedra'}</strong>
            <br />
            {evento?.sede_direccion || 'Crisólogo Larralde 5085, Ciudad Autónoma de Buenos Aires.'}
          </p>
        </div>

        {/* Mapa Embebido */}
        <div className="w-full h-80 md:h-96 rounded-2xl overflow-hidden shadow-lg border border-gray-200">
          <iframe 
            src={evento?.sede_mapa_url || "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3285.801878893456!2d-58.49887752426177!3d-34.55855215509748!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x95bcb71d87e07ca7%3A0xb35a0ceb3fa10657!2sPolo%20Educativo%20Saavedra!5e0!3m2!1ses!2sar!4v1714413645398!5m2!1ses!2sar"} 
            width="100%" 
            height="100%" 
            style={{ border: 0 }} 
            allowFullScreen={true} 
            loading="lazy" 
            referrerPolicy="no-referrer-when-downgrade"
            title={`Mapa de ubicación ${evento?.sede_nombre || 'Polo Saavedra'}`}
          ></iframe>
        </div>

        {/* Botón de Google Maps */}
        <div className="flex justify-center">
          <a 
            href={evento?.sede_mapa_url || "https://maps.google.com/?q=Crisólogo+Larralde+5085,+Ciudad+Autónoma+de+Buenos+Aires"} 
            target="_blank" 
            rel="noopener noreferrer"
            className="bg-[#FFCD02] text-[#1D3343] font-bold py-3 px-8 rounded-full hover:bg-[#1D3343] hover:text-[#FFCD02] transition cursor-pointer inline-block text-center"
          >
            Abrir en Google Maps
          </a>
        </div>

      </div>
    </section>
  );
};

export default ComoLlego;
