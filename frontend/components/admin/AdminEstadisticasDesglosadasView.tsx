'use client';

import React, { useState, useEffect } from 'react';
import { EstadisticasDesglosadasData } from './types';

type EjeKey = 'eventos' | 'recintos' | 'horarios' | 'presentadores' | 'asistentes';

export default function AdminEstadisticasDesglosadasView() {
  const [stats, setStats] = useState<EstadisticasDesglosadasData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeEje, setActiveEje] = useState<EjeKey>('eventos');

  async function loadStats() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/estadisticas/desglosadas');
      if (res.ok) {
        const data = await res.json();
        setStats(data.estadisticas);
      }
    } catch (err) {
      console.error('Error cargando estadísticas desglosadas:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStats();
  }, []);

  const ejes = [
    { key: 'eventos', label: '1. Eventos & Edición', icon: '🏛️', desc: 'Aforo global, ocupación y estados de inscriptos' },
    { key: 'recintos', label: '2. Recintos & Salas', icon: '🏢', desc: 'Horas reservadas, saturación y aforo por aula' },
    { key: 'horarios', label: '3. Horarios & Agenda', icon: '⏱️', desc: 'Distribución por turnos, picos y duración' },
    { key: 'presentadores', label: '4. Presentadores', icon: '🎤', desc: 'Carga de disertantes y aforo convocado' },
    { key: 'asistentes', label: '5. Alumnos & Asistentes', icon: '🎓', desc: 'Perfiles, asistencias reales en sala y certificados' },
  ];

  if (loading) {
    return (
      <div className="bg-white p-8 rounded-xl border border-gray-200 text-center space-y-3">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-gray-500 font-semibold text-xs">Cargando métricas analíticas de los 5 ejes...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="bg-white p-8 rounded-xl border border-gray-200 text-center">
        <p className="text-red-500 text-sm font-semibold">No se pudieron recuperar las estadísticas del servidor.</p>
        <button onClick={loadStats} className="mt-3 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-xs font-bold rounded-lg">
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Selector de los 5 Ejes */}
      <div className="bg-white p-2 rounded-2xl border border-gray-200 shadow-xs flex flex-wrap gap-1">
        {ejes.map((eje) => (
          <button
            key={eje.key}
            onClick={() => setActiveEje(eje.key as EjeKey)}
            className={`flex-1 min-w-[140px] px-3 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
              activeEje === eje.key
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <span>{eje.icon}</span>
            <span>{eje.label}</span>
          </button>
        ))}
      </div>

      {/* 1. EJE EVENTOS */}
      {activeEje === 'eventos' && stats.eventos && (
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-gray-100 pb-4 mb-4">
              <div>
                <h3 className="text-lg font-extrabold text-gray-900">{stats.eventos.nombre} ({stats.eventos.anio})</h3>
                <p className="text-xs text-gray-500">
                  📍 Sede: {stats.eventos.lugar_nombre || 'Sede Central'} · Código: {stats.eventos.codigo} · Estado: {stats.eventos.estado}
                </p>
              </div>
              <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-extrabold text-xs">
                {stats.eventos.porcentaje_ocupacion}% Ocupación
              </span>
            </div>

            {/* Barra de progreso de cupo */}
            <div className="space-y-1 mb-6">
              <div className="flex justify-between text-xs font-bold text-gray-600">
                <span>Inscriptos Confirmados ({stats.eventos.confirmados})</span>
                <span>Cupo Máximo ({stats.eventos.cupo_maximo})</span>
              </div>
              <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, stats.eventos.porcentaje_ocupacion)}%` }}
                ></div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="bg-slate-50 p-3 rounded-xl border border-gray-200 text-center">
                <div className="text-xl font-extrabold text-emerald-600">{stats.eventos.confirmados}</div>
                <div className="text-[11px] font-semibold text-gray-500">Confirmados</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-gray-200 text-center">
                <div className="text-xl font-extrabold text-amber-600">{stats.eventos.lista_espera}</div>
                <div className="text-[11px] font-semibold text-gray-500">Lista de Espera</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-gray-200 text-center">
                <div className="text-xl font-extrabold text-rose-600">{stats.eventos.sancionados || 0}</div>
                <div className="text-[11px] font-semibold text-gray-500">Sancionados</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-gray-200 text-center">
                <div className="text-xl font-extrabold text-red-600">{stats.eventos.cancelados}</div>
                <div className="text-[11px] font-semibold text-gray-500">Bajas / Cancelados</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-gray-200 text-center">
                <div className="text-xl font-extrabold text-blue-600">
                  {Math.max(0, stats.eventos.cupo_maximo - stats.eventos.confirmados)}
                </div>
                <div className="text-[11px] font-semibold text-gray-500">Vacantes Libres</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. EJE RECINTOS */}
      {activeEje === 'recintos' && (
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs">
            <h3 className="text-base font-extrabold text-gray-900 mb-1">Utilización y Saturación por Recinto / Sala</h3>
            <p className="text-xs text-gray-500 mb-4">
              Balance de carga física por espacio para evitar cuellos de botella y supervisar aforos.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-600">
                <thead className="bg-gray-50 font-bold text-gray-700 uppercase border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3">Recinto / Espacio</th>
                    <th className="px-4 py-3">Ubicación</th>
                    <th className="px-4 py-3 text-center">Capacidad Máx.</th>
                    <th className="px-4 py-3 text-center">Actividades</th>
                    <th className="px-4 py-3 text-center">Horas Reservadas</th>
                    <th className="px-4 py-3 text-center">Aforo Ofertado</th>
                    <th className="px-4 py-3 text-center">Scans en Vivo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {stats.recintos.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-bold text-gray-900 flex items-center gap-2">
                        <span>🏢</span> {rec.nombre}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{rec.ubicacion_fisica}</td>
                      <td className="px-4 py-3 text-center font-bold text-gray-800">{rec.capacidad_maxima}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 font-bold rounded">
                          {rec.total_actividades}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-semibold text-purple-700">
                        {rec.horas_ocupadas} hs
                      </td>
                      <td className="px-4 py-3 text-center font-semibold text-gray-700">
                        {rec.cupo_total_ofrecido} pers.
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold rounded">
                          {rec.total_scans_acceso}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. EJE HORARIOS */}
      {activeEje === 'horarios' && stats.horarios && (
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs">
            <h3 className="text-base font-extrabold text-gray-900 mb-1">Distribución de Actividades por Franjas Horarias</h3>
            <p className="text-xs text-gray-500 mb-4">
              Monitoreo temporal para balancear la carga de la jornada y respetar políticas de no-solapamiento.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 text-center">
                <span className="text-2xl block mb-1">🌅</span>
                <div className="text-2xl font-extrabold text-blue-900">{stats.horarios.franja_manana}</div>
                <div className="text-xs font-bold text-blue-700 mt-1">Turno Mañana</div>
                <div className="text-[10px] text-gray-400">08:00 a 12:00 hs</div>
              </div>

              <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100 text-center">
                <span className="text-2xl block mb-1">☀️</span>
                <div className="text-2xl font-extrabold text-amber-900">{stats.horarios.franja_mediodia}</div>
                <div className="text-xs font-bold text-amber-700 mt-1">Turno Mediodía</div>
                <div className="text-[10px] text-gray-400">12:00 a 14:00 hs</div>
              </div>

              <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-100 text-center">
                <span className="text-2xl block mb-1">🌤️</span>
                <div className="text-2xl font-extrabold text-purple-900">{stats.horarios.franja_tarde}</div>
                <div className="text-xs font-bold text-purple-700 mt-1">Turno Tarde</div>
                <div className="text-[10px] text-gray-400">14:00 a 18:00 hs</div>
              </div>

              <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 text-center">
                <span className="text-2xl block mb-1">🌙</span>
                <div className="text-2xl font-extrabold text-indigo-900">{stats.horarios.franja_noche}</div>
                <div className="text-xs font-bold text-indigo-700 mt-1">Turno Noche</div>
                <div className="text-[10px] text-gray-400">18:00 a 22:00 hs</div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-gray-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-gray-700 block">Duración Media por Actividad / Ponencia</span>
                <span className="text-xs text-gray-500">Calculada sobre todas las actividades activas del congreso.</span>
              </div>
              <div className="text-xl font-extrabold text-gray-900">
                ⏱️ {stats.horarios.duracion_promedio_minutos} min
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. EJE PRESENTADORES */}
      {activeEje === 'presentadores' && stats.presentadores && (
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs">
            <h3 className="text-base font-extrabold text-gray-900 mb-1">Métricas del Cuerpo Académico & Disertantes</h3>
            <p className="text-xs text-gray-500 mb-4">
              Supervisión de expositores, homologaciones y cobertura de materias técnicas.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
                <div className="text-2xl font-extrabold text-purple-900">
                  {stats.presentadores.total_disertantes_en_agenda}
                </div>
                <div className="text-xs font-bold text-purple-700 mt-1">Disertantes con Charlas Programadas</div>
                <div className="text-[11px] text-gray-500 mt-0.5">En el cronograma oficial</div>
              </div>

              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                <div className="text-2xl font-extrabold text-blue-900">
                  {stats.presentadores.total_ponencias_programadas}
                </div>
                <div className="text-xs font-bold text-blue-700 mt-1">Total de Ponencias / Talleres</div>
                <div className="text-[11px] text-gray-500 mt-0.5">Sesiones confirmadas</div>
              </div>

              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                <div className="text-2xl font-extrabold text-emerald-900">
                  {stats.presentadores.promedio_aforo_por_charla}
                </div>
                <div className="text-xs font-bold text-emerald-700 mt-1">Promedio de Aforo por Ponencia</div>
                <div className="text-[11px] text-gray-500 mt-0.5">Capacidad promedio de las aulas</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. EJE ALUMNOS & ASISTENTES */}
      {activeEje === 'asistentes' && stats.asistentes && (
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs">
            <h3 className="text-base font-extrabold text-gray-900 mb-1">Métricas de Asistentes, Participación y Certificación</h3>
            <p className="text-xs text-gray-500 mb-4">
              Seguimiento del padrón de alumnos de carreras técnicas, asistencias efectivas en puerta y egreso.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-gray-200 text-center">
                <div className="text-2xl font-extrabold text-blue-600">{stats.asistentes.estudiantes}</div>
                <div className="text-xs font-bold text-gray-700 mt-1">Alumnos / Estudiantes</div>
                <div className="text-[10px] text-gray-400">Nivel Técnico Superior</div>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-gray-200 text-center">
                <div className="text-2xl font-extrabold text-purple-600">{stats.asistentes.docentes}</div>
                <div className="text-xs font-bold text-gray-700 mt-1">Docentes & Tutores</div>
                <div className="text-[10px] text-gray-400">Plantel Académico</div>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-gray-200 text-center">
                <div className="text-2xl font-extrabold text-emerald-600">{stats.asistentes.asistentes_acreditados_en_sala}</div>
                <div className="text-xs font-bold text-gray-700 mt-1">Presentes en Sede</div>
                <div className="text-[10px] text-gray-400">Acreditados por molinete</div>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-gray-200 text-center">
                <div className="text-2xl font-extrabold text-amber-600">{stats.asistentes.certificados_emitidos}</div>
                <div className="text-xs font-bold text-gray-700 mt-1">Certificados Oficiales</div>
                <div className="text-[10px] text-gray-400">Diplomas generados</div>
              </div>
            </div>

            <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-100 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-emerald-900 block">Evaluaciones de Calidad Respondidas</span>
                <span className="text-xs text-emerald-700">Encuestas completadas por participantes para desbloquear diplomas.</span>
              </div>
              <div className="text-xl font-extrabold text-emerald-900">
                📋 {stats.asistentes.encuestas_respondidas}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
