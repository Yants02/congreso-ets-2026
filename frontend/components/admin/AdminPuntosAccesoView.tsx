'use client';

import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { PuntoAccesoEntity } from './types';

interface Props {
  onNotice: (msg: string) => void;
}

export default function AdminPuntosAccesoView({ onNotice }: Props) {
  const [puntos, setPuntos] = useState<PuntoAccesoEntity[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [activoFiltro, setActivoFiltro] = useState('');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [current, setCurrent] = useState<PuntoAccesoEntity | null>(null);

  const [formData, setFormData] = useState({
    nombre: '',
    ubicacion_fisica: '',
    capacidad_maxima: 200,
    activo: true,
  });

  async function loadPuntos(queryOverride?: string) {
    setLoading(true);
    try {
      const activeQ = queryOverride !== undefined ? queryOverride : q;
      const params = new URLSearchParams();
      if (activeQ) params.set('q', activeQ);
      if (activoFiltro) params.set('activo', activoFiltro);

      const res = await fetch(`/api/admin/puntos-acceso?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setPuntos(data.puntos_acceso || []);
      }
    } catch (err) {
      console.error('Error cargando puntos de acceso:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPuntos();
  }, [activoFiltro]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/puntos-acceso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        onNotice('Punto de acceso registrado.');
        setIsCreateOpen(false);
        setFormData({ nombre: '', ubicacion_fisica: '', capacidad_maxima: 200, activo: true });
        loadPuntos();
      } else {
        await Swal.fire({
          title: 'Error al Crear',
          text: data.message || 'Error al crear punto de acceso',
          icon: 'error',
          confirmButtonColor: '#dc3545',
        });
      }
    } catch {
      await Swal.fire({
        title: 'Error de Conexión',
        text: 'Error de conexión.',
        icon: 'error',
        confirmButtonColor: '#dc3545',
      });
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!current) return;
    try {
      const res = await fetch(`/api/admin/puntos-acceso/${current.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: current.nombre,
          ubicacion_fisica: current.ubicacion_fisica,
          capacidad_maxima: current.capacidad_maxima,
          activo: current.activo,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        onNotice('Punto de acceso actualizado.');
        setIsEditOpen(false);
        setCurrent(null);
        loadPuntos();
      } else {
        await Swal.fire({
          title: 'Error al Actualizar',
          text: data.message || 'Error al actualizar',
          icon: 'error',
          confirmButtonColor: '#dc3545',
        });
      }
    } catch {
      await Swal.fire({
        title: 'Error de Conexión',
        text: 'Error de conexión.',
        icon: 'error',
        confirmButtonColor: '#dc3545',
      });
    }
  }

  async function handleDelete(id: number, nombre: string) {
    const confirmRes = await Swal.fire({
      title: '¿Eliminar punto de acceso?',
      text: `¿Seguro que deseas eliminar o dar de baja el punto de acceso "${nombre}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
    });
    if (!confirmRes.isConfirmed) return;

    try {
      const res = await fetch(`/api/admin/puntos-acceso/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.ok) {
        onNotice(data.mensaje || 'Punto de acceso retirado.');
        loadPuntos();
      } else {
        await Swal.fire({
          title: 'Error al Eliminar',
          text: data.message || 'Error al eliminar',
          icon: 'error',
          confirmButtonColor: '#dc3545',
        });
      }
    } catch {
      await Swal.fire({
        title: 'Error de Conexión',
        text: 'Error de conexión.',
        icon: 'error',
        confirmButtonColor: '#dc3545',
      });
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row gap-3 justify-between items-center">
        <div className="flex flex-wrap gap-2 w-full sm:w-auto flex-1">
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              placeholder="Buscar por Nombre o Ubicación física..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadPuntos()}
              className="w-full pl-3 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
            {q && (
              <button
                type="button"
                onClick={() => {
                  setQ('');
                  loadPuntos('');
                }}
                title="Limpiar búsqueda"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 font-bold text-xs p-1 rounded-full hover:bg-gray-100 transition"
              >
                ✕
              </button>
            )}
          </div>

          <select
            value={activoFiltro}
            onChange={(e) => setActivoFiltro(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">Todos los Estados</option>
            <option value="true">Activos</option>
            <option value="false">Inactivos</option>
          </select>

          <button
            onClick={() => loadPuntos()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition"
          >
            🔍 Buscar
          </button>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition flex items-center gap-1 shadow-sm"
        >
          ➕ Nuevo Punto de Acceso
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm text-gray-700">
            <thead className="bg-gray-50 text-xs uppercase font-bold text-gray-500 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3">Punto de Acceso</th>
                <th className="px-4 py-3">Ubicación Física</th>
                <th className="px-4 py-3 text-center">Capacidad Máxima</th>
                <th className="px-4 py-3 text-center">Aforo / Ingresos</th>
                <th className="px-4 py-3 text-center">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    Cargando puntos de acceso...
                  </td>
                </tr>
              ) : puntos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    No se encontraron puntos de acceso registrados.
                  </td>
                </tr>
              ) : (
                puntos.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 font-semibold text-gray-900">{p.nombre}</td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">{p.ubicacion_fisica}</td>
                    <td className="px-4 py-3 text-center font-bold text-gray-800">{p.capacidad_maxima}</td>
                    <td className="px-4 py-3 text-center text-xs">
                      <span className="font-bold text-green-700">{p.total_ingresos || 0} in</span> /{' '}
                      <span className="font-bold text-amber-700">{p.total_egresos || 0} out</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2 py-0.5 text-xs font-bold rounded ${
                          p.activo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {p.activo ? 'Habilitado' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => {
                            setCurrent(p);
                            setIsEditOpen(true);
                          }}
                          className="px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-xs font-semibold"
                        >
                          ✏️ Editar
                        </button>
                        <button
                          onClick={() => handleDelete(p.id, p.nombre)}
                          className="px-2 py-1 bg-red-50 text-red-700 hover:bg-red-100 rounded text-xs font-semibold"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Crear */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-gray-900">➕ Nuevo Punto de Acceso</h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Nombre Descriptivo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Molinete Principal Norte"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Ubicación Física / Código *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: HALL_PB_MOL_01"
                  value={formData.ubicacion_fisica}
                  onChange={(e) => setFormData({ ...formData, ubicacion_fisica: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Capacidad Máxima *</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={formData.capacidad_maxima}
                  onChange={(e) => setFormData({ ...formData, capacidad_maxima: parseInt(e.target.value, 10) })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold shadow"
                >
                  Crear Punto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar */}
      {isEditOpen && current && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-gray-900">✏️ Editar Punto de Acceso</h3>
              <button onClick={() => setIsEditOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Nombre</label>
                <input
                  type="text"
                  required
                  value={current.nombre}
                  onChange={(e) => setCurrent({ ...current, nombre: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Ubicación Física</label>
                <input
                  type="text"
                  required
                  value={current.ubicacion_fisica}
                  onChange={(e) => setCurrent({ ...current, ubicacion_fisica: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Capacidad Máxima</label>
                <input
                  type="number"
                  required
                  value={current.capacidad_maxima}
                  onChange={(e) => setCurrent({ ...current, capacidad_maxima: parseInt(e.target.value, 10) })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="activo_punto"
                  checked={current.activo}
                  onChange={(e) => setCurrent({ ...current, activo: e.target.checked })}
                  className="rounded text-blue-600"
                />
                <label htmlFor="activo_punto" className="text-sm font-semibold text-gray-700">
                  Punto de acceso habilitado
                </label>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
