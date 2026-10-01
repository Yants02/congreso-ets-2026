'use client';

import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';

interface Props {
  onNotice: (msg: string) => void;
}

interface JournalLog {
  id: number;
  nivel: string;
  metodo: string;
  ruta: string;
  status_code: number;
  duracion_ms: number;
  ip_origen: string | null;
  usuario_email: string | null;
  request_headers: Record<string, string> | null;
  request_body: any;
  error_detalles: any;
  timestamp: string;
}

interface JournalStats {
  total_logs: number;
  total_critical: number;
  total_warn: number;
  total_info: number;
  avg_latency_ms: number;
  table_size: string;
}

export default function AdminJournalingView({ onNotice }: Props) {
  const [nivelActual, setNivelActual] = useState<'DISABLED' | 'ERRORS_ONLY' | 'VERBOSE_ALL'>('ERRORS_ONLY');
  const [stats, setStats] = useState<JournalStats | null>(null);
  const [logs, setLogs] = useState<JournalLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [isUpdatingLevel, setIsUpdatingLevel] = useState(false);
  const [isPurging, setIsPurging] = useState(false);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [nivelFiltro, setNivelFiltro] = useState('TODOS');
  const [page, setPage] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [totalRegistros, setTotalRegistros] = useState(0);

  // Detalle expandido
  const [selectedLog, setSelectedLog] = useState<JournalLog | null>(null);

  useEffect(() => {
    loadConfig();
    loadLogs();
  }, [page, nivelFiltro]);

  async function loadConfig() {
    try {
      const res = await fetch('/api/admin/journaling/config');
      const data = await res.json();
      if (res.ok && data.ok) {
        setNivelActual(data.nivel_actual);
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Error cargando configuración de journaling:', err);
    }
  }

  async function loadLogs() {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: String(page),
        limit: '25',
        q: searchTerm,
        nivel: nivelFiltro,
      });
      const res = await fetch(`/api/admin/journaling/logs?${queryParams.toString()}`);
      const data = await res.json();
      if (res.ok && data.ok) {
        setLogs(data.logs || []);
        setTotalPaginas(data.total_paginas || 1);
        setTotalRegistros(data.total_registros || 0);
      }
    } catch (err) {
      console.error('Error cargando bitácora de journaling:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleLevelChange(nuevoNivel: 'DISABLED' | 'ERRORS_ONLY' | 'VERBOSE_ALL') {
    setIsUpdatingLevel(true);
    try {
      const res = await fetch('/api/admin/journaling/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nivel: nuevoNivel }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setNivelActual(nuevoNivel);
        onNotice(`Nivel de Journaling configurado a: ${nuevoNivel}`);
        loadConfig();
      } else {
        await Swal.fire({
          icon: 'error',
          title: 'Error al cambiar nivel',
          text: data.message || 'No se pudo actualizar el modo de Journaling.',
        });
      }
    } catch (err) {
      await Swal.fire({
        icon: 'error',
        title: 'Error de Conexión',
        text: 'Error al comunicarse con el servidor.',
      });
    } finally {
      setIsUpdatingLevel(false);
    }
  }

  async function handlePurge() {
    const confirm = await Swal.fire({
      icon: 'warning',
      title: '¿Depurar bitácora de Journaling?',
      text: 'Se eliminarán registros de diagnóstico anteriores a 7 días para liberar espacio.',
      showCancelButton: true,
      confirmButtonText: 'Sí, depurar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc3545',
    });

    if (!confirm.isConfirmed) return;

    setIsPurging(true);
    try {
      const res = await fetch('/api/admin/journaling/purge?keep_days=7', {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        onNotice(data.mensaje || 'Bitácora depurada con éxito.');
        loadConfig();
        loadLogs();
      } else {
        await Swal.fire({
          icon: 'error',
          title: 'Error en depuración',
          text: data.message || 'No se pudo depurar la bitácora.',
        });
      }
    } catch (err) {
      await Swal.fire({
        icon: 'error',
        title: 'Error de Conexión',
        text: 'Error al comunicarse con el servidor.',
      });
    } finally {
      setIsPurging(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* TARJETA DE CONTROL Y ACTIVACIÓN DEL JOURNALING */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg text-lg">📝</span>
              <h3 className="text-base font-extrabold text-gray-900">
                Journaling & Diagnóstico de Errores en Vivo
              </h3>
            </div>
            <p className="text-xs text-gray-500 mt-1 max-w-2xl">
              Controla el nivel de registro forense de peticiones HTTP, tiempos de latencia, excepciones no controladas y parámetros de entrada para la resolución ágil de incidentes.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePurge}
              disabled={isPurging}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition cursor-pointer flex items-center gap-1.5"
            >
              <span>🗑️</span>
              <span>{isPurging ? 'Depurando...' : 'Depurar > 7 días'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                loadConfig();
                loadLogs();
              }}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 transition cursor-pointer flex items-center gap-1.5"
            >
              <span>🔄</span>
              <span>Actualizar</span>
            </button>
          </div>
        </div>

        {/* SELECTOR DE ESTADO DEL JOURNALING */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Opción 1: DESACTIVADO */}
          <div
            onClick={() => handleLevelChange('DISABLED')}
            className={`p-4 rounded-xl border-2 transition cursor-pointer flex flex-col justify-between ${
              nivelActual === 'DISABLED'
                ? 'border-gray-800 bg-gray-50 ring-2 ring-gray-400/20 shadow-xs'
                : 'border-gray-200 hover:border-gray-300 bg-white opacity-70'
            }`}
          >
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-gray-800">⭕ DESACTIVADO</span>
                {nivelActual === 'DISABLED' && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-gray-800 text-white">
                    Activo
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">
                Máximo rendimiento sin almacenamiento en disco de peticiones ni errores en tabla.
              </p>
            </div>
            <div className="mt-3 text-[11px] font-mono text-gray-400">DISABLED</div>
          </div>

          {/* Opción 2: SOLO ERRORES */}
          <div
            onClick={() => handleLevelChange('ERRORS_ONLY')}
            className={`p-4 rounded-xl border-2 transition cursor-pointer flex flex-col justify-between ${
              nivelActual === 'ERRORS_ONLY'
                ? 'border-amber-500 bg-amber-50/40 ring-2 ring-amber-400/20 shadow-xs'
                : 'border-gray-200 hover:border-amber-300 bg-white opacity-70'
            }`}
          >
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-amber-800">⚠️ SOLO ERRORES (Recomendado)</span>
                {nivelActual === 'ERRORS_ONLY' && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-600 text-white">
                    Activo
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-600">
                Registra únicamente peticiones HTTP con códigos de error (4xx y 5xx) para auditar fallos sin saturar la BD.
              </p>
            </div>
            <div className="mt-3 text-[11px] font-mono text-amber-700 font-bold">ERRORS_ONLY</div>
          </div>

          {/* Opción 3: MODO VERBOSO COMPLETO */}
          <div
            onClick={() => handleLevelChange('VERBOSE_ALL')}
            className={`p-4 rounded-xl border-2 transition cursor-pointer flex flex-col justify-between ${
              nivelActual === 'VERBOSE_ALL'
                ? 'border-blue-600 bg-blue-50/40 ring-2 ring-blue-400/20 shadow-xs'
                : 'border-gray-200 hover:border-blue-300 bg-white opacity-70'
            }`}
          >
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-blue-900">🔬 VERBOSO COMPLETO (Debug)</span>
                {nivelActual === 'VERBOSE_ALL' && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-600 text-white">
                    Activo
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-600">
                Registra el 100% del tráfico HTTP con cabeceras, parámetros, tiempos de respuesta y respuestas.
              </p>
            </div>
            <div className="mt-3 text-[11px] font-mono text-blue-700 font-bold">VERBOSE_ALL</div>
          </div>
        </div>

        {/* MÉTRICAS DEL JOURNALING */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Logs</span>
              <span className="text-lg font-black text-slate-900 font-mono">{stats.total_logs}</span>
            </div>
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-center">
              <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block">Críticos (5xx)</span>
              <span className="text-lg font-black text-rose-700 font-mono">{stats.total_critical}</span>
            </div>
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-center">
              <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">Advertencias (4xx)</span>
              <span className="text-lg font-black text-amber-700 font-mono">{stats.total_warn}</span>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Exitosos (2xx)</span>
              <span className="text-lg font-black text-emerald-700 font-mono">{stats.total_info}</span>
            </div>
            <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-center">
              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">Latencia Media</span>
              <span className="text-lg font-black text-indigo-700 font-mono">{stats.avg_latency_ms} ms</span>
            </div>
            <div className="p-3 rounded-xl bg-gray-100 border border-gray-300 text-center">
              <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider block">Espacio en BD</span>
              <span className="text-lg font-black text-gray-800 font-mono">{stats.table_size}</span>
            </div>
          </div>
        )}
      </div>

      {/* BUSCADOR Y LISTADO DE EVENTOS DE JOURNALING */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-gray-900">Bitácora de Eventos Registrados ({totalRegistros})</h4>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              placeholder="Buscar por ruta, IP, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setPage(1);
                  loadLogs();
                }
              }}
              className="p-1.5 text-xs border border-gray-300 rounded-lg w-56"
            />
            <button
              type="button"
              onClick={() => {
                setPage(1);
                loadLogs();
              }}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
            >
              Buscar
            </button>
            <select
              value={nivelFiltro}
              onChange={(e) => {
                setNivelFiltro(e.target.value);
                setPage(1);
              }}
              className="p-1.5 text-xs border border-gray-300 rounded-lg bg-white"
            >
              <option value="TODOS">Todos los Niveles</option>
              <option value="CRITICAL">Solo Críticos (CRITICAL)</option>
              <option value="WARN">Solo Advertencias (WARN)</option>
              <option value="INFO">Solo Informativos (INFO)</option>
            </select>
          </div>
        </div>

        {/* TABLA DE EVENTOS */}
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 uppercase text-[10px] tracking-wider font-extrabold">
              <tr>
                <th className="p-3">Nivel</th>
                <th className="p-3">Método / Ruta</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Duración</th>
                <th className="p-3">IP / Usuario</th>
                <th className="p-3">Fecha y Hora</th>
                <th className="p-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-400">
                    Cargando bitácora de Journaling...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-400">
                    No se encontraron registros de diagnóstico con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                logs.map((l) => (
                  <tr key={l.id} className="hover:bg-gray-50/80 transition">
                    <td className="p-3 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          l.nivel === 'CRITICAL'
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : l.nivel === 'WARN'
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        }`}
                      >
                        {l.nivel}
                      </span>
                    </td>
                    <td className="p-3 font-mono">
                      <span className="font-bold text-gray-800 mr-1.5">{l.metodo}</span>
                      <span className="text-gray-600">{l.ruta}</span>
                    </td>
                    <td className="p-3 text-center whitespace-nowrap">
                      <span
                        className={`font-mono font-bold px-1.5 py-0.5 rounded text-[11px] ${
                          l.status_code >= 500
                            ? 'bg-red-50 text-red-700'
                            : l.status_code >= 400
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-green-50 text-green-700'
                        }`}
                      >
                        {l.status_code}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono font-semibold text-gray-600 whitespace-nowrap">
                      {l.duracion_ms} ms
                    </td>
                    <td className="p-3 text-gray-600 text-[11px]">
                      <div>{l.ip_origen || '127.0.0.1'}</div>
                      {l.usuario_email && (
                        <div className="text-[10px] font-mono text-blue-600">{l.usuario_email}</div>
                      )}
                    </td>
                    <td className="p-3 text-gray-500 whitespace-nowrap text-[11px]">
                      {new Date(l.timestamp).toLocaleString('es-AR')}
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setSelectedLog(l)}
                        className="px-2 py-1 text-[11px] font-bold rounded bg-gray-100 hover:bg-gray-200 text-gray-700 cursor-pointer"
                      >
                        Ver Detalle
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINACIÓN */}
        {totalPaginas > 1 && (
          <div className="flex justify-between items-center pt-2 text-xs text-gray-500">
            <span>Página {page} de {totalPaginas}</span>
            <div className="flex gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1 rounded border border-gray-200 bg-white disabled:opacity-40 cursor-pointer"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={page >= totalPaginas}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1 rounded border border-gray-200 bg-white disabled:opacity-40 cursor-pointer"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL DETALLE DE LOG */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                    selectedLog.nivel === 'CRITICAL'
                      ? 'bg-rose-100 text-rose-800'
                      : selectedLog.nivel === 'WARN'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {selectedLog.nivel}
                </span>
                <h4 className="font-bold text-sm text-gray-900 font-mono">
                  {selectedLog.metodo} {selectedLog.ruta}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="text-gray-400 hover:text-gray-600 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                <span className="font-bold text-gray-500 block text-[10px] uppercase">Código de Estado</span>
                <span className="font-mono font-bold text-gray-900">{selectedLog.status_code}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                <span className="font-bold text-gray-500 block text-[10px] uppercase">Duración</span>
                <span className="font-mono font-bold text-gray-900">{selectedLog.duracion_ms} ms</span>
              </div>
              <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                <span className="font-bold text-gray-500 block text-[10px] uppercase">Dirección IP</span>
                <span className="font-mono text-gray-900">{selectedLog.ip_origen || 'N/A'}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                <span className="font-bold text-gray-500 block text-[10px] uppercase">Usuario Operador</span>
                <span className="font-mono text-gray-900">{selectedLog.usuario_email || 'Anónimo / Público'}</span>
              </div>
            </div>

            {selectedLog.request_body && (
              <div className="space-y-1">
                <span className="text-xs font-bold text-gray-700">Cuerpo de la Petición (Request Body):</span>
                <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl text-[11px] font-mono overflow-x-auto max-h-48">
                  {JSON.stringify(selectedLog.request_body, null, 2)}
                </pre>
              </div>
            )}

            {selectedLog.request_headers && (
              <div className="space-y-1">
                <span className="text-xs font-bold text-gray-700">Cabeceras Relevantes:</span>
                <pre className="p-3 bg-gray-100 text-gray-800 rounded-xl text-[11px] font-mono overflow-x-auto">
                  {JSON.stringify(selectedLog.request_headers, null, 2)}
                </pre>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-xs font-bold cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
