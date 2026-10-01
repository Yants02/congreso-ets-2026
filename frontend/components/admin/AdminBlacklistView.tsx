'use client';

import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { BlacklistEntity } from './types';

interface Props {
  onNotice: (msg: string) => void;
}

export default function AdminBlacklistView({ onNotice }: Props) {
  const [items, setItems] = useState<BlacklistEntity[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [activoFiltro, setActivoFiltro] = useState('');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    dni_pasaporte: '',
    motivo: '',
  });

  async function loadBlacklist(queryOverride?: string) {
    setLoading(true);
    try {
      const activeQ = queryOverride !== undefined ? queryOverride : q;
      const params = new URLSearchParams();
      if (activeQ) params.set('q', activeQ);
      if (activoFiltro) params.set('activo', activoFiltro);

      const res = await fetch(`/api/admin/blacklist?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.blacklist || []);
      }
    } catch (err) {
      console.error('Error cargando blacklist:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBlacklist();
  }, [activoFiltro]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/blacklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        onNotice(`DNI ${formData.dni_pasaporte} incorporado a lista de exclusión.`);
        setIsCreateOpen(false);
        setFormData({ dni_pasaporte: '', motivo: '' });
        loadBlacklist();
      } else {
        await Swal.fire({
          title: 'Error al Incorporar',
          text: data.message || 'Error al incorporar a blacklist',
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

  async function handleDelete(id: number, dni: string) {
    const confirmRes = await Swal.fire({
      title: '¿Levantar restricción?',
      text: `¿Seguro que deseas levantar la restricción disciplinaria para el DNI ${dni}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, levantar restricción',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#005691',
      cancelButtonColor: '#6c757d',
    });
    if (!confirmRes.isConfirmed) return;

    try {
      const res = await fetch(`/api/admin/blacklist/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.ok) {
        await Swal.fire({
          title: 'Restricción Levantada',
          text: 'Restricción disciplinaria removida correctamente.',
          icon: 'success',
          confirmButtonColor: '#005691',
        });
        onNotice('Restricción removida correctamente.');
        loadBlacklist();
      } else {
        await Swal.fire({
          title: 'Error al Levantar Restricción',
          text: data.message || 'Error al levantar restricción',
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
              placeholder="Buscar por DNI o Motivo de exclusión..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadBlacklist()}
              className="w-full pl-3 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
            {q && (
              <button
                type="button"
                onClick={() => {
                  setQ('');
                  loadBlacklist('');
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
            <option value="">Todas las Restricciones</option>
            <option value="true">Activas</option>
            <option value="false">Levantadas</option>
          </select>

          <button
            onClick={() => loadBlacklist()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition"
          >
            🔍 Buscar
          </button>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition flex items-center gap-1 shadow-sm"
        >
          🚫 Bloquear DNI / Pasaporte
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm text-gray-700">
            <thead className="bg-gray-50 text-xs uppercase font-bold text-gray-500 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3">DNI / Pasaporte</th>
                <th className="px-4 py-3">Motivo de Exclusión</th>
                <th className="px-4 py-3">Registrado Por</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3 text-center">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    Consultando lista negra...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    No hay restricciones registradas.
                  </td>
                </tr>
              ) : (
                items.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 font-mono font-bold text-gray-900">{b.dni_pasaporte}</td>
                    <td className="px-4 py-3 text-gray-700">{b.motivo}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{b.registrado_por || 'ADMIN'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 font-mono">
                      {new Date(b.registrado_en).toLocaleDateString('es-AR')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2 py-0.5 text-xs font-bold rounded ${
                          b.activo ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {b.activo ? 'Bloqueado' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(b.id, b.dni_pasaporte)}
                        className="px-2 py-1 bg-red-50 text-red-700 hover:bg-red-100 rounded text-xs font-semibold"
                        title="Levantar restricción"
                      >
                        Remover ✕
                      </button>
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
              <h3 className="text-lg font-bold text-red-700">🚫 Bloquear Documento (Blacklist)</h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">DNI / Pasaporte a Excluir *</label>
                <input
                  type="text"
                  required
                  placeholder="Número de documento sin puntos"
                  value={formData.dni_pasaporte}
                  onChange={(e) => setFormData({ ...formData, dni_pasaporte: e.target.value.trim() })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Motivo Disciplinario o Legal *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Detalle los motivos por los cuales este documento no puede registrarse ni ingresar al predio..."
                  value={formData.motivo}
                  onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none"
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
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold shadow"
                >
                  Confirmar Bloqueo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
