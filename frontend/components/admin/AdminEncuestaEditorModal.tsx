'use client';

import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';

export interface PreguntaItem {
  id?: number;
  orden: number;
  texto_pregunta: string;
  tipo_pregunta: 'CALIFICACION_1_A_5' | 'TEXTO_ABIERTO' | 'OPCION_MULTIPLE';
  es_obligatoria: boolean;
  peso_ponderacion: number;
}

export interface EncuestaEditorData {
  id?: number;
  titulo: string;
  descripcion: string;
  etapa: string;
  es_obligatoria: boolean;
  activa: boolean;
  preguntas: PreguntaItem[];
}

interface Props {
  isOpen: boolean;
  encuestaInicial?: EncuestaEditorData | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}

export default function AdminEncuestaEditorModal({
  isOpen,
  encuestaInicial,
  onClose,
  onSaved,
}: Props) {
  const [encuesta, setEncuesta] = useState<EncuestaEditorData>({
    titulo: 'Encuesta de Evaluación y Satisfacción Institucional',
    descripcion:
      'Tu opinión nos permite mejorar la calidad académica, contenidos y organización de las próximas ediciones del Congreso ETS.',
    etapa: 'POST_EVENTO',
    es_obligatoria: true,
    activa: true,
    preguntas: [
      {
        orden: 1,
        texto_pregunta: '¿Cómo califica el nivel académico y la claridad expositiva de los disertantes?',
        tipo_pregunta: 'CALIFICACION_1_A_5',
        es_obligatoria: true,
        peso_ponderacion: 1.0,
      },
      {
        orden: 2,
        texto_pregunta: '¿Cómo evalúa la organización general, acreditaciones y puntualidad del evento?',
        tipo_pregunta: 'CALIFICACION_1_A_5',
        es_obligatoria: true,
        peso_ponderacion: 1.0,
      },
      {
        orden: 3,
        texto_pregunta: '¿Qué temas, talleres prácticos o tecnologías le gustaría que se incorporen en la próxima edición?',
        tipo_pregunta: 'TEXTO_ABIERTO',
        es_obligatoria: false,
        peso_ponderacion: 1.0,
      },
    ],
  });

  const [saving, setSaving] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [activeStep, setActiveStep] = useState<'config' | 'preguntas'>('preguntas');

  useEffect(() => {
    if (encuestaInicial) {
      setEncuesta({
        id: encuestaInicial.id,
        titulo: encuestaInicial.titulo || '',
        descripcion: encuestaInicial.descripcion || '',
        etapa: encuestaInicial.etapa || 'POST_EVENTO',
        es_obligatoria: encuestaInicial.es_obligatoria ?? true,
        activa: encuestaInicial.activa ?? true,
        preguntas:
          encuestaInicial.preguntas && encuestaInicial.preguntas.length > 0
            ? [...encuestaInicial.preguntas]
            : [
                {
                  orden: 1,
                  texto_pregunta: '¿Cómo califica la calidad general del Congreso ETS 2026?',
                  tipo_pregunta: 'CALIFICACION_1_A_5',
                  es_obligatoria: true,
                  peso_ponderacion: 1.0,
                },
              ],
      });
    }
  }, [encuestaInicial]);

  // Agregar nueva pregunta
  function handleAddPregunta(tipo: 'CALIFICACION_1_A_5' | 'TEXTO_ABIERTO' | 'OPCION_MULTIPLE') {
    const nueva: PreguntaItem = {
      orden: encuesta.preguntas.length + 1,
      texto_pregunta:
        tipo === 'CALIFICACION_1_A_5'
          ? '¿Cómo califica la utilidad de los contenidos abordados?'
          : tipo === 'TEXTO_ABIERTO'
          ? 'Deje sus comentarios, felicitaciones o sugerencias de mejora:'
          : 'Seleccione su nivel de conformidad con el horario y sede:',
      tipo_pregunta: tipo,
      es_obligatoria: true,
      peso_ponderacion: 1.0,
    };
    setEncuesta({
      ...encuesta,
      preguntas: [...encuesta.preguntas, nueva],
    });
  }

  // Eliminar pregunta
  function handleRemovePregunta(index: number) {
    const filtradas = encuesta.preguntas.filter((_, i) => i !== index);
    const reordenadas = filtradas.map((p, i) => ({ ...p, orden: i + 1 }));
    setEncuesta({ ...encuesta, preguntas: reordenadas });
  }

  // Mover pregunta (Subir / Bajar)
  function handleMovePregunta(index: number, direction: 'up' | 'down') {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === encuesta.preguntas.length - 1)
    ) {
      return;
    }
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const items = [...encuesta.preguntas];
    const temp = items[index];
    items[index] = items[targetIndex];
    items[targetIndex] = temp;

    const reordenadas = items.map((p, i) => ({ ...p, orden: i + 1 }));
    setEncuesta({ ...encuesta, preguntas: reordenadas });
  }

  // Actualizar campo de pregunta
  function handleUpdatePregunta(index: number, field: keyof PreguntaItem, val: any) {
    const items = [...encuesta.preguntas];
    items[index] = { ...items[index], [field]: val };
    setEncuesta({ ...encuesta, preguntas: items });
  }

  // Guardar en Backend
  async function handleGuardar() {
    if (!encuesta.titulo.trim()) {
      Swal.fire({ title: 'Atención', text: 'El título de la encuesta es obligatorio.', icon: 'warning' });
      return;
    }
    if (encuesta.preguntas.length === 0) {
      Swal.fire({ title: 'Atención', text: 'Debe incluir al menos una pregunta en la encuesta.', icon: 'warning' });
      return;
    }

    setSaving(true);
    try {
      if (encuesta.id) {
        // Actualización atómica de encuesta y preguntas
        const res = await fetch(`/api/admin/encuestas/${encuesta.id}/sync-completa`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(encuesta),
        });
        const data = await res.json();
        if (res.ok && data.ok) {
          await Swal.fire({
            title: '¡Encuesta Actualizada!',
            text: 'Todos los cambios y preguntas se sincronizaron con éxito.',
            icon: 'success',
            confirmButtonColor: '#005691',
          });
          onSaved(data.mensaje || 'Encuesta actualizada correctamente.');
          onClose();
        } else {
          Swal.fire({ title: 'Error', text: data.message || 'Error al actualizar', icon: 'error' });
        }
      } else {
        // Creación de nueva encuesta
        const res = await fetch('/api/admin/encuestas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(encuesta),
        });
        const data = await res.json();
        if (res.ok && data.ok && data.encuesta?.id) {
          // Guardar preguntas asociadas
          await fetch(`/api/admin/encuestas/${data.encuesta.id}/sync-completa`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...encuesta, id: data.encuesta.id }),
          });

          await Swal.fire({
            title: '¡Encuesta Creada!',
            text: 'La nueva encuesta y su diseño WYSIWYG fueron publicados exitosamente.',
            icon: 'success',
            confirmButtonColor: '#005691',
          });
          onSaved('Encuesta creada y publicada con éxito.');
          onClose();
        } else {
          Swal.fire({ title: 'Error', text: data.message || 'Error al crear', icon: 'error' });
        }
      }
    } catch {
      Swal.fire({ title: 'Error de Red', text: 'No se pudo conectar con el servidor.', icon: 'error' });
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-7xl rounded-2xl shadow-2xl border border-gray-200 flex flex-col max-h-[96vh] overflow-hidden">
        {/* Cabecera del Modal */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-800 to-teal-900 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-xl">
              📋
            </div>
            <div>
              <h2 className="text-lg font-bold">
                Editor Visual WYSIWYG de Encuestas de Calidad
              </h2>
              <p className="text-xs text-emerald-200">
                Diseñe el cuestionario en vivo y previsualice en tiempo real la experiencia del participante
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-gray-200 transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Cuerpo Dividido (Split Screen: Diseñador Izq + Previsualizador Der) */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Panel Izquierdo: Constructor y Edición */}
          <div className="w-full lg:w-5/12 border-r border-gray-200 flex flex-col bg-gray-50 overflow-y-auto">
            {/* Pestañas de configuración */}
            <div className="flex border-b border-gray-200 bg-white px-3 pt-2 gap-2 shrink-0">
              <button
                onClick={() => setActiveStep('preguntas')}
                style={{
                  color: activeStep === 'preguntas' ? '#047857' : '#6b7280',
                  borderBottomColor: activeStep === 'preguntas' ? '#047857' : 'transparent',
                }}
                className={`px-3 py-2 text-xs font-bold rounded-t-lg transition border-b-2 cursor-pointer ${
                  activeStep === 'preguntas' ? 'bg-emerald-50/50' : 'hover:text-gray-800'
                }`}
              >
                📝 Preguntas ({encuesta.preguntas.length})
              </button>
              <button
                onClick={() => setActiveStep('config')}
                style={{
                  color: activeStep === 'config' ? '#047857' : '#6b7280',
                  borderBottomColor: activeStep === 'config' ? '#047857' : 'transparent',
                }}
                className={`px-3 py-2 text-xs font-bold rounded-t-lg transition border-b-2 cursor-pointer ${
                  activeStep === 'config' ? 'bg-emerald-50/50' : 'hover:text-gray-800'
                }`}
              >
                ⚙️ Configuración & Bloqueo
              </button>
            </div>

            {/* Contenido según Pestaña */}
            <div className="p-4 space-y-4 flex-1">
              {activeStep === 'config' && (
                <div className="space-y-3 bg-white p-4 rounded-xl border border-gray-200">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Título Oficial de la Encuesta
                    </label>
                    <input
                      type="text"
                      value={encuesta.titulo}
                      onChange={(e) => setEncuesta({ ...encuesta, titulo: e.target.value })}
                      className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Descripción o Instrucciones al Asistente
                    </label>
                    <textarea
                      rows={3}
                      value={encuesta.descripcion}
                      onChange={(e) => setEncuesta({ ...encuesta, descripcion: e.target.value })}
                      className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Etapa de Aplicación</label>
                      <select
                        value={encuesta.etapa}
                        onChange={(e) => setEncuesta({ ...encuesta, etapa: e.target.value })}
                        className="w-full text-xs px-2.5 py-1.5 border border-gray-300 rounded-lg outline-none"
                      >
                        <option value="POST_EVENTO">POST_EVENTO (Descarga Certificado)</option>
                        <option value="ACREDITACION">ACREDITACION (Ingreso en Sede)</option>
                        <option value="INSCRIPCION">INSCRIPCION (Pre-registro)</option>
                        <option value="SONDEO_ABIERTO">SONDEO_ABIERTO</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Estado de Publicación</label>
                      <select
                        value={encuesta.activa ? '1' : '0'}
                        onChange={(e) => setEncuesta({ ...encuesta, activa: e.target.value === '1' })}
                        className="w-full text-xs px-2.5 py-1.5 border border-gray-300 rounded-lg outline-none"
                      >
                        <option value="1">🟢 Activa (Visible)</option>
                        <option value="0">🔴 En Pausa / Inactiva</option>
                      </select>
                    </div>
                  </div>

                  {/* Interruptor de Bloqueo Pedagógico */}
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl mt-3 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-emerald-900 block">
                        🔒 Bloqueo Pedagógico para Certificados
                      </span>
                      <span className="text-[11px] text-emerald-700 block">
                        Exige responder esta encuesta para habilitar la descarga del diploma oficial PDF.
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={encuesta.es_obligatoria}
                        onChange={(e) => setEncuesta({ ...encuesta, es_obligatoria: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>
                </div>
              )}

              {activeStep === 'preguntas' && (
                <div className="space-y-3">
                  {/* Botones para agregar preguntas */}
                  <div className="bg-white p-3 rounded-xl border border-gray-200 space-y-1.5">
                    <span className="text-xs font-bold text-gray-700 block">➕ Agregar Nueva Pregunta:</span>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleAddPregunta('CALIFICACION_1_A_5')}
                        style={{ backgroundColor: '#ecfdf5', color: '#065f46', borderColor: '#a7f3d0' }}
                        className="px-2 py-1.5 text-xs font-bold rounded-lg border hover:bg-emerald-100 transition flex items-center justify-center gap-1 cursor-pointer"
                      >
                        ⭐ 1 a 5 Estrellas
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddPregunta('TEXTO_ABIERTO')}
                        style={{ backgroundColor: '#eff6ff', color: '#1e40af', borderColor: '#bfdbfe' }}
                        className="px-2 py-1.5 text-xs font-bold rounded-lg border hover:bg-blue-100 transition flex items-center justify-center gap-1 cursor-pointer"
                      >
                        ✍️ Texto Libre
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddPregunta('OPCION_MULTIPLE')}
                        style={{ backgroundColor: '#fdf4ff', color: '#86198f', borderColor: '#f5d0fe' }}
                        className="px-2 py-1.5 text-xs font-bold rounded-lg border hover:bg-fuchsia-100 transition flex items-center justify-center gap-1 cursor-pointer"
                      >
                        🔘 Opciones
                      </button>
                    </div>
                  </div>

                  {/* Listado de Preguntas en Edición */}
                  <div className="space-y-2.5">
                    {encuesta.preguntas.map((p, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-white rounded-xl border border-gray-200 shadow-2xs space-y-2 relative group hover:border-emerald-300 transition"
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            Pregunta #{idx + 1} · {p.tipo_pregunta === 'CALIFICACION_1_A_5' ? '⭐ Estrellas' : p.tipo_pregunta === 'TEXTO_ABIERTO' ? '✍️ Texto' : '🔘 Opciones'}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleMovePregunta(idx, 'up')}
                              disabled={idx === 0}
                              className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-30 text-xs font-bold cursor-pointer"
                              title="Subir orden"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMovePregunta(idx, 'down')}
                              disabled={idx === encuesta.preguntas.length - 1}
                              className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-30 text-xs font-bold cursor-pointer"
                              title="Bajar orden"
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemovePregunta(idx)}
                              className="w-6 h-6 rounded bg-red-50 text-red-600 hover:bg-red-100 text-xs font-bold cursor-pointer"
                              title="Eliminar pregunta"
                            >
                              ✕
                            </button>
                          </div>
                        </div>

                        <div>
                          <textarea
                            rows={2}
                            value={p.texto_pregunta}
                            onChange={(e) => handleUpdatePregunta(idx, 'texto_pregunta', e.target.value)}
                            placeholder="Redacte aquí el texto de la pregunta..."
                            className="w-full text-xs px-2.5 py-1.5 border border-gray-300 rounded-lg outline-none focus:ring-1 focus:ring-emerald-500 resize-none font-medium"
                          />
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-100">
                          <label className="flex items-center gap-1.5 cursor-pointer text-gray-700 text-[11px]">
                            <input
                              type="checkbox"
                              checked={p.es_obligatoria}
                              onChange={(e) => handleUpdatePregunta(idx, 'es_obligatoria', e.target.checked)}
                              className="rounded text-emerald-600 focus:ring-emerald-500"
                            />
                            <span>Respuesta Obligatoria</span>
                          </label>

                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-gray-500">Tipo:</span>
                            <select
                              value={p.tipo_pregunta}
                              onChange={(e) => handleUpdatePregunta(idx, 'tipo_pregunta', e.target.value)}
                              className="text-[11px] p-1 border border-gray-300 rounded outline-none"
                            >
                              <option value="CALIFICACION_1_A_5">⭐ 1-5 Estrellas</option>
                              <option value="TEXTO_ABIERTO">✍️ Texto Abierto</option>
                              <option value="OPCION_MULTIPLE">🔘 Opción Múltiple</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Barra de Acciones Izquierda */}
            <div className="p-4 bg-white border-t border-gray-200 flex justify-between items-center shrink-0">
              <span className="text-xs text-gray-500 font-medium">
                {encuesta.preguntas.length} pregunta(s) diseñadas
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleGuardar}
                  disabled={saving}
                  style={{ backgroundColor: '#059669', color: '#ffffff' }}
                  className="px-4 py-2 text-xs font-bold hover:bg-emerald-700 rounded-lg shadow transition flex items-center gap-1.5 cursor-pointer border border-emerald-600"
                >
                  {saving ? '💾 Guardando...' : '💾 Guardar y Publicar'}
                </button>
              </div>
            </div>
          </div>

          {/* Panel Derecho: Lienzo WYSIWYG en Vivo (Vista Participante) */}
          <div className="w-full lg:w-7/12 p-4 sm:p-6 bg-slate-100 flex flex-col items-center justify-start overflow-y-auto">
            {/* Conmutador de Dispositivo */}
            <div className="w-full max-w-xl flex justify-between items-center mb-4">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                👁️ Vista Previa WYSIWYG del Participante
              </span>
              <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-gray-200 text-xs shadow-2xs">
                <button
                  type="button"
                  onClick={() => setPreviewDevice('desktop')}
                  className={`px-3 py-1 rounded font-semibold transition cursor-pointer ${
                    previewDevice === 'desktop' ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  💻 Escritorio
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice('mobile')}
                  className={`px-3 py-1 rounded font-semibold transition cursor-pointer ${
                    previewDevice === 'mobile' ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  📱 Móvil
                </button>
              </div>
            </div>

            {/* Contenedor del Cuestionario Interactivo */}
            <div
              className={`bg-white shadow-xl rounded-2xl p-6 sm:p-8 transition-all duration-300 w-full border border-gray-200 ${
                previewDevice === 'mobile' ? 'max-w-sm rounded-3xl border-4 border-gray-800 my-2' : 'max-w-xl'
              }`}
            >
              {/* Membrete del Cuestionario */}
              <div className="text-center pb-4 border-b border-gray-200 space-y-1">
                <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase tracking-wider rounded-full inline-block">
                  {encuesta.es_obligatoria ? '🔒 Evaluación Obligatoria' : '📋 Encuesta Opcional'}
                </span>
                <h2 className="text-base sm:text-lg font-black text-gray-900 leading-snug">
                  {encuesta.titulo || 'Título de la Encuesta'}
                </h2>
                <p className="text-xs text-gray-500 leading-relaxed max-w-md mx-auto">
                  {encuesta.descripcion || 'Sin descripción ingresada.'}
                </p>
              </div>

              {/* Listado Interactivo de Preguntas */}
              <div className="py-4 space-y-5">
                {encuesta.preguntas.map((p, i) => (
                  <div key={i} className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200 space-y-2.5">
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <p className="text-xs font-bold text-gray-800 leading-snug">
                        {p.texto_pregunta}
                        {p.es_obligatoria && <span className="text-red-500 ml-1">*</span>}
                      </p>
                    </div>

                    {/* Render según tipo de pregunta */}
                    {p.tipo_pregunta === 'CALIFICACION_1_A_5' && (
                      <div className="flex items-center justify-center gap-2 pt-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            className="text-2xl text-amber-400 hover:scale-125 transition-transform cursor-pointer"
                            title={`Calificar ${star} de 5`}
                          >
                            ★
                          </button>
                        ))}
                      </div>
                    )}

                    {p.tipo_pregunta === 'TEXTO_ABIERTO' && (
                      <textarea
                        rows={2}
                        disabled
                        placeholder="El participante podrá redactar su testimonio o sugerencia aquí..."
                        className="w-full text-xs p-2 border border-gray-200 rounded-lg bg-white text-gray-400 resize-none italic"
                      />
                    )}

                    {p.tipo_pregunta === 'OPCION_MULTIPLE' && (
                      <div className="space-y-1.5 pt-1">
                        {['Totalmente de Acuerdo', 'De Acuerdo', 'Neutral / Regular', 'En Desacuerdo'].map(
                          (opc, optIdx) => (
                            <label
                              key={optIdx}
                              className="flex items-center gap-2 p-2 rounded-lg bg-white border border-gray-200 text-xs text-gray-700 cursor-pointer hover:bg-emerald-50/50"
                            >
                              <input type="radio" name={`demo_q_${i}`} className="text-emerald-600" />
                              <span>{opc}</span>
                            </label>
                          )
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Botón Simulado de Envío */}
              <div className="pt-2 border-t border-gray-100">
                <button
                  type="button"
                  disabled
                  className="w-full py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold tracking-wide uppercase opacity-80 cursor-not-allowed"
                >
                  Enviar Respuestas y Habilitar Certificado →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
