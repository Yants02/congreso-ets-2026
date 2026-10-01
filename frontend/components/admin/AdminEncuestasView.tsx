'use client';

import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import AdminEncuestaEditorModal from './AdminEncuestaEditorModal';

interface PreguntaMetrica {
  id: number;
  orden: number;
  texto_pregunta: string;
  tipo_pregunta: string;
  promedio: string | number;
  total_votos: number;
  estrellas_5: number;
  estrellas_4: number;
  estrellas_3: number;
  estrellas_2: number;
  estrellas_1: number;
}

interface Comentario {
  id: number;
  respuesta_texto: string;
  creado_en: string;
  rol_nombre: string;
}

interface ResumenEncuesta {
  total_encuestas: number;
  promedio_general: string | number;
}

interface PreguntaCRUD {
  id: number;
  encuesta_id: number;
  orden: number;
  texto_pregunta: string;
  tipo_pregunta: string;
  es_obligatoria: boolean;
  peso_ponderacion: number;
  activo: boolean;
}

interface EncuestaCRUD {
  id: number;
  titulo: string;
  descripcion: string;
  etapa: string;
  es_obligatoria: boolean;
  activa: boolean;
  total_preguntas: number;
  total_respuestas: number;
  preguntas: PreguntaCRUD[];
}

export default function AdminEncuestasView() {
  const [subTab, setSubTab] = useState<'metricas' | 'crud'>('metricas');
  const [loading, setLoading] = useState(true);

  // Métricas
  const [resumen, setResumen] = useState<ResumenEncuesta>({ total_encuestas: 0, promedio_general: 0 });
  const [preguntas, setPreguntas] = useState<PreguntaMetrica[]>([]);
  const [comentarios, setComentarios] = useState<Comentario[]>([]);

  // CRUD & WYSIWYG
  const [encuestas, setEncuestas] = useState<EncuestaCRUD[]>([]);
  const [isModalEncuestaOpen, setIsModalEncuestaOpen] = useState(false);
  const [isModalPreguntaOpen, setIsModalPreguntaOpen] = useState(false);
  const [isWysiwygOpen, setIsWysiwygOpen] = useState(false);
  const [encuestaAEditar, setEncuestaAEditar] = useState<any | null>(null);
  const [selectedEncuestaId, setSelectedEncuestaId] = useState<number | null>(null);

  const [formDataEncuesta, setFormDataEncuesta] = useState({
    titulo: '',
    descripcion: '',
    etapa: 'POST_EVENTO',
    es_obligatoria: true,
    activa: true,
  });

  const [formDataPregunta, setFormDataPregunta] = useState({
    texto_pregunta: '',
    tipo_pregunta: 'CALIFICACION_1_A_5',
    es_obligatoria: true,
    orden: 1,
    peso_ponderacion: 1.0,
  });

  async function loadMetricas() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/encuestas/metricas');
      if (res.ok) {
        const data = await res.json();
        setResumen(data.resumen || { total_encuestas: 0, promedio_general: 0 });
        setPreguntas(data.preguntas || []);
        setComentarios(data.comentarios || []);
      }
    } catch (err) {
      console.error('Error cargando métricas de encuestas:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadEncuestasCRUD() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/encuestas');
      if (res.ok) {
        const data = await res.json();
        setEncuestas(data.encuestas || []);
      }
    } catch (err) {
      console.error('Error cargando listado de encuestas:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (subTab === 'metricas') {
      loadMetricas();
    } else {
      loadEncuestasCRUD();
    }
  }, [subTab]);

  async function handleToggleActiva(encuesta: EncuestaCRUD) {
    try {
      const res = await fetch(`/api/admin/encuestas/${encuesta.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activa: !encuesta.activa }),
      });
      if (res.ok) {
        loadEncuestasCRUD();
      }
    } catch {
      await Swal.fire({
        title: 'Error',
        text: 'Error al cambiar estado.',
        icon: 'error',
        confirmButtonColor: '#dc3545',
      });
    }
  }

  async function handleToggleObligatoria(encuesta: EncuestaCRUD) {
    try {
      const res = await fetch(`/api/admin/encuestas/${encuesta.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ es_obligatoria: !encuesta.es_obligatoria }),
      });
      if (res.ok) {
        loadEncuestasCRUD();
      }
    } catch {
      await Swal.fire({
        title: 'Error',
        text: 'Error al cambiar obligatoriedad.',
        icon: 'error',
        confirmButtonColor: '#dc3545',
      });
    }
  }

  async function handleDeleteEncuesta(id: number, titulo: string) {
    const confirmRes = await Swal.fire({
      title: '¿Eliminar encuesta?',
      text: `¿Seguro que deseas eliminar la encuesta "${titulo}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
    });
    if (!confirmRes.isConfirmed) return;

    try {
      const res = await fetch(`/api/admin/encuestas/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        await Swal.fire({
          title: 'Encuesta Eliminada',
          text: data.mensaje || 'Encuesta eliminada correctamente.',
          icon: 'success',
          confirmButtonColor: '#005691',
        });
        loadEncuestasCRUD();
      }
    } catch {
      await Swal.fire({
        title: 'Error de Conexión',
        text: 'Error de conexión con el servidor.',
        icon: 'error',
        confirmButtonColor: '#dc3545',
      });
    }
  }

  async function handleCreateEncuesta(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/encuestas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formDataEncuesta),
      });
      if (res.ok) {
        setIsModalEncuestaOpen(false);
        setFormDataEncuesta({ titulo: '', descripcion: '', etapa: 'POST_EVENTO', es_obligatoria: true, activa: true });
        loadEncuestasCRUD();
      }
    } catch {
      await Swal.fire({
        title: 'Error',
        text: 'Error al crear la encuesta.',
        icon: 'error',
        confirmButtonColor: '#dc3545',
      });
    }
  }

  async function handleAddPregunta(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEncuestaId) return;
    try {
      const res = await fetch(`/api/admin/encuestas/${selectedEncuestaId}/preguntas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formDataPregunta),
      });
      if (res.ok) {
        setIsModalPreguntaOpen(false);
        setFormDataPregunta({ texto_pregunta: '', tipo_pregunta: 'CALIFICACION_1_A_5', es_obligatoria: true, orden: 1, peso_ponderacion: 1.0 });
        loadEncuestasCRUD();
      }
    } catch {
      await Swal.fire({
        title: 'Error',
        text: 'Error al agregar pregunta.',
        icon: 'error',
        confirmButtonColor: '#dc3545',
      });
    }
  }

  async function handleDeletePregunta(preguntaId: number) {
    const confirmRes = await Swal.fire({
      title: '¿Eliminar pregunta?',
      text: '¿Seguro que deseas eliminar esta pregunta de la encuesta?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
    });
    if (!confirmRes.isConfirmed) return;

    try {
      const res = await fetch(`/api/admin/encuestas/preguntas/${preguntaId}`, { method: 'DELETE' });
      if (res.ok) {
        loadEncuestasCRUD();
      }
    } catch {
      await Swal.fire({
        title: 'Error',
        text: 'Error al eliminar la pregunta.',
        icon: 'error',
        confirmButtonColor: '#dc3545',
      });
    }
  }

  return (
    <div className="space-y-6">
      {/* Selector de Sub-pestañas: Métricas vs CRUD */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex gap-2">
          <button
            onClick={() => setSubTab('metricas')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition ${
              subTab === 'metricas'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            📊 Métricas y Satisfacción
          </button>
          <button
            onClick={() => setSubTab('crud')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition ${
              subTab === 'crud'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            ⚙️ Gestión de Encuestas y Preguntas (CRUD)
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setEncuestaAEditar(null);
              setIsWysiwygOpen(true);
            }}
            style={{ backgroundColor: '#059669', color: '#ffffff' }}
            className="px-4 py-2 hover:bg-emerald-700 font-semibold rounded-lg text-sm transition flex items-center gap-1.5 shadow-sm cursor-pointer border border-emerald-600"
            title="Abre el Diseñador Visual WYSIWYG interactivo con previsualización en tiempo real"
          >
            <span style={{ color: '#ffffff' }}>🎨 Diseñador de Encuestas (WYSIWYG)</span>
          </button>
          {subTab === 'crud' && (
            <button
              onClick={() => setIsModalEncuestaOpen(true)}
              style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
              className="px-4 py-2 hover:bg-blue-700 font-semibold rounded-lg text-sm shadow-sm flex items-center gap-1.5 cursor-pointer border border-blue-600"
            >
              <span style={{ color: '#ffffff' }}>➕ Encuesta Rápida</span>
            </button>
          )}
        </div>
      </div>

      {/* VISTA 1: MÉTRICAS Y RESULTADOS */}
      {subTab === 'metricas' && (
        <div className="space-y-6">
          {/* Tarjetas Superiores */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
              <span className="text-xs font-bold text-gray-400 uppercase">Respuestas Recibidas</span>
              <p className="text-3xl font-extrabold text-blue-700 mt-2">{resumen.total_encuestas}</p>
              <span className="text-xs text-gray-500">Participantes que completaron la evaluación</span>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm border-l-4 border-l-amber-500">
              <span className="text-xs font-bold text-amber-600 uppercase">Calificación Promedio General</span>
              <div className="flex items-baseline gap-2 mt-2">
                <p className="text-3xl font-extrabold text-gray-900">{resumen.promedio_general || '0.00'}</p>
                <span className="text-sm font-bold text-amber-500">/ 5.00 ⭐</span>
              </div>
              <span className="text-xs text-gray-500">Índice global de satisfacción institucional</span>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm border-l-4 border-l-green-500">
              <span className="text-xs font-bold text-green-600 uppercase">Estado del Bloqueo Pedagógico</span>
              <p className="text-base font-bold text-green-800 mt-2">Activo y Enlazado a Diplomas</p>
              <span className="text-xs text-gray-500">Desbloquea automáticamente la descarga PDF</span>
            </div>
          </div>

          {/* Desglose Cuantitativo por Dimensión con Gráficos Circulares Tipo Pizza */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <span>🍕</span>
                  <span>Desglose por Dimensión de Calidad</span>
                </h3>
                <p className="text-xs text-gray-500">Distribución porcentual de calificaciones por estrellas en gráficos circulares (tipo pizza)</p>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                <span>Total Dimensiones:</span>
                <span className="font-bold text-blue-700">{preguntas.length}</span>
              </div>
            </div>

            {/* Referencia Global: Código de Colores Estándar por Calificación */}
            <div className="border-b border-gray-100 pb-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <span>🎨</span>
                  <span>Código de Colores Estándar por Calificación</span>
                </span>
                <span className="text-[11px] text-slate-500">Escala Likert 1 a 5 Estrellas</span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-[#15803d] shrink-0 shadow-sm ring-2 ring-emerald-600/20"></span>
                  <div className="text-xs leading-tight">
                    <span className="font-bold text-gray-900 block">5★ Verde Oscuro</span>
                    <span className="text-[10px] text-gray-500 font-mono">#15803d</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-[#4ade80] shrink-0 shadow-sm ring-2 ring-green-500/20"></span>
                  <div className="text-xs leading-tight">
                    <span className="font-bold text-gray-900 block">4★ Verde Claro</span>
                    <span className="text-[10px] text-gray-500 font-mono">#4ade80</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-[#eab308] shrink-0 shadow-sm ring-2 ring-yellow-500/20"></span>
                  <div className="text-xs leading-tight">
                    <span className="font-bold text-gray-900 block">3★ Amarillo</span>
                    <span className="text-[10px] text-gray-500 font-mono">#eab308</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-[#f97316] shrink-0 shadow-sm ring-2 ring-orange-500/20"></span>
                  <div className="text-xs leading-tight">
                    <span className="font-bold text-gray-900 block">2★ Naranja</span>
                    <span className="text-[10px] text-gray-500 font-mono">#f97316</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-[#ef4444] shrink-0 shadow-sm ring-2 ring-rose-500/20"></span>
                  <div className="text-xs leading-tight">
                    <span className="font-bold text-gray-900 block">1★ Rojo</span>
                    <span className="text-[10px] text-gray-500 font-mono">#ef4444</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {preguntas.map((p) => {
                const total = p.total_votos || 0;
                const slices = [
                  { label: '5 Estrellas (Verde Oscuro)', stars: '5★', count: p.estrellas_5 || 0, color: '#15803d' },
                  { label: '4 Estrellas (Verde Claro)', stars: '4★', count: p.estrellas_4 || 0, color: '#4ade80' },
                  { label: '3 Estrellas (Amarillo)', stars: '3★', count: p.estrellas_3 || 0, color: '#eab308' },
                  { label: '2 Estrellas (Naranja)', stars: '2★', count: p.estrellas_2 || 0, color: '#f97316' },
                  { label: '1 Estrella (Rojo)', stars: '1★', count: p.estrellas_1 || 0, color: '#ef4444' },
                ];

                // Generador de caminos SVG para los sectores de la pizza (pie chart)
                let cumulativeAngle = -90; // Empezar en las 12 en punto
                const cx = 80;
                const cy = 80;
                const r = 70;

                const paths = slices.map((slice) => {
                  if (total === 0 || slice.count === 0) return null;
                  const pct = slice.count / total;
                  const angle = pct * 360;

                  // Si una sola porción representa el 100% de los votos
                  if (slice.count === total) {
                    return (
                      <circle
                        key={slice.stars}
                        cx={cx}
                        cy={cy}
                        r={r}
                        fill={slice.color}
                        stroke="#ffffff"
                        strokeWidth="2"
                      >
                        <title>{`${slice.label}: ${slice.count} (${(pct * 100).toFixed(1)}%)`}</title>
                      </circle>
                    );
                  }

                  const startRad = (cumulativeAngle * Math.PI) / 180;
                  const endRad = ((cumulativeAngle + angle) * Math.PI) / 180;

                  const x1 = cx + r * Math.cos(startRad);
                  const y1 = cy + r * Math.sin(startRad);
                  const x2 = cx + r * Math.cos(endRad);
                  const y2 = cy + r * Math.sin(endRad);

                  const largeArc = angle > 180 ? 1 : 0;
                  const pathData = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;

                  cumulativeAngle += angle;

                  return (
                    <path
                      key={slice.stars}
                      d={pathData}
                      fill={slice.color}
                      stroke="#ffffff"
                      strokeWidth="2"
                      className="transition-all duration-300 hover:opacity-90 hover:scale-105 origin-center cursor-pointer"
                    >
                      <title>{`${slice.label}: ${slice.count} (${(pct * 100).toFixed(1)}%)`}</title>
                    </path>
                  );
                });

                return (
                  <div
                    key={p.id}
                    className="p-5 bg-white border border-gray-200 rounded-2xl flex flex-col justify-between hover:shadow-md transition-all duration-200"
                  >
                    {/* Encabezado de la Dimensión */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="space-y-1">
                        <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                          Dimensión {p.orden}
                        </span>
                        <h4 className="font-bold text-gray-900 text-sm leading-snug">
                          {p.texto_pregunta}
                        </h4>
                      </div>
                      <span className="px-3 py-1 bg-amber-50 text-amber-900 font-extrabold text-xs rounded-full border border-amber-200 whitespace-nowrap shadow-2xs">
                        ⭐ {p.promedio || '0.00'} / 5.00
                      </span>
                    </div>

                    {/* Gráfico Circular Tipo Pizza y Referencias */}
                    {total > 0 ? (
                      <div className="flex flex-col sm:flex-row items-center gap-5 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                        {/* Pizza SVG */}
                        <div className="relative w-40 h-40 shrink-0 flex items-center justify-center">
                          <svg viewBox="0 0 160 160" className="w-full h-full drop-shadow-xs">
                            {paths}
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-xs font-black text-gray-800">{total}</span>
                            <span className="text-[9px] uppercase font-bold text-gray-400">votos</span>
                          </div>
                        </div>

                        {/* Leyenda y Desglose de Porciones */}
                        <div className="flex-1 w-full space-y-2">
                          {slices.map((slice) => {
                            const pct = total > 0 ? ((slice.count / total) * 100).toFixed(1) : '0.0';
                            return (
                              <div
                                key={slice.stars}
                                className="flex items-center justify-between text-xs py-1 transition"
                              >
                                <div className="flex items-center gap-2.5">
                                  <span
                                    className="w-4 h-4 rounded-full shrink-0 shadow-xs"
                                    style={{ backgroundColor: slice.color }}
                                  />
                                  <span className="font-bold text-gray-800 text-xs">{slice.stars}</span>
                                  <span className="text-[11px] text-gray-500 hidden sm:inline">
                                    {slice.label.split('(')[1]?.replace(')', '') || slice.label}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 font-mono">
                                  <span className="font-bold text-gray-700">{slice.count}</span>
                                  <span className="text-[11px] text-gray-400 w-12 text-right">({pct}%)</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-slate-50/40 p-6 rounded-xl border border-dashed border-gray-200 text-center text-xs text-gray-400">
                        Sin respuestas registradas para esta dimensión aún.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Comentarios y Sugerencias Abiertas */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <span>💡</span>
                  <span>Sugerencias y Temáticas para la Próxima Edición</span>
                </h3>
                <p className="text-xs text-gray-500">
                  Feedback cualitativo recolectado a través de las preguntas abiertas de la Encuesta Institucional Post-Evento para la planificación académica de la próxima edición.
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg whitespace-nowrap">
                {comentarios.length} aportes registrados
              </span>
            </div>
            {comentarios.length === 0 ? (
              <p className="text-sm text-gray-400">Aún no se han registrado sugerencias abiertas.</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {comentarios.map((c) => (
                  <div key={c.id} className="p-3.5 bg-slate-50/60 border border-slate-200/80 rounded-xl text-sm hover:bg-white hover:border-slate-300 transition-colors">
                    <p className="text-gray-800 italic">&ldquo;{c.respuesta_texto}&rdquo;</p>
                    <div className="flex justify-between items-center text-xs text-gray-400 mt-2">
                      <span className="font-semibold text-gray-600">{c.rol_nombre || 'Asistente'}</span>
                      <span>{new Date(c.creado_en).toLocaleString('es-AR')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* VISTA 2: CRUD DE ENCUESTAS Y PREGUNTAS */}
      {subTab === 'crud' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="min-w-full text-left text-sm text-gray-700">
              <thead className="bg-gray-50 text-xs uppercase font-bold text-gray-500 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Título y Descripción</th>
                  <th className="px-4 py-3">Etapa</th>
                  <th className="px-4 py-3 text-center">Obligatoria</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 py-3 text-center">Preguntas</th>
                  <th className="px-4 py-3 text-center">Respuestas</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                      Cargando encuestas institucionales...
                    </td>
                  </tr>
                ) : encuestas.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                      No hay encuestas configuradas.
                    </td>
                  </tr>
                ) : (
                  encuestas.map((enc) => (
                    <React.Fragment key={enc.id}>
                      <tr className="hover:bg-gray-50 transition">
                        <td className="px-4 py-3 font-mono font-bold text-blue-700">#{enc.id}</td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-gray-900">{enc.titulo}</div>
                          <div className="text-xs text-gray-500 line-clamp-1">{enc.descripcion}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 bg-purple-50 text-purple-700 font-semibold text-xs rounded">
                          {enc.etapa}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleToggleObligatoria(enc)}
                          className={`px-2 py-0.5 text-xs font-bold rounded ${
                            enc.es_obligatoria ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {enc.es_obligatoria ? 'SÍ (Bloquea)' : 'Opcional'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleToggleActiva(enc)}
                          className={`px-2 py-0.5 text-xs font-bold rounded ${
                            enc.activa ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {enc.activa ? 'Activa' : 'Inactiva'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-gray-800">
                        {enc.total_preguntas || enc.preguntas?.length || 0}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-xs text-blue-700 font-bold">
                        {enc.total_respuestas || 0}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => {
                              setEncuestaAEditar(enc);
                              setIsWysiwygOpen(true);
                            }}
                            className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded text-xs font-semibold cursor-pointer"
                            title="Editar en Diseñador Visual WYSIWYG"
                          >
                            🎨 Diseñar
                          </button>
                          <button
                            onClick={() => {
                              setSelectedEncuestaId(enc.id);
                              setIsModalPreguntaOpen(true);
                            }}
                            className="px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-xs font-semibold cursor-pointer"
                            title="Agregar pregunta a esta encuesta"
                          >
                            ➕ Pregunta
                          </button>
                          <button
                            onClick={() => handleDeleteEncuesta(enc.id, enc.titulo)}
                            className="px-2 py-1 bg-red-50 text-red-700 hover:bg-red-100 rounded text-xs font-semibold cursor-pointer"
                            title="Eliminar o desactivar"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Desglose de Preguntas de la Encuesta */}
                    {enc.preguntas && enc.preguntas.length > 0 && (
                      <tr className="bg-slate-50/60">
                        <td colSpan={8} className="px-6 py-3">
                          <div className="space-y-2">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                              Preguntas Configuradas:
                            </span>
                            <div className="grid grid-cols-1 gap-1.5">
                              {enc.preguntas.map((preg) => (
                                <div
                                  key={preg.id}
                                  className="flex justify-between items-center p-2 bg-white rounded-lg border border-gray-200 text-xs"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-blue-700 font-mono">#{preg.orden}</span>
                                    <span className="font-medium text-gray-800">{preg.texto_pregunta}</span>
                                    <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px]">
                                      {preg.tipo_pregunta}
                                    </span>
                                  </div>
                                  <button
                                    onClick={() => handleDeletePregunta(preg.id)}
                                    className="text-red-500 hover:text-red-700 font-bold px-2 py-0.5"
                                    title="Quitar pregunta"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL CREAR ENCUESTA */}
      {isModalEncuestaOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-gray-900">➕ Crear Nueva Encuesta Institucional</h3>
            <form onSubmit={handleCreateEncuesta} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-600">Título de la Encuesta</label>
                <input
                  type="text"
                  required
                  value={formDataEncuesta.titulo}
                  onChange={(e) => setFormDataEncuesta({ ...formDataEncuesta, titulo: e.target.value })}
                  placeholder="Ej: Encuesta de Evaluación Pedagógica 2026"
                  className="w-full mt-1 p-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600">Descripción / Propósito</label>
                <textarea
                  rows={2}
                  value={formDataEncuesta.descripcion}
                  onChange={(e) => setFormDataEncuesta({ ...formDataEncuesta, descripcion: e.target.value })}
                  placeholder="Indicaciones para el participante..."
                  className="w-full mt-1 p-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-600">Etapa</label>
                  <select
                    value={formDataEncuesta.etapa}
                    onChange={(e) => setFormDataEncuesta({ ...formDataEncuesta, etapa: e.target.value })}
                    className="w-full mt-1 p-2 text-sm border border-gray-300 rounded-lg outline-none"
                  >
                    <option value="POST_EVENTO">POST_EVENTO</option>
                    <option value="ACREDITACION">ACREDITACION</option>
                    <option value="CIERRE_JORNADA">CIERRE_JORNADA</option>
                  </select>
                </div>

                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-700">
                    <input
                      type="checkbox"
                      checked={formDataEncuesta.es_obligatoria}
                      onChange={(e) => setFormDataEncuesta({ ...formDataEncuesta, es_obligatoria: e.target.checked })}
                    />
                    <span>Es Obligatoria</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalEncuestaOpen(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg"
                >
                  Guardar Encuesta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL AGREGAR PREGUNTA */}
      {isModalPreguntaOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-gray-900">➕ Agregar Pregunta a Encuesta #{selectedEncuestaId}</h3>
            <form onSubmit={handleAddPregunta} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-600">Texto de la Pregunta</label>
                <input
                  type="text"
                  required
                  value={formDataPregunta.texto_pregunta}
                  onChange={(e) => setFormDataPregunta({ ...formDataPregunta, texto_pregunta: e.target.value })}
                  placeholder="Ej: ¿Cómo califica la puntualidad de las ponencias?"
                  className="w-full mt-1 p-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-600">Tipo de Pregunta</label>
                  <select
                    value={formDataPregunta.tipo_pregunta}
                    onChange={(e) => setFormDataPregunta({ ...formDataPregunta, tipo_pregunta: e.target.value })}
                    className="w-full mt-1 p-2 text-sm border border-gray-300 rounded-lg outline-none"
                  >
                    <option value="CALIFICACION_1_A_5">Estrellas (1 a 5)</option>
                    <option value="TEXTO_ABIERTO">Texto Abierto</option>
                    <option value="OPCION_MULTIPLE">Opción Múltiple</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-600">Orden de Visualización</label>
                  <input
                    type="number"
                    min={1}
                    value={formDataPregunta.orden}
                    onChange={(e) => setFormDataPregunta({ ...formDataPregunta, orden: parseInt(e.target.value, 10) || 1 })}
                    className="w-full mt-1 p-2 text-sm border border-gray-300 rounded-lg outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalPreguntaOpen(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg"
                >
                  Agregar Pregunta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editor Visual WYSIWYG de Encuestas */}
      <AdminEncuestaEditorModal
        isOpen={isWysiwygOpen}
        encuestaInicial={encuestaAEditar}
        onClose={() => {
          setIsWysiwygOpen(false);
          setEncuestaAEditar(null);
        }}
        onSaved={() => {
          loadEncuestasCRUD();
          loadMetricas();
        }}
      />
    </div>
  );
}
