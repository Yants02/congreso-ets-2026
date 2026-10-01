'use client';

import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';

interface Props {
  usuarioId: string | number;
  nombreCompleto?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onCompleted?: () => void;
}

interface Pregunta {
  id: number;
  orden: number;
  texto_pregunta: string;
  tipo_pregunta: string;
  es_obligatoria: boolean;
}

interface Encuesta {
  id: number;
  titulo: string;
  descripcion: string;
  preguntas: Pregunta[];
}

export default function EncuestaSatisfaccionModal({
  usuarioId,
  nombreCompleto,
  isOpen,
  onClose,
  onSuccess,
  onCompleted,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [encuesta, setEncuesta] = useState<Encuesta | null>(null);

  // Respuestas: { [pregunta_id]: { valor_numerico?: number, respuesta_texto?: string } }
  const [respuestas, setRespuestas] = useState<Record<number, any>>({});

  useEffect(() => {
    if (!isOpen) return;

    async function loadEncuesta() {
      setLoading(true);
      try {
        const res = await fetch('/api/encuestas/activa');
        if (res.ok) {
          const data = await res.json();
          if (data.encuesta) {
            setEncuesta(data.encuesta);
            // Inicializar respuestas en 5 estrellas por defecto
            const init: Record<number, any> = {};
            data.encuesta.preguntas.forEach((p: Pregunta) => {
              if (p.tipo_pregunta === 'CALIFICACION_1_A_5') {
                init[p.id] = { valor_numerico: 5 };
              } else {
                init[p.id] = { respuesta_texto: '' };
              }
            });
            setRespuestas(init);
          }
        }
      } catch (err) {
        console.error('Error cargando encuesta:', err);
      } finally {
        setLoading(false);
      }
    }

    loadEncuesta();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRatingChange = (preguntaId: number, rating: number) => {
    setRespuestas((prev) => ({
      ...prev,
      [preguntaId]: { ...prev[preguntaId], valor_numerico: rating },
    }));
  };

  const handleTextChange = (preguntaId: number, text: string) => {
    setRespuestas((prev) => ({
      ...prev,
      [preguntaId]: { ...prev[preguntaId], respuesta_texto: text },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!encuesta) return;

    setSubmitting(true);
    try {
      const payloadRespuestas = Object.entries(respuestas).map(([pId, val]) => ({
        pregunta_id: parseInt(pId, 10),
        valor_numerico: val.valor_numerico,
        respuesta_texto: val.respuesta_texto,
      }));

      const res = await fetch('/api/encuestas/responder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          encuesta_id: encuesta.id,
          usuario_id: usuarioId,
          respuestas: payloadRespuestas,
        }),
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        if (onCompleted) onCompleted();
        if (onSuccess) onSuccess();
      } else {
        await Swal.fire({
          title: 'Atención',
          text: data.message || 'Error al enviar la evaluación.',
          icon: 'warning',
          confirmButtonColor: '#005691',
        });
      }
    } catch {
      await Swal.fire({
        title: 'Error de Conexión',
        text: 'No fue posible comunicarse con el servidor.',
        icon: 'error',
        confirmButtonColor: '#dc3545',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="text-center pb-2 border-b border-gray-100">
          <span className="text-3xl">⭐</span>
          <h3 className="text-lg font-extrabold text-gray-900 mt-1">
            {encuesta?.titulo || 'Encuesta de Calidad y Satisfacción'}
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Hola <strong>{nombreCompleto}</strong>, tu opinión es fundamental para nosotros. Completa esta breve evaluación de 1 minuto para desbloquear tu <strong>Certificado Oficial</strong>.
          </p>
        </div>

        {loading ? (
          <div className="py-8 text-center text-gray-500 text-sm">Cargando formulario de evaluación...</div>
        ) : !encuesta ? (
          <div className="py-6 text-center text-gray-500 text-sm">
            No hay encuesta activa en este momento.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {encuesta.preguntas.map((p) => {
              if (p.tipo_pregunta === 'CALIFICACION_1_A_5') {
                const currentRating = respuestas[p.id]?.valor_numerico || 5;

                return (
                  <div key={p.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                    <label className="block text-xs font-bold text-gray-800">
                      {p.orden}. {p.texto_pregunta}
                    </label>

                    {/* Selector de Estrellas */}
                    <div className="flex items-center justify-center gap-2 py-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => handleRatingChange(p.id, star)}
                          className={`text-3xl transition-transform hover:scale-125 focus:outline-none ${
                            star <= currentRating ? 'text-amber-400 drop-shadow-xs' : 'text-gray-200'
                          }`}
                        >
                          ★
                        </button>
                      ))}
                      <span className="text-xs font-bold text-amber-700 ml-2">
                        {currentRating} de 5
                      </span>
                    </div>
                  </div>
                );
              }

              if (p.tipo_pregunta === 'TEXTO_ABIERTO') {
                return (
                  <div key={p.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                    <label className="block text-xs font-bold text-gray-800">
                      {p.orden}. {p.texto_pregunta}
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Deje sus comentarios, críticas constructivas o sugerencias temáticas..."
                      value={respuestas[p.id]?.respuesta_texto || ''}
                      onChange={(e) => handleTextChange(p.id, e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                    />
                  </div>
                );
              }

              return null;
            })}

            <div className="pt-3 flex gap-2 border-t border-gray-100">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="flex-1 py-2.5 border border-gray-300 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 transition"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center justify-center gap-1.5"
              >
                {submitting ? (
                  <span>Enviando...</span>
                ) : (
                  <>
                    <span>Enviar & Desbloquear</span>
                    <span>🎓</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
