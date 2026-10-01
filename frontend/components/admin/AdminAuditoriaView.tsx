'use client';

import React, { useState, useEffect } from 'react';
import { LogAuditoriaEntity } from './types';

export default function AdminAuditoriaView() {
  const [logs, setLogs] = useState<LogAuditoriaEntity[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [evento, setEvento] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 30;

  const [selectedLog, setSelectedLog] = useState<LogAuditoriaEntity | null>(null);

  async function loadLogs(queryOverride?: string, pageOverride?: number) {
    setLoading(true);
    try {
      const activeQ = queryOverride !== undefined ? queryOverride : q;
      const activePage = pageOverride !== undefined ? pageOverride : page;
      const params = new URLSearchParams();
      if (activeQ) params.set('q', activeQ);
      if (evento) params.set('evento', evento);
      params.set('page', activePage.toString());
      params.set('limit', limit.toString());

      const res = await fetch(`/api/admin/auditoria?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setTotal(data.total_registros || data.total || 0);
      }
    } catch (err) {
      console.error('Error cargando auditoría:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLogs();
  }, [page, evento]);

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row gap-3 justify-between items-center">
        <div className="flex flex-wrap gap-2 w-full sm:w-auto flex-1">
          <div className="relative w-full sm:w-80">
            <input
              type="text"
              placeholder="Buscar por Actor, Evento o contenido JSON..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (setPage(1), loadLogs())}
              className="w-full pl-3 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
            {q && (
              <button
                type="button"
                onClick={() => {
                  setQ('');
                  setPage(1);
                  loadLogs('', 1);
                }}
                title="Limpiar búsqueda"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 font-bold text-xs p-1 rounded-full hover:bg-gray-100 transition"
              >
                ✕
              </button>
            )}
          </div>

          <select
            value={evento}
            onChange={(e) => {
              setEvento(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">Todos los Eventos</option>
            <option value="REGISTRO_ASISTENCIA">Acreditación</option>
            <option value="ALTA_USUARIO_ADMIN">Alta Usuario</option>
            <option value="MODIFICACION_USUARIO_ADMIN">Edición Usuario</option>
            <option value="BAJA_USUARIO_ADMIN">Baja Usuario</option>
            <option value="ALTA_BLACKLIST_ADMIN">Blacklist</option>
            <option value="CONFIGURACION_UPDATE">Configuración</option>
          </select>

          <button
            onClick={() => {
              setPage(1);
              loadLogs();
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition"
          >
            🔍 Buscar
          </button>
        </div>

        <button
          onClick={() => loadLogs()}
          className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold transition"
        >
          🔄 Refrescar
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm text-gray-700">
            <thead className="bg-gray-50 text-xs uppercase font-bold text-gray-500 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Evento Registrado</th>
                <th className="px-4 py-3">Actor / Operador</th>
                <th className="px-4 py-3">Detalles</th>
                <th className="px-4 py-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    Cargando bitácora forense de auditoría...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    No se registran eventos con los criterios buscados.
                  </td>
                </tr>
              ) : (
                logs.map((l) => (
                  <tr key={l.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">
                      {new Date(l.timestamp || l.creado_en || '').toLocaleString('es-AR')}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900">
                      <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-800 rounded font-mono">
                        {l.evento}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-blue-700 font-medium">{l.actor_usuario}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600 max-w-sm truncate">
                      {typeof l.detalles === 'object' ? JSON.stringify(l.detalles) : l.detalles}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setSelectedLog(l)}
                        className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-xs font-semibold"
                      >
                        Ver Detalle 👁️
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
          <div>
            Total: <span className="font-bold text-gray-700">{total}</span> eventos auditados
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1 bg-white border border-gray-300 rounded disabled:opacity-50 hover:bg-gray-100 font-semibold"
            >
              Anterior
            </button>
            <span>
              Página {page} de {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1 bg-white border border-gray-300 rounded disabled:opacity-50 hover:bg-gray-100 font-semibold"
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>

      {/* Modal Detalle JSON */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-gray-900">📜 Registro Forense de Auditoría</h3>
              <button onClick={() => setSelectedLog(null)} className="text-gray-400 hover:text-gray-600 font-bold">
                ✕
              </button>
            </div>

            <div className="space-y-2 text-sm">
              <div>
                <span className="font-semibold text-gray-500 text-xs uppercase">Evento:</span>
                <p className="font-bold text-gray-900 font-mono">{selectedLog.evento}</p>
              </div>

              <div>
                <span className="font-semibold text-gray-500 text-xs uppercase">Actor:</span>
                <p className="text-blue-700 font-medium">{selectedLog.actor_usuario}</p>
              </div>

              <div>
                <span className="font-semibold text-gray-500 text-xs uppercase">Fecha y Hora:</span>
                <p className="text-gray-700 font-mono text-xs">
                  {new Date(selectedLog.timestamp || selectedLog.creado_en || '').toLocaleString('es-AR')}
                </p>
              </div>

              <div>
                <span className="font-semibold text-gray-500 text-xs uppercase">Detalles JSON:</span>
                <pre className="mt-1 p-3 bg-gray-900 text-green-400 rounded-lg text-xs overflow-x-auto font-mono max-h-60">
                  {JSON.stringify(selectedLog.detalles, null, 2)}
                </pre>
              </div>
            </div>

            <div className="pt-3 flex justify-end border-t">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-lg text-sm font-semibold"
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
