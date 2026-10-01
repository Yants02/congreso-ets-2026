'use client';

import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { PresentadorEntity, CatalogosConsolidados } from './types';

interface Props {
  catalogos: CatalogosConsolidados | null;
  onNotice: (msg: string) => void;
}

export default function AdminPresentadoresView({ onNotice }: Props) {
  const [presentadores, setPresentadores] = useState<PresentadorEntity[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');

  // Modales
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [current, setCurrent] = useState<PresentadorEntity | null>(null);

  // Formulario Alta
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    email: '',
    dni_pasaporte: '',
    celular: '',
    institucion: '',
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

  async function loadPresentadores(queryOverride?: string) {
    setLoading(true);
    try {
      const activeQ = queryOverride !== undefined ? queryOverride : q;
      const params = new URLSearchParams();
      if (activeQ) params.set('q', activeQ);
      const res = await fetch(`/api/admin/presentadores?${params.toString()}`, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setPresentadores(data.presentadores || []);
      } else {
        const errData = await res.json().catch(() => ({}));
        console.error('Error cargando presentadores:', res.status, errData);
      }
    } catch (err) {
      console.error('Error cargando presentadores:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPresentadores();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/presentadores', {
        method: 'POST',
        headers: getAuthHeaders(true),
        credentials: 'include',
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        onNotice('Presentador registrado con éxito y homologado.');
        setIsCreateOpen(false);
        setFormData({ nombre: '', apellido: '', email: '', dni_pasaporte: '', celular: '', institucion: '' });
        loadPresentadores();
      } else {
        await Swal.fire({
          title: 'Error al Registrar',
          text: data.message || data.error || 'Error al registrar presentador',
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
      const res = await fetch(`/api/admin/presentadores/${current.usuario_id}`, {
        method: 'PUT',
        headers: getAuthHeaders(true),
        credentials: 'include',
        body: JSON.stringify({
          nombre: current.nombre,
          apellido: current.apellido,
          email: current.email,
          celular: current.celular,
          institucion: current.institucion_bio,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        onNotice('Presentador actualizado.');
        setIsEditOpen(false);
        setCurrent(null);
        loadPresentadores();
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

  async function handleDelete(id: string, nombreCompleto: string) {
    const confirmRes = await Swal.fire({
      title: '¿Dar de baja presentador?',
      text: `¿Confirma eliminar a "${nombreCompleto}" de la nómina de presentadores?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, dar de baja',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
    });
    if (!confirmRes.isConfirmed) return;

    try {
      const res = await fetch(`/api/admin/presentadores/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        onNotice(data.mensaje || 'Presentador dado de baja.');
        loadPresentadores();
      } else {
        await Swal.fire({
          title: 'Error al Eliminar',
          text: data.message || 'Error al eliminar presentador',
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

  const totalPonencias = presentadores.reduce((acc, p) => acc + (Number(p.total_actividades) || 0), 0);
  const totalAforo = presentadores.reduce((acc, p) => acc + (Number(p.cupo_acumulado) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Tarjetas de Métricas Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center text-xl font-bold">
            🎤
          </div>
          <div>
            <div className="text-2xl font-extrabold text-gray-900">{presentadores.length}</div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Presentadores Activos</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-xl font-bold">
            📅
          </div>
          <div>
            <div className="text-2xl font-extrabold text-gray-900">{totalPonencias}</div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Ponencias / Charlas Asignadas</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl font-bold">
            👥
          </div>
          <div>
            <div className="text-2xl font-extrabold text-gray-900">{totalAforo}</div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Aforo Total Convocado</div>
          </div>
        </div>
      </div>

      {/* Barra de Búsqueda y Botón Alta */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row gap-3 justify-between items-center">
        <div className="flex flex-wrap gap-2 w-full sm:w-auto flex-1">
          <div className="relative w-full sm:w-80">
            <input
              type="text"
              placeholder="Buscar por Nombre, DNI, Email o Institución..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadPresentadores()}
              className="w-full pl-3 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
            />
            {q && (
              <button
                type="button"
                onClick={() => {
                  setQ('');
                  loadPresentadores('');
                }}
                title="Limpiar búsqueda"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 font-bold text-xs p-1 rounded-full hover:bg-gray-100 transition cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
          <button
            onClick={() => loadPresentadores()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition cursor-pointer"
          >
            🔍 Buscar
          </button>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="w-full sm:w-auto justify-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold transition flex items-center gap-1 shadow-sm cursor-pointer"
        >
          ➕ Nuevo Presentador
        </button>
      </div>

      {/* Tabla de Presentadores */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* VISTA ESCRITORIO (>= sm) */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-xs font-bold text-gray-700 uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="px-4 py-3">Presentador / Expositor</th>
                <th className="px-4 py-3">Contacto & DNI</th>
                <th className="px-4 py-3">Filiación / Institución</th>
                <th className="px-4 py-3 text-center">Ponencias</th>
                <th className="px-4 py-3">Cronograma Asignado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    Cargando nómina de expositores...
                  </td>
                </tr>
              ) : presentadores.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    No se encontraron presentadores registrados.
                  </td>
                </tr>
              ) : (
                presentadores.map((p) => (
                  <tr key={p.usuario_id} className="hover:bg-slate-50/60 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-purple-100 text-purple-700 font-extrabold flex items-center justify-center text-xs ring-2 ring-purple-50">
                          {p.nombre?.[0]}{p.apellido?.[0]}
                        </div>
                        <div>
                          <div className="font-bold text-gray-900">{p.nombre} {p.apellido}</div>
                          <span className="inline-block px-1.5 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded text-[10px] font-semibold">
                            {p.rol_nombre || 'Expositor'}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-gray-800 font-medium">{p.email}</div>
                      <div className="text-[11px] text-gray-400">DNI: {p.dni_pasaporte} · Tel: {p.celular}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-gray-700 max-w-xs truncate font-medium">
                        {p.institucion_bio || 'Sin filiación especificada'}
                      </div>
                      {p.estado_homologacion && (
                        <span className={`inline-block px-1.5 py-0.5 mt-1 rounded text-[10px] font-bold ${
                          p.estado_homologacion === 'VALIDADO'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          Homologación: {p.estado_homologacion}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center px-2 py-1 bg-blue-50 text-blue-800 rounded-md font-bold text-xs">
                        {p.total_actividades}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {p.actividades && p.actividades.length > 0 ? (
                        <div className="flex flex-col gap-1 max-w-xs">
                          {p.actividades.slice(0, 2).map((act) => (
                            <div key={act.id} className="text-[11px] bg-gray-50 border border-gray-200 rounded px-2 py-1">
                              <span className="font-bold text-gray-800 block truncate">{act.nombre}</span>
                              <span className="text-gray-500 font-medium">
                                🏢 {act.recinto || 'Sede Central'} · {new Date(act.horario_inicio).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          ))}
                          {p.actividades.length > 2 && (
                            <span className="text-[10px] text-purple-600 font-bold">
                              +{p.actividades.length - 2} actividades más
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Sin ponencias asignadas</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => {
                            setCurrent(p);
                            setIsEditOpen(true);
                          }}
                          className="px-2.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold rounded-lg transition"
                        >
                          ✏️ Editar
                        </button>
                        <button
                          onClick={() => handleDelete(p.usuario_id, `${p.nombre} ${p.apellido}`)}
                          className="px-2.5 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 text-xs font-bold rounded-lg transition"
                          title="Dar de baja presentador"
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

        {/* VISTA MÓVIL (< sm): TARJETAS OPTIMIZADAS */}
        <div className="block sm:hidden divide-y divide-gray-100">
          {loading ? (
            <div className="p-6 text-center text-sm text-gray-500">
              Cargando nómina de expositores...
            </div>
          ) : presentadores.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-400">
              No se encontraron presentadores registrados.
            </div>
          ) : (
            presentadores.map((p) => (
              <div key={p.usuario_id} className="p-4 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-purple-100 text-purple-700 font-extrabold flex items-center justify-center text-xs shrink-0 ring-2 ring-purple-50">
                      {p.nombre?.[0]}{p.apellido?.[0]}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 text-sm">{p.nombre} {p.apellido}</h4>
                      <span className="inline-block px-1.5 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded text-[10px] font-semibold">
                        {p.rol_nombre || 'Expositor'}
                      </span>
                    </div>
                  </div>
                  <span className="inline-flex items-center justify-center px-2 py-0.5 bg-blue-50 text-blue-800 rounded font-bold text-xs shrink-0">
                    {p.total_actividades} charla(s)
                  </span>
                </div>

                <div className="text-xs text-gray-600 space-y-1">
                  <div>📧 {p.email}</div>
                  <div>🆔 DNI: {p.dni_pasaporte} · 📱 {p.celular}</div>
                  {p.institucion_bio && (
                    <div className="text-gray-500">🏛️ {p.institucion_bio}</div>
                  )}
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-gray-100">
                  <button
                    onClick={() => {
                      setCurrent(p);
                      setIsEditOpen(true);
                    }}
                    className="flex-1 py-1.5 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold text-center transition"
                  >
                    ✏️ Editar
                  </button>
                  <button
                    onClick={() => handleDelete(p.usuario_id, `${p.nombre} ${p.apellido}`)}
                    className="py-1.5 px-3 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-semibold text-center transition"
                    title="Dar de baja presentador"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* MODAL NUEVO PRESENTADOR */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="text-base font-extrabold text-gray-900">Registrar Nuevo Presentador</h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-gray-700">Nombre</label>
                  <input
                    type="text"
                    required
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    className="w-full mt-1 px-3 py-2 text-xs border rounded-lg outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700">Apellido</label>
                  <input
                    type="text"
                    required
                    value={formData.apellido}
                    onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                    className="w-full mt-1 px-3 py-2 text-xs border rounded-lg outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700">Email Oficial</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-xs border rounded-lg outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-gray-700">DNI o Pasaporte</label>
                  <input
                    type="text"
                    required
                    value={formData.dni_pasaporte}
                    onChange={(e) => setFormData({ ...formData, dni_pasaporte: e.target.value })}
                    className="w-full mt-1 px-3 py-2 text-xs border rounded-lg outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700">Teléfono Celular</label>
                  <input
                    type="text"
                    required
                    value={formData.celular}
                    onChange={(e) => setFormData({ ...formData, celular: e.target.value })}
                    className="w-full mt-1 px-3 py-2 text-xs border rounded-lg outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700">Institución / Filiación / Bio</label>
                <input
                  type="text"
                  placeholder="Ej: DETS - Laboratorio de Ciberseguridad IFTS 04"
                  value={formData.institucion}
                  onChange={(e) => setFormData({ ...formData, institucion: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-xs border rounded-lg outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-xs"
                >
                  Guardar Presentador
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDITAR PRESENTADOR */}
      {isEditOpen && current && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="text-base font-extrabold text-gray-900">Modificar Presentador</h3>
              <button onClick={() => setIsEditOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-gray-700">Nombre</label>
                  <input
                    type="text"
                    required
                    value={current.nombre}
                    onChange={(e) => setCurrent({ ...current, nombre: e.target.value })}
                    className="w-full mt-1 px-3 py-2 text-xs border rounded-lg outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700">Apellido</label>
                  <input
                    type="text"
                    required
                    value={current.apellido}
                    onChange={(e) => setCurrent({ ...current, apellido: e.target.value })}
                    className="w-full mt-1 px-3 py-2 text-xs border rounded-lg outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700">Email Oficial</label>
                <input
                  type="email"
                  required
                  value={current.email}
                  onChange={(e) => setCurrent({ ...current, email: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-xs border rounded-lg outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700">Teléfono Celular</label>
                <input
                  type="text"
                  required
                  value={current.celular}
                  onChange={(e) => setCurrent({ ...current, celular: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-xs border rounded-lg outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700">Filiación Institucional</label>
                <input
                  type="text"
                  value={current.institucion_bio || ''}
                  onChange={(e) => setCurrent({ ...current, institucion_bio: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-xs border rounded-lg outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-xs"
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
