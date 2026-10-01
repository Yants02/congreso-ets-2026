'use client';

import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { AcreditacionEntity, CatalogosConsolidados } from './types';

interface Props {
  catalogos: CatalogosConsolidados | null;
  onNotice: (msg: string) => void;
}

export default function AdminAcreditacionesView({ catalogos, onNotice }: Props) {
  const [items, setItems] = useState<AcreditacionEntity[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [tipoMov, setTipoMov] = useState('');
  const [puntoId, setPuntoId] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 25;

  const [isAnularOpen, setIsAnularOpen] = useState(false);
  const [currentAcreditacion, setCurrentAcreditacion] = useState<AcreditacionEntity | null>(null);
  const [motivoAnulacion, setMotivoAnulacion] = useState('');

  async function loadAcreditaciones(queryOverride?: string, pageOverride?: number) {
    setLoading(true);
    try {
      const activeQ = queryOverride !== undefined ? queryOverride : q;
      const activePage = pageOverride !== undefined ? pageOverride : page;
      const params = new URLSearchParams();
      if (activeQ) params.set('q', activeQ);
      if (tipoMov) params.set('tipo_movimiento', tipoMov);
      if (puntoId) params.set('punto_acceso_id', puntoId);
      params.set('page', activePage.toString());
      params.set('limit', limit.toString());

      const res = await fetch(`/api/admin/acreditaciones?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.acreditaciones || []);
        setTotal(data.total || data.total_registros || 0);
      }
    } catch (err) {
      console.error('Error cargando acreditaciones:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAcreditaciones();
  }, [page, tipoMov, puntoId]);

  async function handleAnular(e: React.FormEvent) {
    e.preventDefault();
    if (!currentAcreditacion) return;
    try {
      const res = await fetch('/api/admin/acreditaciones/anular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acreditacion_id: currentAcreditacion.id,
          motivo: motivoAnulacion,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        onNotice('Acreditación anulada por motivos disciplinarios o de auditoría.');
        setIsAnularOpen(false);
        setCurrentAcreditacion(null);
        setMotivoAnulacion('');
        loadAcreditaciones();
      } else {
        await Swal.fire({
          title: 'Error al Anular',
          text: data.message || 'Error al anular acreditación',
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

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row gap-3 justify-between items-center">
        <div className="flex flex-wrap gap-2 w-full sm:w-auto flex-1">
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="Buscar por DNI, Nombre o Apellido..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (setPage(1), loadAcreditaciones())}
              className="w-full pl-3 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
            {q && (
              <button
                type="button"
                onClick={() => {
                  setQ('');
                  setPage(1);
                  loadAcreditaciones('', 1);
                }}
                title="Limpiar búsqueda"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 font-bold text-xs p-1 rounded-full hover:bg-gray-100 transition"
              >
                ✕
              </button>
            )}
          </div>

          <select
            value={tipoMov}
            onChange={(e) => {
              setTipoMov(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">Todos los Movimientos</option>
            <option value="INGRESO">Ingresos</option>
            <option value="EGRESO">Egresos</option>
          </select>

          <select
            value={puntoId}
            onChange={(e) => {
              setPuntoId(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">Todos los Puntos</option>
            {catalogos?.puntos_acceso.map((p) => (
              <option key={p.id} value={p.id.toString()}>
                {p.nombre}
              </option>
            ))}
          </select>

          <button
            onClick={() => {
              setPage(1);
              loadAcreditaciones();
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition"
          >
            🔍 Buscar
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => {
              window.open('/api/admin/reportes/accesos.csv', '_blank');
              onNotice('Exportando historial completo de accesos y molinetes en formato CSV...');
            }}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition flex items-center gap-1.5 shadow-sm"
          >
            📊 Exportar Accesos CSV
          </button>
          <button
            onClick={() => loadAcreditaciones()}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold transition"
          >
            🔄 Refrescar
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm text-gray-700">
            <thead className="bg-gray-50 text-xs uppercase font-bold text-gray-500 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3">Fecha y Hora</th>
                <th className="px-4 py-3">Movimiento</th>
                <th className="px-4 py-3">Asistente</th>
                <th className="px-4 py-3">DNI</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">Punto de Acceso</th>
                <th className="px-4 py-3">Operador</th>
                <th className="px-4 py-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    Cargando historial de accesos...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    No se registran movimientos con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                items.map((ac) => (
                  <tr key={ac.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">
                      {new Date(ac.timestamp_acreditacion).toLocaleString('es-AR')}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 text-xs font-bold rounded ${
                          ac.tipo_movimiento === 'INGRESO'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {ac.tipo_movimiento}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {(ac.nombre || ac.usuario_nombre) ? `${ac.nombre || ac.usuario_nombre} ${ac.apellido || ac.usuario_apellido || ''}` : 'Asistente Registrado'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{ac.dni_pasaporte || ac.dni || '-'}</td>
                    <td className="px-4 py-3 text-xs text-gray-700">{ac.rol_nombre || '-'}</td>
                    <td className="px-4 py-3 text-xs text-gray-600 font-medium">{ac.punto_acceso_nombre}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{ac.operador_nombre || 'Sistema'}</td>
                    <td className="px-4 py-3 text-right">
                      {ac.estado_pase === 'ANULADO' ? (
                        <span className="text-xs text-red-600 font-bold">Anulado</span>
                      ) : (
                        <button
                          onClick={() => {
                            setCurrentAcreditacion(ac);
                            setIsAnularOpen(true);
                          }}
                          className="px-2 py-1 bg-amber-50 text-amber-800 hover:bg-amber-100 rounded text-xs font-semibold"
                        >
                          Anular Pase
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
          <div>
            Total: <span className="font-bold text-gray-700">{total}</span> movimientos
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

      {/* Modal Anular */}
      {isAnularOpen && currentAcreditacion && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-gray-900">⚠️ Anular Acreditación</h3>
              <button onClick={() => setIsAnularOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleAnular} className="space-y-3">
              <p className="text-sm text-gray-600">
                Se anulará el pase de <strong>{currentAcreditacion.nombre || currentAcreditacion.usuario_nombre} {currentAcreditacion.apellido || currentAcreditacion.usuario_apellido}</strong> (
                {currentAcreditacion.dni_pasaporte || currentAcreditacion.dni}) registrado en {currentAcreditacion.punto_acceso_nombre}.
              </p>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Motivo de Anulación *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Justifique el motivo de anulación para el log de auditoría..."
                  value={motivoAnulacion}
                  onChange={(e) => setMotivoAnulacion(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsAnularOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-semibold shadow"
                >
                  Confirmar Anulación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
