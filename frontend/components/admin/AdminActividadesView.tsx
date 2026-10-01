'use client';

import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { ActividadEntity, CatalogosConsolidados } from './types';

interface Props {
  catalogos: CatalogosConsolidados | null;
  onNotice: (msg: string) => void;
}

export default function AdminActividadesView({ catalogos, onNotice }: Props) {
  const [actividades, setActividades] = useState<ActividadEntity[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [activoFiltro, setActivoFiltro] = useState('');
  const [fechaFiltro, setFechaFiltro] = useState(''); // '' = Todas las fechas, o 'YYYY-MM-DD'
  const [viewMode, setViewMode] = useState<'tabla' | 'grilla'>('tabla');

  // Modales Estándar
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [current, setCurrent] = useState<ActividadEntity | null>(null);
  const [editConflictNotice, setEditConflictNotice] = useState<string | null>(null);

  // Modal Política A: Desplazamiento de Horario
  const [isDesplazarOpen, setIsDesplazarOpen] = useState(false);
  const [desplazarAct, setDesplazarAct] = useState<ActividadEntity | null>(null);
  const [desplazarDelta, setDesplazarDelta] = useState<number>(15);
  const [desplazarModo, setDesplazarModo] = useState<'delta' | 'manual'>('delta');
  const [customInicio, setCustomInicio] = useState('');
  const [customFin, setCustomFin] = useState('');
  const [desplazarConflict, setDesplazarConflict] = useState<string | null>(null);

  // Selección múltiple para acciones batch
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Modal Política B: Reasignación de Recinto
  const [isRecintoOpen, setIsRecintoOpen] = useState(false);
  const [recintoAct, setRecintoAct] = useState<ActividadEntity | null>(null);
  const [nuevoRecintoId, setNuevoRecintoId] = useState<number>(1);
  const [recintoConflict, setRecintoConflict] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    tipo_acreditacion_id: 1,
    punto_acceso_id: 1,
    cupo_maximo: 50,
    horario_inicio: '2026-11-06T09:00',
    horario_fin: '2026-11-06T10:30',
    disertante_nombre: '',
    disertante_usuario_id: '' as string | null,
    activo: true,
  });

  async function loadActividades(queryOverride?: string) {
    setLoading(true);
    try {
      const activeQ = queryOverride !== undefined ? queryOverride : q;
      const params = new URLSearchParams();
      if (activeQ) params.set('q', activeQ);
      if (activoFiltro) params.set('activo', activoFiltro);
      if (fechaFiltro) params.set('fecha', fechaFiltro);

      const res = await fetch(`/api/admin/actividades?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setActividades(data.actividades || []);
      }
    } catch (err) {
      console.error('Error cargando actividades:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadActividades();
    setSelectedIds([]);
  }, [activoFiltro, fechaFiltro]);

  function handleSelectAll(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.checked) {
      setSelectedIds(actividades.map((a) => a.id));
    } else {
      setSelectedIds([]);
    }
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  async function handleBatchAction(action: 'activate' | 'deactivate' | 'delete') {
    if (selectedIds.length === 0) return;

    const actionText =
      action === 'activate'
        ? 'activar'
        : action === 'deactivate'
        ? 'desactivar'
        : 'eliminar / archivar';

    const confirmRes = await Swal.fire({
      title: `¿${actionText.toUpperCase()} ${selectedIds.length} actividades?`,
      text: `¿Confirma que desea ${actionText} las actividades seleccionadas?`,
      icon: action === 'delete' ? 'warning' : 'question',
      showCancelButton: true,
      confirmButtonText: `Sí, ${actionText}`,
      cancelButtonText: 'Cancelar',
      confirmButtonColor: action === 'delete' ? '#dc3545' : '#005691',
    });

    if (!confirmRes.isConfirmed) return;

    try {
      const res = await fetch('/api/admin/actividades/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds, action }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        onNotice(data.message || 'Operación en lote procesada exitosamente.');
        setSelectedIds([]);
        loadActividades();
      } else {
        await Swal.fire({
          title: 'Error en Lote',
          text: data.message || 'No se pudo procesar la acción por lotes',
          icon: 'error',
          confirmButtonColor: '#dc3545',
        });
      }
    } catch {
      await Swal.fire({
        title: 'Error de Conexión',
        text: 'Error al contactar con el servidor.',
        icon: 'error',
        confirmButtonColor: '#dc3545',
      });
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/actividades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evento_id: 1,
          ...formData,
          disertante_usuario_id: formData.disertante_usuario_id?.trim() || null,
          disertante_nombre: formData.disertante_nombre?.trim() || null,
          horario_inicio: new Date(formData.horario_inicio).toISOString(),
          horario_fin: new Date(formData.horario_fin).toISOString(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        onNotice('Actividad creada exitosamente.');
        setIsCreateOpen(false);
        loadActividades();
      } else if (res.status === 409) {
        await Swal.fire({
          title: 'Conflicto Espacio-Temporal',
          text: data.message || 'El recinto o disertante ya se encuentra ocupado en esa franja horaria.',
          icon: 'warning',
          confirmButtonColor: '#005691',
        });
      } else {
        let errorMsg = data.message || data.error || 'Error al crear actividad';
        if (data.details) {
          const detailMsgs: string[] = [];
          Object.entries(data.details).forEach(([key, val]: [string, any]) => {
            if (val && Array.isArray(val._errors) && val._errors.length > 0) {
              detailMsgs.push(`${key}: ${val._errors.join(', ')}`);
            }
          });
          if (detailMsgs.length > 0) {
            errorMsg = detailMsgs.join('\n');
          }
        }
        await Swal.fire({
          title: 'Error al Crear',
          text: errorMsg,
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
    setEditConflictNotice(null);
    try {
      const res = await fetch(`/api/admin/actividades/${current.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: current.nombre,
          descripcion: current.descripcion,
          tipo_acreditacion_id: current.tipo_acreditacion_id,
          punto_acceso_id: current.punto_acceso_id,
          cupo_maximo: current.cupo_maximo,
          disertante_nombre: current.disertante_nombre,
          disertante_usuario_id: current.disertante_usuario_id || null,
          horario_inicio: new Date(current.horario_inicio).toISOString(),
          horario_fin: new Date(current.horario_fin).toISOString(),
          activo: current.activo,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        onNotice('Actividad actualizada.');
        setIsEditOpen(false);
        setCurrent(null);
        loadActividades();
      } else if (res.status === 409) {
        setEditConflictNotice(data.message || 'Conflicto detectado en la asignación horaria.');
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

  // POLÍTICA A: Manejador de Desplazamiento de Horario
  async function handleDesplazarSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!desplazarAct) return;
    setDesplazarConflict(null);

    const payload =
      desplazarModo === 'delta'
        ? { delta_minutos: desplazarDelta }
        : {
            nuevo_horario_inicio: new Date(customInicio).toISOString(),
            nuevo_horario_fin: new Date(customFin).toISOString(),
          };

    try {
      const res = await fetch(`/api/admin/actividades/${desplazarAct.id}/desplazar-horario`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (res.ok && data.ok) {
        onNotice(data.mensaje || 'Horario desplazado con éxito.');
        setIsDesplazarOpen(false);
        setDesplazarAct(null);
        loadActividades();
      } else if (res.status === 409) {
        setDesplazarConflict(data.message || 'Conflicto: el recinto ya está ocupado en ese nuevo horario.');
      } else {
        await Swal.fire({
          title: 'Error al Desplazar Horario',
          text: data.message || 'Error al desplazar horario',
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

  // POLÍTICA B: Manejador de Cambio de Recinto
  async function handleRecintoSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!recintoAct) return;
    setRecintoConflict(null);

    try {
      const res = await fetch(`/api/admin/actividades/${recintoAct.id}/cambiar-recinto`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nuevo_punto_acceso_id: nuevoRecintoId }),
      });
      const data = await res.json();

      if (res.ok && data.ok) {
        onNotice(data.mensaje || 'Recinto reasignado exitosamente.');
        setIsRecintoOpen(false);
        setRecintoAct(null);
        loadActividades();
      } else if (res.status === 409) {
        setRecintoConflict(data.message || 'El recinto de destino ya se encuentra ocupado en ese horario.');
      } else {
        await Swal.fire({
          title: 'Error al Reasignar Recinto',
          text: data.message || 'Error al reasignar recinto',
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
      title: '¿Eliminar o desactivar?',
      text: `¿Deseas eliminar o desactivar la actividad "${nombre}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
    });
    if (!confirmRes.isConfirmed) return;

    try {
      const res = await fetch(`/api/admin/actividades/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.ok) {
        onNotice(data.mensaje || 'Actividad removida.');
        loadActividades();
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

  function openDesplazar(a: ActividadEntity) {
    setDesplazarAct(a);
    setDesplazarConflict(null);
    setDesplazarDelta(15);
    setDesplazarModo('delta');
    setCustomInicio(new Date(a.horario_inicio).toISOString().slice(0, 16));
    setCustomFin(new Date(a.horario_fin).toISOString().slice(0, 16));
    setIsDesplazarOpen(true);
  }

  function openRecinto(a: ActividadEntity) {
    setRecintoAct(a);
    setRecintoConflict(null);
    setNuevoRecintoId(a.punto_acceso_id);
    setIsRecintoOpen(true);
  }

  // Derivar jornadas disponibles a partir del evento o de las actividades cargadas
  const fechasDisponibles: string[] = React.useMemo(() => {
    const datesSet = new Set<string>();
    // Agregar fecha del evento si existe
    if (actividades.length > 0 && actividades[0].evento_fecha_inicio) {
      datesSet.add(actividades[0].evento_fecha_inicio);
      if (actividades[0].evento_fecha_fin) {
        datesSet.add(actividades[0].evento_fecha_fin);
      }
    }
    // Agregar todas las fechas presentes en las actividades
    actividades.forEach((a) => {
      if (a.fecha_actividad) {
        datesSet.add(a.fecha_actividad);
      } else if (a.horario_inicio) {
        datesSet.add(new Date(a.horario_inicio).toISOString().slice(0, 10));
      }
    });
    return Array.from(datesSet).sort();
  }, [actividades]);

  // Lista de salas/recintos para la vista grilla
  const salasDisponibles = React.useMemo(() => {
    return catalogos?.puntos_acceso?.filter((p) => p.activo) || [];
  }, [catalogos]);

  return (
    <div className="space-y-4">
      {/* Barra de Filtros y Selector de Jornada */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
          <div className="flex flex-wrap gap-2 w-full sm:w-auto flex-1">
            <div className="relative w-full sm:w-72">
              <input
                type="text"
                placeholder="Buscar por Título, Ponente o Aula..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadActividades()}
                className="w-full pl-3 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => {
                    setQ('');
                    loadActividades('');
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
              <option value="">Todas las Actividades</option>
              <option value="true">Activas</option>
              <option value="false">Inactivas</option>
            </select>

            <button
              onClick={() => loadActividades()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition"
            >
              🔍 Buscar
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {/* Toggle de Modo de Vista */}
            <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-50">
              <button
                type="button"
                onClick={() => setViewMode('tabla')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 ${
                  viewMode === 'tabla'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <span>📋</span> Lista
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grilla')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 ${
                  viewMode === 'grilla'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <span>📅</span> Grilla & Salas
              </button>
            </div>

            <button
              onClick={() => setIsCreateOpen(true)}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition flex items-center gap-1 shadow-sm"
            >
              ➕ Nueva Actividad
            </button>
          </div>
        </div>

        {/* Selector de Jornada / Fecha Multidía */}
        <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mr-1">
            📅 Jornada / Fecha:
          </span>
          <button
            type="button"
            onClick={() => setFechaFiltro('')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
              fechaFiltro === ''
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Todas las Fechas
          </button>
          {fechasDisponibles.map((f, idx) => {
            const dateObj = new Date(f + 'T00:00:00');
            const labelDia = isNaN(dateObj.getTime())
              ? f
              : dateObj.toLocaleDateString('es-AR', {
                  weekday: 'short',
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                });
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFechaFiltro(f)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1 ${
                  fechaFiltro === f
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span className="opacity-70">Día {idx + 1}:</span>
                <span className="capitalize">{labelDia}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Barra de Acciones Batch */}
      {selectedIds.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 p-3 rounded-xl flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="font-semibold text-indigo-900">
            {selectedIds.length} actividad(es) seleccionada(s)
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleBatchAction('activate')}
              className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
            >
              ✅ Activar
            </button>
            <button
              onClick={() => handleBatchAction('deactivate')}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
            >
              ⏸️ Desactivar
            </button>
            <button
              onClick={() => handleBatchAction('delete')}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
            >
              🗑️ Eliminar / Archivar
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg text-xs font-semibold shadow-xs transition"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* VISTA 1: TABLA CLÁSICA */}
      {viewMode === 'tabla' ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-gray-700">
              <thead className="bg-gray-50 text-xs uppercase font-bold text-gray-500 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={
                        actividades.length > 0 && selectedIds.length === actividades.length
                      }
                      onChange={handleSelectAll}
                      className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-3">Actividad</th>
                  <th className="px-4 py-3">Disertante</th>
                  <th className="px-4 py-3">Recinto / Sala</th>
                  <th className="px-4 py-3">Fecha y Horario</th>
                  <th className="px-4 py-3 text-center">Cupo</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones Políticas & Edición</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                      Cargando cronograma de actividades...
                    </td>
                  </tr>
                ) : actividades.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                      No se encontraron actividades registradas para los criterios seleccionados.
                    </td>
                  </tr>
                ) : (
                  actividades.map((a) => {
                    const dtInicio = new Date(a.horario_inicio);
                    const dtFin = new Date(a.horario_fin);
                    const fechaStr = !isNaN(dtInicio.getTime())
                      ? dtInicio.toLocaleDateString('es-AR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })
                      : '';
                    const horaInicioStr = !isNaN(dtInicio.getTime())
                      ? dtInicio.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
                      : '';
                    const horaFinStr = !isNaN(dtFin.getTime())
                      ? dtFin.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
                      : '';

                    return (
                      <tr key={a.id} className="hover:bg-gray-50 transition">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(a.id)}
                            onChange={() => toggleSelect(a.id)}
                            className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-gray-900">{a.nombre}</div>
                          <div className="text-xs text-gray-400 line-clamp-1">{a.descripcion}</div>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-800">
                          <span className="inline-flex items-center gap-1">
                            <span>🎤</span> {a.disertante_nombre}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-700 font-semibold">
                          <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded border border-gray-200">
                            <span>🏢</span> {a.punto_acceso_nombre || 'Sin asignar'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="inline-flex items-center gap-1 text-xs font-semibold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 mb-0.5">
                            <span>📅</span> {fechaStr}
                          </div>
                          <div className="font-mono text-xs text-gray-600">
                            {horaInicioStr} - {horaFinStr}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-blue-700">
                          {a.cupo_maximo}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`px-2 py-0.5 text-xs font-bold rounded ${
                              a.activo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {a.activo ? 'Vigente' : 'Inactiva'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1 flex-wrap">
                            {/* POLÍTICA A: Botón Desplazar Horario */}
                            <button
                              onClick={() => openDesplazar(a)}
                              className="px-2 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded text-xs font-semibold"
                              title="Política A: Desplazar horario en el tiempo verificando ausencia de solapamiento en el recinto"
                            >
                              ⏱️ Desplazar
                            </button>

                            {/* POLÍTICA B: Botón Cambiar Recinto */}
                            <button
                              onClick={() => openRecinto(a)}
                              className="px-2 py-1 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded text-xs font-semibold"
                              title="Política B: Reasignar recinto verificando no colisión en recinto destino"
                            >
                              🏢 Recinto
                            </button>

                            <button
                              onClick={() => {
                                window.open(`/api/admin/reportes/actividades/${a.id}/firmas.csv`, '_blank');
                                onNotice(`Descargando planilla de firmas para: ${a.nombre}`);
                              }}
                              className="px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded text-xs font-semibold"
                              title="Descargar planilla de firmas de asistencia"
                            >
                              📋 Firmas
                            </button>
                            <button
                              onClick={() => {
                                setCurrent(a);
                                setEditConflictNotice(null);
                                setIsEditOpen(true);
                              }}
                              className="px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-xs font-semibold"
                            >
                              ✏️ Editar
                            </button>
                            <button
                              onClick={() => handleDelete(a.id, a.nombre)}
                              className="px-2 py-1 bg-red-50 text-red-700 hover:bg-red-100 rounded text-xs font-semibold"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* VISTA 2: GRILLA MATRIZ DE CRONOGRAMA & SALAS POR DÍA */
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b pb-3">
            <div>
              <h3 className="font-extrabold text-gray-900 text-base flex items-center gap-2">
                <span>📅</span> Cronograma Espacio-Temporal por Salas
              </h3>
              <p className="text-xs text-gray-500">
                Visualización matricial de recintos vs. franjas horarias {fechaFiltro ? `(Filtrado por: ${fechaFiltro})` : '(Todas las fechas)'}
              </p>
            </div>
            <div className="text-xs text-gray-500 flex items-center gap-2">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block"></span> Vigente
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block"></span> Inactiva
              </span>
            </div>
          </div>

          {salasDisponibles.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              No hay salas o puntos de acceso configurados en el catálogo.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {salasDisponibles.map((sala) => {
                const actsDeSala = actividades.filter(
                  (a) => a.punto_acceso_id === sala.id
                );

                return (
                  <div
                    key={sala.id}
                    className="border border-gray-200 rounded-xl overflow-hidden bg-slate-50 flex flex-col"
                  >
                    <div className="bg-slate-800 text-white px-3 py-2.5 flex justify-between items-center">
                      <div>
                        <div className="font-bold text-xs flex items-center gap-1">
                          <span>🏢</span> {sala.nombre}
                        </div>
                        <div className="text-[10px] text-slate-300">
                          {sala.ubicacion_fisica}
                        </div>
                      </div>
                      <span className="text-[10px] bg-slate-700 px-2 py-0.5 rounded font-mono">
                        Cap. {sala.capacidad_maxima}
                      </span>
                    </div>

                    <div className="p-2 space-y-2 flex-1">
                      {actsDeSala.length === 0 ? (
                        <div className="text-center py-6 text-gray-400 text-xs italic">
                          Sin actividades programadas
                        </div>
                      ) : (
                        actsDeSala.map((act) => {
                          const dtInicio = new Date(act.horario_inicio);
                          const dtFin = new Date(act.horario_fin);
                          const fStr = !isNaN(dtInicio.getTime())
                            ? dtInicio.toLocaleDateString('es-AR', {
                                day: '2-digit',
                                month: '2-digit',
                              })
                            : '';
                          const hInicio = !isNaN(dtInicio.getTime())
                            ? dtInicio.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
                            : '';
                          const hFin = !isNaN(dtFin.getTime())
                            ? dtFin.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
                            : '';

                          return (
                            <div
                              key={act.id}
                              className={`p-2.5 rounded-lg border text-xs shadow-2xs transition ${
                                act.activo
                                  ? 'bg-white border-blue-200 hover:border-blue-400'
                                  : 'bg-red-50 border-red-200 opacity-70'
                              }`}
                            >
                              <div className="flex justify-between items-start gap-1 mb-1">
                                <span className="font-mono text-[11px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                                  📅 {fStr} · {hInicio} - {hFin}
                                </span>
                                <span
                                  className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                    act.activo
                                      ? 'bg-green-100 text-green-700'
                                      : 'bg-red-100 text-red-700'
                                  }`}
                                >
                                  {act.activo ? 'Vigente' : 'Inactiva'}
                                </span>
                              </div>
                              <div className="font-bold text-gray-900 line-clamp-2">
                                {act.nombre}
                              </div>
                              <div className="text-gray-600 text-[11px] mt-0.5 flex items-center gap-1">
                                <span>🎤</span> {act.disertante_nombre}
                              </div>
                              <div className="mt-2 pt-1.5 border-t border-gray-100 flex justify-between items-center text-[10px]">
                                <span className="text-gray-500 font-semibold">
                                  Cupo: {act.cupo_maximo}
                                </span>
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => openDesplazar(act)}
                                    className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded hover:bg-indigo-100 font-medium"
                                    title="Desplazar Horario"
                                  >
                                    ⏱️
                                  </button>
                                  <button
                                    onClick={() => openRecinto(act)}
                                    className="px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded hover:bg-purple-100 font-medium"
                                    title="Reasignar Recinto"
                                  >
                                    🏢
                                  </button>
                                  <button
                                    onClick={() => {
                                      setCurrent(act);
                                      setEditConflictNotice(null);
                                      setIsEditOpen(true);
                                    }}
                                    className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 font-medium"
                                    title="Editar"
                                  >
                                    ✏️
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL POLÍTICA A: DESPLAZAMIENTO DE HORARIO */}
      {isDesplazarOpen && desplazarAct && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="text-base font-extrabold text-gray-900">⏱️ Desplazar Horario (Política A)</h3>
                <p className="text-xs text-gray-500">
                  Recinto: <span className="font-bold text-gray-800">{desplazarAct.punto_acceso_nombre || 'Recinto Actual'}</span>
                </p>
              </div>
              <button onClick={() => setIsDesplazarOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold">
                ✕
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-gray-200 text-xs">
              <span className="font-bold text-gray-800 block truncate">{desplazarAct.nombre}</span>
              <div className="text-gray-600 mt-1">
                Horario Actual: {new Date(desplazarAct.horario_inicio).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} a {new Date(desplazarAct.horario_fin).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>

            {/* Banner de Conflicto de Solapamiento */}
            {desplazarConflict && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 space-y-1">
                <div className="font-extrabold flex items-center gap-1.5">
                  <span>🚫</span> Conflicto Espacio-Temporal Detectado
                </div>
                <p>{desplazarConflict}</p>
                <p className="text-[11px] text-red-600">
                  La Política A impide solapar dos actividades en el mismo recinto. Ajusta el horario a una franja libre.
                </p>
              </div>
            )}

            <form onSubmit={handleDesplazarSubmit} className="space-y-4">
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setDesplazarModo('delta')}
                  className={`flex-1 py-1.5 font-bold rounded-lg border ${
                    desplazarModo === 'delta' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 text-gray-700'
                  }`}
                >
                  Por Minutos (Delta)
                </button>
                <button
                  type="button"
                  onClick={() => setDesplazarModo('manual')}
                  className={`flex-1 py-1.5 font-bold rounded-lg border ${
                    desplazarModo === 'manual' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 text-gray-700'
                  }`}
                >
                  Hora Manual
                </button>
              </div>

              {desplazarModo === 'delta' ? (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-gray-700">Desplazamiento Temporal</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[-30, -15, 15, 30, 45, 60].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => setDesplazarDelta(mins)}
                        className={`py-1.5 text-xs font-bold rounded-lg border transition ${
                          desplazarDelta === mins
                            ? 'bg-indigo-100 border-indigo-500 text-indigo-800 ring-2 ring-indigo-200'
                            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {mins > 0 ? `+${mins}m` : `${mins}m`}
                      </button>
                    ))}
                  </div>
                  <div className="pt-2">
                    <label className="text-[11px] text-gray-500 block mb-1">O especifica minutos exactos:</label>
                    <input
                      type="number"
                      value={desplazarDelta}
                      onChange={(e) => setDesplazarDelta(parseInt(e.target.value, 10) || 0)}
                      className="w-full px-3 py-1.5 border rounded-lg text-xs"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Nuevo Inicio</label>
                    <input
                      type="datetime-local"
                      required
                      value={customInicio}
                      onChange={(e) => setCustomInicio(e.target.value)}
                      className="w-full px-3 py-1.5 border rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Nuevo Fin</label>
                    <input
                      type="datetime-local"
                      required
                      value={customFin}
                      onChange={(e) => setCustomFin(e.target.value)}
                      className="w-full px-3 py-1.5 border rounded-lg text-xs"
                    />
                  </div>
                </div>
              )}

              <div className="pt-3 flex justify-end gap-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsDesplazarOpen(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs"
                >
                  Validar y Desplazar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL POLÍTICA B: REASIGNACIÓN DE RECINTO */}
      {isRecintoOpen && recintoAct && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="text-base font-extrabold text-gray-900">🏢 Cambiar Recinto (Política B)</h3>
                <p className="text-xs text-gray-500">Reubicar la actividad verificando no colisión en destino</p>
              </div>
              <button onClick={() => setIsRecintoOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold">
                ✕
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-gray-200 text-xs">
              <span className="font-bold text-gray-800 block truncate">{recintoAct.nombre}</span>
              <div className="text-gray-600 mt-1">
                Horario: {new Date(recintoAct.horario_inicio).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} a {new Date(recintoAct.horario_fin).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className="text-gray-500 mt-0.5">
                Recinto Actual: <span className="font-semibold text-gray-700">{recintoAct.punto_acceso_nombre || 'Sin Asignar'}</span>
              </div>
            </div>

            {/* Banner de Conflicto de Recinto Destino */}
            {recintoConflict && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 space-y-1">
                <div className="font-extrabold flex items-center gap-1.5">
                  <span>🚫</span> Recinto Ocupado en ese Horario
                </div>
                <p>{recintoConflict}</p>
                <p className="text-[11px] text-red-600">
                  La Política B exige que el recinto de destino esté completamente libre durante toda la franja del evento.
                </p>
              </div>
            )}

            <form onSubmit={handleRecintoSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Seleccionar Recinto de Destino</label>
                <select
                  value={nuevoRecintoId}
                  onChange={(e) => setNuevoRecintoId(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 border rounded-lg text-xs focus:ring-2 focus:ring-purple-500 outline-none"
                >
                  {catalogos?.puntos_acceso.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} ({p.ubicacion_fisica}) · Capacidad: {p.capacidad_maxima} pers.
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsRecintoOpen(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold shadow-xs"
                >
                  Verificar y Reasignar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Crear */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-gray-900">➕ Nueva Actividad / Ponencia</h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Nombre de la Actividad *</label>
                <input
                  type="text"
                  required
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Disertante / Expositor * <span className="text-gray-400 font-normal">(Base de Datos)</span>
                </label>
                <select
                  value={formData.disertante_usuario_id || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) {
                      setFormData({ ...formData, disertante_usuario_id: null, disertante_nombre: '' });
                    } else if (val === '__OTRO__') {
                      setFormData({ ...formData, disertante_usuario_id: null });
                    } else {
                      const found = catalogos?.disertantes?.find((d) => d.id === val);
                      if (found) {
                        setFormData({
                          ...formData,
                          disertante_usuario_id: found.id,
                          disertante_nombre: `${found.nombre} ${found.apellido}`.trim(),
                        });
                      }
                    }
                  }}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium"
                >
                  <option value="">-- Seleccionar Disertante Registrado --</option>
                  {catalogos?.disertantes?.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.apellido}, {d.nombre} ({d.rol_nombre} · DNI: {d.dni_pasaporte})
                    </option>
                  ))}
                  <option value="__OTRO__">➕ Otro / Disertante Externo Invitado...</option>
                </select>

                {(!formData.disertante_usuario_id || formData.disertante_usuario_id === '__OTRO__') && (
                  <div className="mt-2">
                    <input
                      type="text"
                      required
                      placeholder="Ingrese Nombre y Apellido del disertante externo..."
                      value={formData.disertante_nombre}
                      onChange={(e) => setFormData({ ...formData, disertante_nombre: e.target.value })}
                      className="w-full px-3 py-2 border border-amber-300 bg-amber-50/50 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                    <p className="text-[11px] text-amber-700 mt-0.5">
                      ⚠️ Al ser disertante libre, se validará que no se solape con ninguna otra actividad bajo este mismo nombre.
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Recinto / Sala</label>
                  <select
                    value={formData.punto_acceso_id}
                    onChange={(e) => setFormData({ ...formData, punto_acceso_id: parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {catalogos?.puntos_acceso.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre} ({p.ubicacion_fisica})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Cupo Máximo</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={formData.cupo_maximo}
                    onChange={(e) => setFormData({ ...formData, cupo_maximo: parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Horario Inicio</label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.horario_inicio}
                    onChange={(e) => setFormData({ ...formData, horario_inicio: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Horario Fin</label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.horario_fin}
                    onChange={(e) => setFormData({ ...formData, horario_fin: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
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

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="crear_actividad_activo"
                  checked={formData.activo}
                  onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                  className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <label htmlFor="crear_actividad_activo" className="text-xs font-semibold text-gray-700 select-none cursor-pointer">
                  Actividad activa y visible en el cronograma público
                </label>
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
                  Crear Actividad
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
              <h3 className="text-lg font-bold text-gray-900">✏️ Editar Actividad</h3>
              <button onClick={() => setIsEditOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold">
                ✕
              </button>
            </div>

            {/* Banner de Conflicto en Edición */}
            {editConflictNotice && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 space-y-1">
                <div className="font-extrabold flex items-center gap-1.5">
                  <span>🚫</span> Conflicto Espacio-Temporal
                </div>
                <p>{editConflictNotice}</p>
              </div>
            )}

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
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Disertante / Expositor * <span className="text-gray-400 font-normal">(Base de Datos)</span>
                </label>
                <select
                  value={current.disertante_usuario_id || (catalogos?.disertantes?.some((d) => `${d.nombre} ${d.apellido}`.toLowerCase() === current.disertante_nombre.toLowerCase()) ? catalogos.disertantes.find((d) => `${d.nombre} ${d.apellido}`.toLowerCase() === current.disertante_nombre.toLowerCase())?.id : '__OTRO__') || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) {
                      setCurrent({ ...current, disertante_usuario_id: null, disertante_nombre: '' });
                    } else if (val === '__OTRO__') {
                      setCurrent({ ...current, disertante_usuario_id: null });
                    } else {
                      const found = catalogos?.disertantes?.find((d) => d.id === val);
                      if (found) {
                        setCurrent({
                          ...current,
                          disertante_usuario_id: found.id,
                          disertante_nombre: `${found.nombre} ${found.apellido}`.trim(),
                        });
                      }
                    }
                  }}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium"
                >
                  <option value="">-- Seleccionar Disertante Registrado --</option>
                  {catalogos?.disertantes?.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.apellido}, {d.nombre} ({d.rol_nombre} · DNI: {d.dni_pasaporte})
                    </option>
                  ))}
                  <option value="__OTRO__">➕ Otro / Disertante Externo Invitado...</option>
                </select>

                {(!current.disertante_usuario_id || current.disertante_usuario_id === '__OTRO__') && (
                  <div className="mt-2">
                    <input
                      type="text"
                      required
                      placeholder="Nombre y Apellido del disertante externo..."
                      value={current.disertante_nombre}
                      onChange={(e) => setCurrent({ ...current, disertante_nombre: e.target.value })}
                      className="w-full px-3 py-2 border border-amber-300 bg-amber-50/50 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                    <p className="text-[11px] text-amber-700 mt-0.5">
                      ⚠️ Al ser disertante libre, se validará que no se solape con ninguna otra actividad bajo este mismo nombre.
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Recinto / Sala</label>
                  <select
                    value={current.punto_acceso_id}
                    onChange={(e) => setCurrent({ ...current, punto_acceso_id: parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {catalogos?.puntos_acceso.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Cupo Máximo</label>
                  <input
                    type="number"
                    required
                    value={current.cupo_maximo}
                    onChange={(e) => setCurrent({ ...current, cupo_maximo: parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Horario Inicio</label>
                  <input
                    type="datetime-local"
                    required
                    value={current.horario_inicio ? new Date(current.horario_inicio).toISOString().slice(0, 16) : ''}
                    onChange={(e) => setCurrent({ ...current, horario_inicio: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Horario Fin</label>
                  <input
                    type="datetime-local"
                    required
                    value={current.horario_fin ? new Date(current.horario_fin).toISOString().slice(0, 16) : ''}
                    onChange={(e) => setCurrent({ ...current, horario_fin: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="editar_actividad_activo"
                  checked={current.activo}
                  onChange={(e) => setCurrent({ ...current, activo: e.target.checked })}
                  className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <label htmlFor="editar_actividad_activo" className="text-xs font-semibold text-gray-700 select-none cursor-pointer">
                  Actividad activa y visible en el cronograma público
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
