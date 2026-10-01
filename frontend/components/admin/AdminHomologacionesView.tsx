'use client';

import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { HomologacionEntity } from './types';

interface Props {
  onNotice: (msg: string) => void;
}

export default function AdminHomologacionesView({ onNotice }: Props) {
  const [items, setItems] = useState<HomologacionEntity[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState('PENDIENTE');

  const [isResolveOpen, setIsResolveOpen] = useState(false);
  const [current, setCurrent] = useState<HomologacionEntity | null>(null);
  const [resolveAction, setResolveAction] = useState<'VALIDADO' | 'RECHAZADO'>('VALIDADO');
  const [observaciones, setObservaciones] = useState('');

  async function loadHomologaciones(queryOverride?: string) {
    setLoading(true);
    try {
      const activeQ = queryOverride !== undefined ? queryOverride : q;
      const params = new URLSearchParams();
      if (activeQ) params.set('q', activeQ);
      if (estado) params.set('estado', estado);

      const res = await fetch(`/api/admin/homologaciones?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.homologaciones || []);
      }
    } catch (err) {
      console.error('Error cargando homologaciones:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadHomologaciones();
  }, [estado]);

  async function handleResolve(e: React.FormEvent) {
    e.preventDefault();
    if (!current) return;
    try {
      const res = await fetch('/api/admin/homologaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario_id: current.usuario_id,
          estado_homologacion: resolveAction,
          observaciones,
          documentacion_presentada: current.documentacion_presentada,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        onNotice(`Postulación ${resolveAction === 'VALIDADO' ? 'aprobada' : 'rechazada'} correctamente.`);
        setIsResolveOpen(false);
        setCurrent(null);
        setObservaciones('');
        loadHomologaciones();
      } else {
        await Swal.fire({
          title: 'Error en Dictamen',
          text: data.message || 'Error al procesar dictamen',
          icon: 'error',
          confirmButtonColor: '#dc3545',
        });
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

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row gap-3 justify-between items-center">
        <div className="flex flex-wrap gap-2 w-full sm:w-auto flex-1">
          <div className="relative w-full sm:w-80">
            <input
              type="text"
              placeholder="Buscar por Nombre, DNI o Email de ponente..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadHomologaciones()}
              className="w-full pl-3 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
            {q && (
              <button
                type="button"
                onClick={() => {
                  setQ('');
                  loadHomologaciones('');
                }}
                title="Limpiar búsqueda"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 font-bold text-xs p-1 rounded-full hover:bg-gray-100 transition"
              >
                ✕
              </button>
            )}
          </div>

          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="TODOS">Todos los Estados</option>
            <option value="PENDIENTE">Pendientes</option>
            <option value="VALIDADO">Validados / Aprobados</option>
            <option value="RECHAZADO">Rechazados</option>
          </select>

          <button
            onClick={() => loadHomologaciones()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition"
          >
            🔍 Buscar
          </button>
        </div>

        <button
          onClick={() => loadHomologaciones()}
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
                <th className="px-4 py-3">Expositor / Postulante</th>
                <th className="px-4 py-3">DNI / Pasaporte</th>
                <th className="px-4 py-3">Rol Solicitado</th>
                <th className="px-4 py-3">Documentación</th>
                <th className="px-4 py-3 text-center">Estado</th>
                <th className="px-4 py-3 text-right">Dictamen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    Cargando solicitudes de ponentes...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    No se registran solicitudes en este estado.
                  </td>
                </tr>
              ) : (
                items.map((h) => (
                  <tr key={h.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900">
                        {h.usuario_nombre} {h.usuario_apellido}
                      </div>
                      <div className="text-xs text-gray-400">{h.email}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{h.dni_pasaporte}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-gray-700">{h.rol_nombre}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">
                      {h.documentacion_presentada || 'Sin documentación adjunta'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2 py-0.5 text-xs font-bold rounded ${
                          h.estado_homologacion === 'VALIDADO'
                            ? 'bg-green-100 text-green-800'
                            : h.estado_homologacion === 'RECHAZADO'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {h.estado_homologacion}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {h.estado_homologacion === 'PENDIENTE' ? (
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => {
                              setCurrent(h);
                              setResolveAction('VALIDADO');
                              setIsResolveOpen(true);
                            }}
                            className="px-2 py-1 bg-green-50 text-green-700 hover:bg-green-100 rounded text-xs font-semibold"
                          >
                            ✓ Aprobar
                          </button>
                          <button
                            onClick={() => {
                              setCurrent(h);
                              setResolveAction('RECHAZADO');
                              setIsResolveOpen(true);
                            }}
                            className="px-2 py-1 bg-red-50 text-red-700 hover:bg-red-100 rounded text-xs font-semibold"
                          >
                            ✕ Rechazar
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">Dictaminado</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Dictamen */}
      {isResolveOpen && current && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-gray-900">
                {resolveAction === 'VALIDADO' ? '✅ Aprobar Homologación' : '🚫 Rechazar Homologación'}
              </h3>
              <button onClick={() => setIsResolveOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleResolve} className="space-y-3">
              <p className="text-sm text-gray-700">
                Postulante: <strong>{current.usuario_nombre} {current.usuario_apellido}</strong> ({current.dni_pasaporte})
              </p>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Observaciones / Dictamen Académico
                </label>
                <textarea
                  rows={3}
                  placeholder="Ingrese justificación o detalles del dictamen institucional..."
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsResolveOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 text-white rounded-lg text-sm font-semibold shadow ${
                    resolveAction === 'VALIDADO' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  Confirmar Dictamen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
