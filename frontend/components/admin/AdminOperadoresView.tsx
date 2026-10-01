'use client';

import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { OperadorEntity, CatalogosConsolidados } from './types';

interface Props {
  catalogos: CatalogosConsolidados | null;
  onNotice: (msg: string) => void;
}

export default function AdminOperadoresView({ catalogos, onNotice }: Props) {
  const [operadores, setOperadores] = useState<OperadorEntity[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [activoFiltro, setActivoFiltro] = useState('');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [current, setCurrent] = useState<OperadorEntity | null>(null);

  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    email_institucional: '',
    password: '',
    punto_acceso_default_id: 1,
    rol_id: 5, // Operador por defecto
  });

  function getAuthHeaders(includeJson = false): HeadersInit {
    const token = typeof window !== 'undefined' ? localStorage.getItem('congreso_token') : null;
    const headers: Record<string, string> = {};
    if (includeJson) {
      headers['Content-Type'] = 'application/json';
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  async function loadOperadores(queryOverride?: string) {
    setLoading(true);
    try {
      const activeQ = queryOverride !== undefined ? queryOverride : q;
      const params = new URLSearchParams();
      if (activeQ) params.set('q', activeQ);
      if (activoFiltro) params.set('activo', activoFiltro);

      const res = await fetch(`/api/admin/operadores?${params.toString()}`, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setOperadores(data.operadores || []);
      } else {
        const errData = await res.json().catch(() => ({}));
        console.error('Error cargando operadores:', res.status, errData);
      }
    } catch (err) {
      console.error('Error cargando operadores:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOperadores();
  }, [activoFiltro]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/operadores', {
        method: 'POST',
        headers: getAuthHeaders(true),
        credentials: 'include',
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        onNotice('Operador creado exitosamente con contraseña segura.');
        setIsCreateOpen(false);
        setFormData({
          nombre: '',
          apellido: '',
          email_institucional: '',
          password: '',
          punto_acceso_default_id: 1,
          rol_id: 5,
        });
        loadOperadores();
      } else {
        await Swal.fire({
          title: 'Error al Crear',
          text: data.message || data.error || 'Error al crear operador',
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
      const res = await fetch(`/api/admin/operadores/${current.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(true),
        credentials: 'include',
        body: JSON.stringify({
          nombre: current.nombre,
          apellido: current.apellido,
          email_institucional: current.email_institucional,
          punto_acceso_default_id: current.punto_acceso_default_id,
          rol_id: current.rol_id,
          activo: current.activo,
          permisos: current.permisos,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        onNotice('Operador actualizado correctamente.');
        setIsEditOpen(false);
        setCurrent(null);
        loadOperadores();
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
    if (id === 1 || id === 4) {
      await Swal.fire({
        title: 'Acción Denegada',
        text: 'Por seguridad del sistema, no se puede eliminar al Superadmin raíz.',
        icon: 'warning',
        confirmButtonColor: '#005691',
      });
      return;
    }
    const confirmRes = await Swal.fire({
      title: '¿Dar de baja operador?',
      text: `¿Confirma dar de baja al operador "${nombre}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, dar de baja',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
    });
    if (!confirmRes.isConfirmed) return;

    try {
      const res = await fetch(`/api/admin/operadores/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        onNotice('Operador removido del sistema.');
        loadOperadores();
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
        <div className="flex flex-wrap gap-2 w-full sm:w-auto flex-1">
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              placeholder="Buscar por Nombre o Email institucional..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadOperadores()}
              className="w-full pl-3 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
            {q && (
              <button
                type="button"
                onClick={() => {
                  setQ('');
                  loadOperadores('');
                }}
                title="Limpiar búsqueda"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 font-bold text-xs p-1 rounded-full hover:bg-gray-100 transition cursor-pointer"
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
            onClick={() => loadOperadores()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition cursor-pointer"
          >
            🔍 Buscar
          </button>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="w-full sm:w-auto justify-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition flex items-center gap-1 shadow-sm cursor-pointer"
        >
          ➕ Nuevo Operador
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* VISTA ESCRITORIO / TABLET: TABLA COMPLETA */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="min-w-full text-left text-sm text-gray-700">
            <thead className="bg-gray-50 text-xs uppercase font-bold text-gray-500 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3">Operador</th>
                <th className="px-4 py-3">Email Institucional</th>
                <th className="px-4 py-3">Rol / Jerarquía</th>
                <th className="px-4 py-3">Punto Asignado</th>
                <th className="px-4 py-3 text-center">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    Cargando operadores del sistema...
                  </td>
                </tr>
              ) : operadores.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    No se encontraron operadores registrados.
                  </td>
                </tr>
              ) : (
                operadores.map((op) => (
                  <tr key={op.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 font-semibold text-gray-900">
                      {op.nombre} {op.apellido}
                    </td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">{op.email_institucional}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 text-xs font-semibold bg-blue-50 text-blue-800 rounded">
                        {op.rol_nombre || 'Operador'} (Nivel {op.jerarquia || 3})
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{op.punto_acceso_nombre || 'General'}</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2 py-0.5 text-xs font-bold rounded ${
                          op.activo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {op.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => {
                            setCurrent(op);
                            setIsEditOpen(true);
                          }}
                          className="px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-xs font-semibold"
                        >
                          ✏️ Editar
                        </button>
                        <button
                          onClick={() => handleDelete(op.id, `${op.nombre} ${op.apellido}`)}
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

        {/* VISTA MÓVIL (< sm): TARJETAS RESPONSIVAS OPTIMIZADAS */}
        <div className="block sm:hidden divide-y divide-gray-100">
          {loading ? (
            <div className="p-6 text-center text-sm text-gray-500">
              Cargando operadores del sistema...
            </div>
          ) : operadores.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-400">
              No se encontraron operadores registrados.
            </div>
          ) : (
            operadores.map((op) => (
              <div key={op.id} className="p-4 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-gray-900 text-sm">
                      {op.nombre} {op.apellido}
                    </h4>
                    <p className="text-xs text-gray-500 font-mono mt-0.5">
                      {op.email_institucional}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-bold rounded shrink-0 ${
                      op.activo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {op.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-600">
                  <span className="px-2 py-0.5 text-[11px] font-semibold bg-blue-50 text-blue-800 rounded">
                    {op.rol_nombre || 'Operador'} (Nivel {op.jerarquia || 3})
                  </span>
                  <span className="text-gray-300">·</span>
                  <span className="text-[11px] text-gray-600">
                    📍 {op.punto_acceso_nombre || 'General'}
                  </span>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-gray-100">
                  <button
                    onClick={() => {
                      setCurrent(op);
                      setIsEditOpen(true);
                    }}
                    className="flex-1 py-1.5 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold text-center transition"
                  >
                    ✏️ Editar y Permisos
                  </button>
                  <button
                    onClick={() => handleDelete(op.id, `${op.nombre} ${op.apellido}`)}
                    className="py-1.5 px-3 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-semibold text-center transition"
                    title="Dar de baja operador"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal Crear */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-gray-900">➕ Nuevo Operador de Sistema</h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Nombre *</label>
                  <input
                    type="text"
                    required
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Apellido *</label>
                  <input
                    type="text"
                    required
                    value={formData.apellido}
                    onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Email Institucional *</label>
                <input
                  type="email"
                  required
                  placeholder="usuario@buenosaires.gob.ar"
                  value={formData.email_institucional}
                  onChange={(e) => setFormData({ ...formData, email_institucional: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Contraseña Inicial *</label>
                <input
                  type="password"
                  required
                  placeholder="Mínimo 8 caracteres"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Rol / Permisos</label>
                  <select
                    value={formData.rol_id}
                    onChange={(e) => setFormData({ ...formData, rol_id: parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {(catalogos?.roles_operadores || catalogos?.roles.filter((r) => r.jerarquia >= 3))?.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nombre} (Nivel {r.jerarquia})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Punto por Defecto</label>
                  <select
                    value={formData.punto_acceso_default_id}
                    onChange={(e) =>
                      setFormData({ ...formData, punto_acceso_default_id: parseInt(e.target.value, 10) })
                    }
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {catalogos?.puntos_acceso.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>
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
                  Crear Operador
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
              <h3 className="text-lg font-bold text-gray-900">✏️ Editar Operador</h3>
              <button onClick={() => setIsEditOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
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
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Apellido</label>
                  <input
                    type="text"
                    required
                    value={current.apellido}
                    onChange={(e) => setCurrent({ ...current, apellido: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Email Institucional</label>
                <input
                  type="email"
                  required
                  value={current.email_institucional}
                  onChange={(e) => setCurrent({ ...current, email_institucional: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Rol / Permisos</label>
                  <select
                    value={current.rol_id}
                    onChange={(e) => setCurrent({ ...current, rol_id: parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {(catalogos?.roles_operadores || catalogos?.roles.filter((r) => r.jerarquia >= 3))?.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nombre} (Nivel {r.jerarquia})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Punto por Defecto</label>
                  <select
                    value={current.punto_acceso_default_id}
                    onChange={(e) =>
                      setCurrent({ ...current, punto_acceso_default_id: parseInt(e.target.value, 10) })
                    }
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {catalogos?.puntos_acceso.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* PANEL DE CHECKBOXES DE ACCESO DEL OPERADOR */}
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/70 space-y-2">
                <div className="flex items-center justify-between border-b pb-1.5">
                  <div>
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                      <span>🛡️</span> Módulos Asignados al Operador
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      El rol seleccionado (Nivel {catalogos?.roles.find((r) => r.id === current.rol_id)?.jerarquia || current.jerarquia || 3}) determina el límite de accesos.
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        const opJerarquia = catalogos?.roles.find((r) => r.id === current.rol_id)?.jerarquia || current.jerarquia || 3;
                        const roleObj = catalogos?.roles.find((r) => r.id === current.rol_id);
                        const rolePerms = Array.isArray(roleObj?.permisos) && roleObj.permisos.length > 0
                          ? roleObj.permisos
                          : [
                              'dashboard', 'estadisticas_5ejes', 'usuarios', 'acreditaciones', 'manuales', 'frontend_cms', 'identificacion_editor',
                              'actividades', 'presentadores', 'catalogo', 'homologaciones', 'certificados', 'encuestas', 'puntos', 'eventos',
                              'operadores', 'blacklist', 'auditoria', 'configuracion', 'cron',
                            ];
                        const MODULOS_MAP: Record<string, number> = {
                          dashboard: 3, estadisticas_5ejes: 3, usuarios: 3, acreditaciones: 3, frontend_cms: 3, identificacion_editor: 3, manuales: 3,
                          actividades: 4, presentadores: 4, catalogo: 4, homologaciones: 4, certificados: 4, encuestas: 4, puntos: 4, eventos: 4,
                          operadores: 5, blacklist: 5, auditoria: 5, configuracion: 5, cron: 5,
                        };
                        const allowed = rolePerms.filter((p) => (MODULOS_MAP[p] || 3) <= opJerarquia);
                        setCurrent({ ...current, permisos: allowed });
                      }}
                      className="px-2 py-0.5 text-[10px] font-bold text-blue-700 bg-blue-100 hover:bg-blue-200 rounded"
                    >
                      Restablecer del Rol
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrent({ ...current, permisos: [] })}
                      className="px-2 py-0.5 text-[10px] font-bold text-gray-600 bg-gray-200 hover:bg-gray-300 rounded"
                    >
                      Ninguno
                    </button>
                  </div>
                </div>

                {/* Lista de Checkboxes agrupados */}
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {[
                    { key: 'dashboard', label: 'Tablero 360°', icon: '📊', min: 3 },
                    { key: 'estadisticas_5ejes', label: 'Estadísticas (5 Ejes)', icon: '📈', min: 3 },
                    { key: 'usuarios', label: 'Participantes (CRUD)', icon: '👥', min: 3 },
                    { key: 'acreditaciones', label: 'Accesos en Vivo', icon: '🎟️', min: 3 },
                    { key: 'manuales', label: 'Manuales y PDF', icon: '📖', min: 3 },
                    { key: 'frontend_cms', label: 'CMS Frontend', icon: '🎴', min: 3 },
                    { key: 'identificacion_editor', label: 'Editor Tarjetas', icon: '🎨', min: 3 },
                    { key: 'actividades', label: 'Actividades', icon: '📅', min: 4 },
                    { key: 'presentadores', label: 'Presentadores', icon: '🎤', min: 4 },
                    { key: 'catalogo', label: 'Materias Canónicas', icon: '📋', min: 4 },
                    { key: 'homologaciones', label: 'Homologaciones', icon: '🎖️', min: 4 },
                    { key: 'certificados', label: 'Certificados', icon: '🎓', min: 4 },
                    { key: 'encuestas', label: 'Encuestas', icon: '📋', min: 4 },
                    { key: 'puntos', label: 'Recintos y Salas', icon: '🏢', min: 4 },
                    { key: 'eventos', label: 'Ediciones y Eventos', icon: '🏛️', min: 4 },
                    { key: 'operadores', label: 'Operadores', icon: '🛡️', min: 5 },
                    { key: 'blacklist', label: 'Lista Negra', icon: '🚫', min: 5 },
                    { key: 'auditoria', label: 'Auditoría Forense', icon: '📜', min: 5 },
                    { key: 'configuracion', label: 'Configuración', icon: '⚙️', min: 5 },
                    { key: 'cron', label: 'Cron Jobs', icon: '⏱️', min: 5 },
                  ].map((mod) => {
                    const opJerarquia = catalogos?.roles.find((r) => r.id === current.rol_id)?.jerarquia || current.jerarquia || 3;
                    const isAllowed = opJerarquia >= mod.min;
                    const currentPerms = Array.isArray(current.permisos) ? current.permisos : [];
                    const isChecked = currentPerms.includes(mod.key);

                    return (
                      <label
                        key={mod.key}
                        className={`flex items-center gap-1.5 p-1 rounded text-xs select-none ${
                          !isAllowed
                            ? 'opacity-40 bg-slate-100 cursor-not-allowed text-slate-400'
                            : isChecked
                            ? 'bg-blue-50 border border-blue-200 text-blue-900 font-medium cursor-pointer'
                            : 'hover:bg-slate-50 cursor-pointer text-slate-700'
                        }`}
                        title={!isAllowed ? `Requiere Nivel ${mod.min}` : undefined}
                      >
                        <input
                          type="checkbox"
                          disabled={!isAllowed}
                          checked={isChecked && isAllowed}
                          onChange={(e) => {
                            if (!isAllowed) return;
                            if (e.target.checked) {
                              setCurrent({ ...current, permisos: [...currentPerms, mod.key] });
                            } else {
                              setCurrent({ ...current, permisos: currentPerms.filter((p) => p !== mod.key) });
                            }
                          }}
                          className="rounded text-blue-600 focus:ring-blue-500 disabled:opacity-40 cursor-pointer"
                        />
                        <span className="truncate text-[11px] flex items-center gap-1">
                          <span>{mod.icon}</span>
                          <span>{mod.label}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="activo_operador"
                  checked={current.activo}
                  onChange={(e) => setCurrent({ ...current, activo: e.target.checked })}
                  className="rounded text-blue-600"
                />
                <label htmlFor="activo_operador" className="text-sm font-semibold text-gray-700">
                  Operador habilitado en el sistema
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
