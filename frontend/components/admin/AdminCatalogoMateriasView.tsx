'use client';

import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { CatalogoMateriaEntity } from './types';

interface Props {
  onNotice: (msg: string) => void;
}

export default function AdminCatalogoMateriasView({ onNotice }: Props) {
  const [materias, setMaterias] = useState<CatalogoMateriaEntity[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [current, setCurrent] = useState<CatalogoMateriaEntity | null>(null);

  const [formData, setFormData] = useState({
    codigo_materia: '',
    nombre_materia: '',
    descripcion: '',
    categoria_id: 1,
    creditos_academicos: 4,
    activo: true,
  });

  async function loadMaterias(queryOverride?: string) {
    setLoading(true);
    try {
      const activeQ = queryOverride !== undefined ? queryOverride : q;
      const params = new URLSearchParams();
      if (activeQ) params.set('q', activeQ);

      const res = await fetch(`/api/admin/catalogo-actividades?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setMaterias(data.materias || []);
      }
    } catch (err) {
      console.error('Error cargando materias:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMaterias();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/catalogo-actividades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        onNotice('Materia canónica registrada.');
        setIsCreateOpen(false);
        setFormData({
          codigo_materia: '',
          nombre_materia: '',
          descripcion: '',
          categoria_id: 1,
          creditos_academicos: 4,
          activo: true,
        });
        loadMaterias();
      } else {
        await Swal.fire({
          title: 'Error al Crear',
          text: data.message || 'Error al crear materia',
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

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!current) return;
    try {
      const res = await fetch(`/api/admin/catalogo-actividades/${current.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(current),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        onNotice('Materia actualizada.');
        setIsEditOpen(false);
        setCurrent(null);
        loadMaterias();
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
        text: 'Error de conexión con el servidor.',
        icon: 'error',
        confirmButtonColor: '#dc3545',
      });
    }
  }

  async function handleDelete(id: number, nombre: string) {
    const confirmRes = await Swal.fire({
      title: '¿Eliminar materia?',
      text: `¿Seguro que deseas eliminar la materia canónica "${nombre}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
    });
    if (!confirmRes.isConfirmed) return;

    try {
      const res = await fetch(`/api/admin/catalogo-actividades/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.ok) {
        onNotice('Materia eliminada.');
        loadMaterias();
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
        text: 'Error de conexión con el servidor.',
        icon: 'error',
        confirmButtonColor: '#dc3545',
      });
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row gap-3 justify-between items-center">
        <div className="flex gap-2 w-full sm:w-auto flex-1">
          <div className="relative w-full sm:w-80">
            <input
              type="text"
              placeholder="Buscar por Código canónico o Nombre de materia..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadMaterias()}
              className="w-full pl-3 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
            {q && (
              <button
                type="button"
                onClick={() => {
                  setQ('');
                  loadMaterias('');
                }}
                title="Limpiar búsqueda"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 font-bold text-xs p-1 rounded-full hover:bg-gray-100 transition"
              >
                ✕
              </button>
            )}
          </div>

          <button
            onClick={() => loadMaterias()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition"
          >
            🔍 Buscar
          </button>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition flex items-center gap-1 shadow-sm"
        >
          ➕ Nueva Materia Canónica
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm text-gray-700">
            <thead className="bg-gray-50 text-xs uppercase font-bold text-gray-500 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Nombre de la Materia</th>
                <th className="px-4 py-3">Área / Categoría</th>
                <th className="px-4 py-3 text-center">Créditos</th>
                <th className="px-4 py-3 text-center">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    Cargando catálogo canónico de materias...
                  </td>
                </tr>
              ) : materias.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    No se encontraron materias registradas.
                  </td>
                </tr>
              ) : (
                materias.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 font-mono font-bold text-xs text-blue-700">{m.codigo_materia}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{m.nombre_materia}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{m.categoria_nombre || 'General'}</td>
                    <td className="px-4 py-3 text-center font-bold text-gray-700">{m.creditos_academicos || 0}</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2 py-0.5 text-xs font-bold rounded ${
                          m.activo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {m.activo ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => {
                            setCurrent(m);
                            setIsEditOpen(true);
                          }}
                          className="px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-xs font-semibold"
                        >
                          ✏️ Editar
                        </button>
                        <button
                          onClick={() => handleDelete(m.id, m.nombre_materia)}
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
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-gray-900">➕ Nueva Materia Canónica</h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Código de Materia *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: SIST-201"
                    value={formData.codigo_materia}
                    onChange={(e) => setFormData({ ...formData, codigo_materia: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none uppercase font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Créditos Académicos</label>
                  <input
                    type="number"
                    min={1}
                    value={formData.creditos_academicos}
                    onChange={(e) => setFormData({ ...formData, creditos_academicos: parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Nombre de la Materia *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Redes y Telecomunicaciones Avanzadas"
                  value={formData.nombre_materia}
                  onChange={(e) => setFormData({ ...formData, nombre_materia: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Descripción</label>
                <textarea
                  rows={2}
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
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
                  Guardar Materia
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar */}
      {isEditOpen && current && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-gray-900">✏️ Editar Materia</h3>
              <button onClick={() => setIsEditOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Código</label>
                  <input
                    type="text"
                    required
                    value={current.codigo_materia}
                    onChange={(e) => setCurrent({ ...current, codigo_materia: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border rounded-lg text-sm font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Créditos</label>
                  <input
                    type="number"
                    value={current.creditos_academicos || 0}
                    onChange={(e) => setCurrent({ ...current, creditos_academicos: parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Nombre</label>
                <input
                  type="text"
                  required
                  value={current.nombre_materia}
                  onChange={(e) => setCurrent({ ...current, nombre_materia: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Descripción</label>
                <textarea
                  rows={2}
                  value={current.descripcion || ''}
                  onChange={(e) => setCurrent({ ...current, descripcion: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="activo_materia"
                  checked={current.activo}
                  onChange={(e) => setCurrent({ ...current, activo: e.target.checked })}
                  className="rounded text-blue-600"
                />
                <label htmlFor="activo_materia" className="text-sm font-semibold text-gray-700">
                  Materia canónica habilitada
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
