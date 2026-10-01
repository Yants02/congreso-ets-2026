'use client';

import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { EventoEntity } from './types';

interface Props {
  onNotice: (msg: string) => void;
}

export default function AdminEventosView({ onNotice }: Props) {
  const [eventos, setEventos] = useState<EventoEntity[]>([]);
  const [loading, setLoading] = useState(false);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [current, setCurrent] = useState<EventoEntity | null>(null);

  const [formData, setFormData] = useState({
    nombre: '',
    codigo_edicion: '',
    anio: 2026,
    cupo_maximo: 400,
    fecha_inicio: '2026-11-06T08:00',
    fecha_fin: '2026-11-06T19:00',
    activo: true,
    sede_nombre: 'Auditorio Polo Saavedra',
    sede_direccion: 'Crisólogo Larralde 5085, Buenos Aires',
    sede_mapa_url: 'https://maps.google.com/maps?q=Cris%C3%B3logo+Larralde+5085,+Buenos+Aires&t=&z=15&ie=UTF8&iwloc=&output=embed',
  });

  async function loadEventos() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/eventos');
      if (res.ok) {
        const data = await res.json();
        setEventos(data.eventos || []);
      }
    } catch (err) {
      console.error('Error cargando eventos:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEventos();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/eventos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          fecha_inicio: new Date(formData.fecha_inicio).toISOString(),
          fecha_fin: new Date(formData.fecha_fin).toISOString(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        onNotice('Edición de Congreso registrada.');
        setIsCreateOpen(false);
        loadEventos();
      } else {
        await Swal.fire({
          title: 'Error al Crear',
          text: data.message || 'Error al crear evento',
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
      const res = await fetch(`/api/admin/eventos/${current.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...current,
          fecha_inicio: new Date(current.fecha_inicio).toISOString(),
          fecha_fin: new Date(current.fecha_fin).toISOString(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        onNotice('Edición actualizada.');
        setIsEditOpen(false);
        setCurrent(null);
        loadEventos();
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
      title: '¿Eliminar edición?',
      text: `¿Seguro que deseas eliminar la edición "${nombre}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
    });
    if (!confirmRes.isConfirmed) return;

    try {
      const res = await fetch(`/api/admin/eventos/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.ok) {
        onNotice('Edición eliminada.');
        loadEventos();
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
        <div>
          <h2 className="text-lg font-bold text-gray-900">Ediciones Institucionales del Congreso</h2>
          <p className="text-xs text-gray-500">Gestión de calendarios, cupos globales y aforos del congreso</p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="w-full sm:w-auto justify-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition flex items-center gap-1 shadow-sm cursor-pointer"
        >
          ➕ Nueva Edición / Evento
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm text-gray-700">
            <thead className="bg-gray-50 text-xs uppercase font-bold text-gray-500 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3">Edición</th>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Año</th>
                <th className="px-4 py-3 text-center">Cupo Máximo</th>
                <th className="px-4 py-3 text-center">Inscriptos</th>
                <th className="px-4 py-3 text-center">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    Cargando eventos...
                  </td>
                </tr>
              ) : eventos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    No se registran eventos creados.
                  </td>
                </tr>
              ) : (
                eventos.map((ev) => (
                  <tr key={ev.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 font-semibold text-gray-900">{ev.nombre}</td>
                    <td className="px-4 py-3 font-mono font-bold text-xs text-blue-700">{ev.codigo_edicion}</td>
                    <td className="px-4 py-3 font-bold text-gray-700">{ev.anio}</td>
                    <td className="px-4 py-3 text-center font-bold text-gray-800">{ev.cupo_maximo}</td>
                    <td className="px-4 py-3 text-center text-xs">
                      <span className="font-bold text-green-700">{ev.total_inscriptos || 0} registrados</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2 py-0.5 text-xs font-bold rounded ${
                          ev.activo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {ev.activo ? 'Activo' : 'Cerrado'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <a
                          href={`/?preview_id=${ev.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2 py-1 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded text-xs font-semibold flex items-center"
                          title="Previsualizar portada con estos datos"
                        >
                          👁️ Preview
                        </a>
                        <button
                          onClick={() => {
                            setCurrent(ev);
                            setIsEditOpen(true);
                          }}
                          className="px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-xs font-semibold"
                        >
                          ✏️ Editar
                        </button>
                        <button
                          onClick={() => handleDelete(ev.id, ev.nombre)}
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
              <h3 className="text-lg font-bold text-gray-900">➕ Nueva Edición de Congreso</h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Nombre Oficial del Congreso *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Congreso Nacional de Educación Técnico Superior 2026"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Código de Edición *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: ETS_2026"
                    value={formData.codigo_edicion}
                    onChange={(e) => setFormData({ ...formData, codigo_edicion: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border rounded-lg text-sm uppercase font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Año Lectivo</label>
                  <input
                    type="number"
                    required
                    value={formData.anio}
                    onChange={(e) => setFormData({ ...formData, anio: parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Cupo Máximo Nominal</label>
                <input
                  type="number"
                  required
                  value={formData.cupo_maximo}
                  onChange={(e) => setFormData({ ...formData, cupo_maximo: parseInt(e.target.value, 10) })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Sede Oficial (Nombre)</label>
                <input
                  type="text"
                  required
                  value={formData.sede_nombre}
                  onChange={(e) => setFormData({ ...formData, sede_nombre: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Dirección de la Sede</label>
                <input
                  type="text"
                  required
                  value={formData.sede_direccion}
                  onChange={(e) => setFormData({ ...formData, sede_direccion: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>

              <div className="bg-gray-50 p-3 rounded-lg border space-y-3">
                <label className="block text-sm font-bold text-[#1D3343]">Ajuste Manual del Mapa</label>
                
                <div className="grid grid-cols-4 gap-3">
                  <div className="col-span-3">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Término de búsqueda (Centro del mapa)</label>
                    <input
                      type="text"
                      value={new URLSearchParams(formData.sede_mapa_url.split('?')[1]).get('q') || formData.sede_direccion || ''}
                      onChange={(e) => {
                        const z = new URLSearchParams(formData.sede_mapa_url.split('?')[1]).get('z') || '15';
                        setFormData({ 
                          ...formData, 
                          sede_mapa_url: `https://maps.google.com/maps?q=${encodeURIComponent(e.target.value)}&t=&z=${z}&ie=UTF8&iwloc=&output=embed` 
                        });
                      }}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      placeholder="Ej: Polo Educativo Saavedra"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Nivel Zoom</label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={new URLSearchParams(formData.sede_mapa_url.split('?')[1]).get('z') || '15'}
                      onChange={(e) => {
                        const q = new URLSearchParams(formData.sede_mapa_url.split('?')[1]).get('q') || formData.sede_direccion || '';
                        setFormData({ 
                          ...formData, 
                          sede_mapa_url: `https://maps.google.com/maps?q=${encodeURIComponent(q)}&t=&z=${e.target.value}&ie=UTF8&iwloc=&output=embed` 
                        });
                      }}
                      className="w-full px-3 py-2 border rounded-lg text-sm font-mono text-center"
                    />
                  </div>
                </div>

                <div className="w-full h-40 rounded-lg overflow-hidden border shadow-inner">
                  <iframe 
                    src={formData.sede_mapa_url}
                    className="w-full h-full border-0 pointer-events-none"
                    title="Vista previa del mapa"
                  ></iframe>
                </div>
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
                  Crear Edición
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
              <h3 className="text-lg font-bold text-gray-900">✏️ Editar Edición</h3>
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
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Código</label>
                  <input
                    type="text"
                    required
                    value={current.codigo_edicion}
                    onChange={(e) => setCurrent({ ...current, codigo_edicion: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border rounded-lg text-sm uppercase font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Cupo Máximo</label>
                  <input
                    type="number"
                    required
                    value={current.cupo_maximo}
                    onChange={(e) => setCurrent({ ...current, cupo_maximo: parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Sede Oficial (Nombre)</label>
                <input
                  type="text"
                  required
                  value={current.sede_nombre || ''}
                  onChange={(e) => setCurrent({ ...current, sede_nombre: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Dirección de la Sede</label>
                <input
                  type="text"
                  required
                  value={current.sede_direccion || ''}
                  onChange={(e) => setCurrent({ ...current, sede_direccion: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>

              <div className="bg-gray-50 p-3 rounded-lg border space-y-3">
                <label className="block text-sm font-bold text-[#1D3343]">Ajuste Manual del Mapa</label>
                
                <div className="grid grid-cols-4 gap-3">
                  <div className="col-span-3">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Término de búsqueda (Centro del mapa)</label>
                    <input
                      type="text"
                      value={current.sede_mapa_url ? new URLSearchParams(current.sede_mapa_url.split('?')[1]).get('q') || current.sede_direccion || '' : ''}
                      onChange={(e) => {
                        const z = current.sede_mapa_url ? new URLSearchParams(current.sede_mapa_url.split('?')[1]).get('z') || '15' : '15';
                        setCurrent({ 
                          ...current, 
                          sede_mapa_url: `https://maps.google.com/maps?q=${encodeURIComponent(e.target.value)}&t=&z=${z}&ie=UTF8&iwloc=&output=embed` 
                        });
                      }}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      placeholder="Ej: Polo Educativo Saavedra"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Nivel Zoom</label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={current.sede_mapa_url ? new URLSearchParams(current.sede_mapa_url.split('?')[1]).get('z') || '15' : '15'}
                      onChange={(e) => {
                        const q = current.sede_mapa_url ? new URLSearchParams(current.sede_mapa_url.split('?')[1]).get('q') || current.sede_direccion || '' : '';
                        setCurrent({ 
                          ...current, 
                          sede_mapa_url: `https://maps.google.com/maps?q=${encodeURIComponent(q)}&t=&z=${e.target.value}&ie=UTF8&iwloc=&output=embed` 
                        });
                      }}
                      className="w-full px-3 py-2 border rounded-lg text-sm font-mono text-center"
                    />
                  </div>
                </div>

                <div className="w-full h-40 rounded-lg overflow-hidden border shadow-inner">
                  <iframe 
                    src={current.sede_mapa_url || ''}
                    className="w-full h-full border-0 pointer-events-none"
                    title="Vista previa del mapa"
                  ></iframe>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="activo_evento"
                  checked={current.activo}
                  onChange={(e) => setCurrent({ ...current, activo: e.target.checked })}
                  className="rounded text-blue-600"
                />
                <label htmlFor="activo_evento" className="text-sm font-semibold text-gray-700">
                  Edición activa
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
