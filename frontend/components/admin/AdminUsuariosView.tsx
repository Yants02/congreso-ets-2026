'use client';

import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { UsuarioEntity, CatalogosConsolidados } from './types';

// Fallback canónico de estados de inscripción según base de datos
const ESTADOS_DEFAULT = [
  { id: 1, codigo: 'CONFIRMADO', nombre: 'Confirmado' },
  { id: 2, codigo: 'LISTA_ESPERA', nombre: 'Lista de Espera' },
  { id: 3, codigo: 'BAJA_AUTOMATICA', nombre: 'Baja Automática 48hs' },
  { id: 4, codigo: 'CANCELADO', nombre: 'Cancelado' },
  { id: 5, codigo: 'SANCIONADO', nombre: 'Sancionado' },
];

// Estados admitidos únicamente para el rol "Estudiante" (id: 1)
const ESTADOS_ESTUDIANTE_EXCLUSIVOS = ['LISTA_ESPERA', 'BAJA_AUTOMATICA', 'SANCIONADO'];
const ESTADOS_ESTUDIANTE_EXCLUSIVOS_IDS = [2, 3, 5];

interface Props {
  catalogos: CatalogosConsolidados | null;
  onNotice: (msg: string) => void;
}

export default function AdminUsuariosView({ catalogos, onNotice }: Props) {
  const [usuarios, setUsuarios] = useState<UsuarioEntity[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState('');
  const [rol, setRol] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  // Lista consolidada de estados (desde catálogo o fallback seguro)
  const listaEstados = catalogos?.estados && catalogos.estados.length > 0 ? catalogos.estados : ESTADOS_DEFAULT;

  // Filtrar estados admitidos según rol: solo 'Estudiante' (id: 1) admite Lista de espera, Baja automática y Sancionado
  function getEstadosParaRol(rolId: number) {
    if (Number(rolId) === 1) {
      return listaEstados;
    }
    return listaEstados.filter(
      (e) => !ESTADOS_ESTUDIANTE_EXCLUSIVOS.includes(e.codigo) && !ESTADOS_ESTUDIANTE_EXCLUSIVOS_IDS.includes(e.id)
    );
  }

  // Selección múltiple para acciones batch
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modales
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Form State
  const [formData, setFormData] = useState({
    dni_pasaporte: '',
    nombre: '',
    apellido: '',
    email: '',
    celular: '',
    rol_principal_id: 1,
    estado_id: 1, // CONFIRMADO (id: 1) por defecto para admin
    superadmin_override: true,
  });

  async function loadUsuarios(queryOverride?: string, pageOverride?: number) {
    setLoading(true);
    try {
      const activeQ = queryOverride !== undefined ? queryOverride : q;
      const activePage = pageOverride !== undefined ? pageOverride : page;
      const params = new URLSearchParams();
      if (activeQ) params.set('q', activeQ);
      if (estado) params.set('estado', estado);
      if (rol) params.set('rol', rol);
      params.set('page', activePage.toString());
      params.set('limit', limit.toString());

      const res = await fetch(`/api/admin/usuarios?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setUsuarios(data.usuarios || []);
        setTotal(data.total_registros || data.total || 0);
      }
    } catch (err) {
      console.error('Error cargando usuarios:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsuarios();
  }, [page, estado, rol]);

  function handleSelectAll(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.checked) {
      setSelectedIds(usuarios.map((u) => u.id));
    } else {
      setSelectedIds([]);
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  // Guardar Nuevo Usuario
  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        Swal.fire({
          icon: 'success',
          title: 'Registrado con Éxito',
          text: 'Participante registrado exitosamente en el sistema.',
          confirmButtonColor: '#005691',
        });
        onNotice('Participante registrado exitosamente.');
        setIsCreateOpen(false);
        setFormData({
          dni_pasaporte: '',
          nombre: '',
          apellido: '',
          email: '',
          celular: '',
          rol_principal_id: 1,
          estado_id: 1,
          superadmin_override: true,
        });
        loadUsuarios();
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Error al Registrar',
          text: data.message || data.error || 'Error al registrar usuario',
          confirmButtonColor: '#005691',
        });
      }
    } catch {
      Swal.fire({
        icon: 'error',
        title: 'Fallo de Conexión',
        text: 'Error de conexión con el servidor.',
        confirmButtonColor: '#005691',
      });
    }
  }

  // Guardar Edición
  async function handleUpdateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUser) return;
    try {
      const res = await fetch(`/api/admin/usuarios/${currentUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: currentUser.nombre,
          apellido: currentUser.apellido,
          email: currentUser.email,
          celular: currentUser.celular,
          rol_principal_id: currentUser.rol_principal_id,
          estado_id: listaEstados.find((s) => s.codigo === currentUser.estado_codigo)?.id,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        Swal.fire({
          icon: 'success',
          title: 'Actualizado',
          text: 'Participante actualizado correctamente.',
          confirmButtonColor: '#005691',
          timer: 2000,
        });
        onNotice('Participante actualizado correctamente.');
        setIsEditOpen(false);
        setCurrentUser(null);
        loadUsuarios();
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Error al Actualizar',
          text: data.message || 'Error al actualizar usuario',
          confirmButtonColor: '#005691',
        });
      }
    } catch {
      Swal.fire({
        icon: 'error',
        title: 'Fallo de Conexión',
        text: 'Error de conexión con el servidor.',
        confirmButtonColor: '#005691',
      });
    }
  }

  // Eliminar Usuario
  async function handleDeleteUser(id: string, nombreCompleto: string) {
    const confirmRes = await Swal.fire({
      title: '¿Eliminar Participante?',
      text: `¿Confirma eliminar a "${nombreCompleto}" del sistema? Se borrarán sus credenciales e inscripciones asociadas.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, eliminar participante',
      cancelButtonText: 'Cancelar',
    });

    if (!confirmRes.isConfirmed) return;

    try {
      const res = await fetch(`/api/admin/usuarios/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.ok) {
        Swal.fire({
          icon: 'success',
          title: 'Eliminado',
          text: 'Participante eliminado correctamente.',
          confirmButtonColor: '#005691',
          timer: 2000,
        });
        onNotice('Participante eliminado correctamente.');
        loadUsuarios();
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Error al Eliminar',
          text: data.message || 'Error al eliminar participante',
          confirmButtonColor: '#005691',
        });
      }
    } catch {
      Swal.fire({
        icon: 'error',
        title: 'Fallo de Conexión',
        text: 'Error de conexión con el servidor.',
        confirmButtonColor: '#005691',
      });
    }
  }

  // Promover de lista de espera
  async function handlePromover(id: string) {
    const confirmRes = await Swal.fire({
      title: '¿Promover Participante?',
      text: '¿Deseas promover a este participante a estado CONFIRMADO (Vacante Asignada)?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#005691',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, promover',
      cancelButtonText: 'Cancelar',
    });

    if (!confirmRes.isConfirmed) return;

    try {
      const res = await fetch('/api/admin/usuarios/promover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario_id: id, motivo: 'Promoción administrativa' }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        Swal.fire({
          icon: 'success',
          title: 'Promovido',
          text: data.mensaje || 'Participante promovido exitosamente.',
          confirmButtonColor: '#005691',
        });
        onNotice(data.mensaje || 'Participante promovido.');
        loadUsuarios();
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Error al Promover',
          text: data.message || 'Error al promover participante',
          confirmButtonColor: '#005691',
        });
      }
    } catch {
      Swal.fire({
        icon: 'error',
        title: 'Fallo de Conexión',
        text: 'Error de conexión.',
        confirmButtonColor: '#005691',
      });
    }
  }

  // Acciones Batch
  async function handleBatchAction(action: 'CONFIRMAR' | 'CANCELAR' | 'LISTA_ESPERA' | 'SANCIONAR' | 'ELIMINAR') {
    if (selectedIds.length === 0) {
      Swal.fire({
        icon: 'info',
        title: 'Selección Requerida',
        text: 'Seleccione al menos un participante para la acción en lote.',
        confirmButtonColor: '#005691',
      });
      return;
    }

    // Restricción de negocio: Solo rol Estudiante admite LISTA_ESPERA y SANCIONAR
    if (action === 'LISTA_ESPERA' || action === 'SANCIONAR') {
      const selectedUsers = usuarios.filter((u) => selectedIds.includes(u.id));
      const nonEstudiantes = selectedUsers.filter((u) => {
        const rolId = (u as any).rol_principal_id || (u as any).rol_id;
        return Number(rolId) !== 1 && u.rol_nombre !== 'Estudiante';
      });

      if (nonEstudiantes.length > 0) {
        const nombres = nonEstudiantes.map((u) => `${u.nombre} ${u.apellido} (${u.rol_nombre})`).slice(0, 3).join(', ');
        Swal.fire({
          icon: 'warning',
          title: 'Rol No Admitido',
          text: `Los estados "Lista de espera" y "Sancionados" solo aplican a participantes con rol "Estudiante". No admitidos: ${nombres}${nonEstudiantes.length > 3 ? '...' : ''}`,
          confirmButtonColor: '#005691',
        });
        return;
      }
    }

    const isSancion = action === 'SANCIONAR';
    const isDestructive = action === 'ELIMINAR' || action === 'CANCELAR' || isSancion;

    const confirmRes = await Swal.fire({
      title: isSancion ? '¿Sancionar Participantes?' : `¿Aplicar Acción "${action}"?`,
      text: isSancion
        ? `¿Confirma aplicar sanción disciplinaria, mover a categoría Sancionados e incorporar a Lista Negra a los ${selectedIds.length} participantes seleccionados?`
        : `¿Confirma aplicar la acción masiva "${action}" a los ${selectedIds.length} participantes seleccionados?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: isSancion ? '#e11d48' : isDestructive ? '#dc3545' : '#005691',
      cancelButtonColor: '#6c757d',
      confirmButtonText: isSancion ? 'Sí, sancionar e incorporar a Lista Negra' : 'Sí, ejecutar acción masiva',
      cancelButtonText: 'Cancelar',
    });

    if (!confirmRes.isConfirmed) return;

    try {
      const res = await fetch('/api/admin/usuarios/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ids: selectedIds }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        Swal.fire({
          icon: 'success',
          title: 'Acción Completada',
          text: data.message || `Acción masiva aplicada a ${data.processed} registros.`,
          confirmButtonColor: '#005691',
        });
        onNotice(data.message || `Acción masiva aplicada a ${data.processed} registros.`);
        setSelectedIds([]);
        loadUsuarios();
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Error al Procesar Lote',
          text: data.message || 'Error al procesar lote',
          confirmButtonColor: '#005691',
        });
      }
    } catch {
      Swal.fire({
        icon: 'error',
        title: 'Fallo de Conexión',
        text: 'Error de conexión con el servidor.',
        confirmButtonColor: '#005691',
      });
    }
  }

  const totalPages = Math.ceil(total / limit) || 1;

  async function handleExportPadron() {
    try {
      window.open('/api/admin/reportes/padron.csv', '_blank');
      onNotice('Descargando Padrón oficial en formato CSV compatible con Excel...');
    } catch {
      Swal.fire({
        icon: 'error',
        title: 'Error de Descarga',
        text: 'Error al descargar el padrón.',
        confirmButtonColor: '#005691',
      });
    }
  }

  async function handleReenviarCredencial(id: string, nombre: string) {
    const confirmRes = await Swal.fire({
      title: '¿Reenviar Credencial?',
      text: `¿Reenviar credencial oficial y código QR por correo a ${nombre}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#005691',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, reenviar correo',
      cancelButtonText: 'Cancelar',
    });

    if (!confirmRes.isConfirmed) return;

    try {
      const res = await fetch(`/api/admin/usuarios/${id}/reenviar-credencial`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.ok) {
        Swal.fire({
          icon: 'success',
          title: 'Credencial Reenviada',
          text: data.mensaje || `Credencial y código QR reenviados con éxito a ${nombre}`,
          confirmButtonColor: '#005691',
        });
        onNotice(data.mensaje || 'Credencial reenviada por correo exitosamente.');
      } else {
        Swal.fire({
          icon: 'error',
          title: 'No se Pudo Entregar el Correo',
          text: data.message || data.error || 'Error al reenviar credencial.',
          confirmButtonColor: '#005691',
        });
      }
    } catch {
      Swal.fire({
        icon: 'error',
        title: 'Fallo de Conexión',
        text: 'Error de conexión al servidor.',
        confirmButtonColor: '#005691',
      });
    }
  }

  return (
    <div className="space-y-4">
      {/* Barra Superior: Búsqueda, Filtros y Acciones */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-3 justify-between items-center">
        <div className="flex flex-wrap gap-2 w-full md:w-auto flex-1">
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="Buscar por DNI, Nombre, Apellido o Email..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (setPage(1), loadUsuarios())}
              className="w-full pl-3 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
            {q && (
              <button
                type="button"
                onClick={() => {
                  setQ('');
                  setPage(1);
                  loadUsuarios('', 1);
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
            onChange={(e) => {
              setEstado(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">Todos los Estados</option>
            {listaEstados.map((est) => (
              <option key={est.id} value={est.codigo}>
                {est.nombre}
              </option>
            ))}
          </select>

          <select
            value={rol}
            onChange={(e) => {
              setRol(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">Todos los Roles</option>
            {(catalogos?.roles_participantes || catalogos?.roles.filter((r) => r.jerarquia <= 4 && !['Operador', 'Verificador', 'Administrador', 'Superadmin'].includes(r.nombre)))?.map((r) => (
              <option key={r.id} value={r.id.toString()}>
                {r.nombre}
              </option>
            ))}
          </select>

          <button
            onClick={() => {
              setPage(1);
              loadUsuarios();
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition"
          >
            🔍 Buscar
          </button>
        </div>

        <div className="flex flex-wrap gap-2 w-full md:w-auto justify-end">
          <button
            onClick={handleExportPadron}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition flex items-center gap-1.5 shadow-sm"
          >
            📥 Exportar Padrón CSV
          </button>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition flex items-center gap-1 shadow-sm"
          >
            ➕ Nuevo Participante
          </button>
        </div>
      </div>

      {/* Barra de Acciones Batch */}
      {selectedIds.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="font-semibold text-blue-900">
            {selectedIds.length} participante(s) seleccionado(s)
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleBatchAction('CONFIRMAR')}
              className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-semibold"
            >
              Confirmar Vacantes
            </button>
            <button
              onClick={() => handleBatchAction('LISTA_ESPERA')}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-semibold"
            >
              Mover a Espera
            </button>
            <button
              onClick={() => handleBatchAction('CANCELAR')}
              className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-xs font-semibold"
            >
              Cancelar
            </button>
            <button
              onClick={() => handleBatchAction('SANCIONAR')}
              className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-semibold flex items-center gap-1"
              title="Mover a categoría Sancionados e incorporar a Lista Negra"
            >
              <span>🚫</span>
              <span>Sancionar</span>
            </button>
            <button
              onClick={() => handleBatchAction('ELIMINAR')}
              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold"
            >
              Eliminar
            </button>
          </div>
        </div>
      )}

      {/* Tabla de Usuarios */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm text-gray-700">
            <thead className="bg-gray-50 text-xs uppercase font-bold text-gray-500 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={usuarios.length > 0 && selectedIds.length === usuarios.length}
                    onChange={handleSelectAll}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="px-4 py-3">Participante</th>
                <th className="px-4 py-3">DNI / Pasaporte</th>
                <th className="px-4 py-3">Contacto</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-center">Accesos</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    Cargando listado de participantes...
                  </td>
                </tr>
              ) : usuarios.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    No se encontraron participantes con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                usuarios.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(u.id)}
                        onChange={() => toggleSelect(u.id)}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900">
                        {u.nombre} {u.apellido}
                      </div>
                      <div className="text-xs text-gray-400">
                        Reg: {new Date(u.creado_en).toLocaleDateString('es-AR')}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{u.dni_pasaporte}</td>
                    <td className="px-4 py-3 text-xs">
                      <div>{u.email}</div>
                      {u.celular && <div className="text-gray-400">{u.celular}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1 items-center">
                        <span className="px-2 py-0.5 text-xs font-semibold bg-gray-100 text-gray-800 rounded">
                          {u.rol_nombre}
                        </span>
                        {u.roles_adicionales && (
                          <span
                            className="px-1.5 py-0.5 text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded"
                            title={`Roles adicionales: ${u.roles_adicionales}`}
                          >
                            +{u.roles_adicionales}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 text-xs font-bold rounded ${
                          u.estado_codigo === 'CONFIRMADO'
                            ? 'bg-green-100 text-green-800'
                            : u.estado_codigo === 'LISTA_ESPERA'
                            ? 'bg-amber-100 text-amber-800'
                            : u.estado_codigo === 'BAJA_AUTOMATICA'
                            ? 'bg-orange-100 text-orange-800 border border-orange-200'
                            : u.estado_codigo === 'SANCIONADO'
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {u.estado_codigo === 'SANCIONADO' ? '🚫 ' : u.estado_codigo === 'BAJA_AUTOMATICA' ? '⏰ ' : ''}
                        {u.estado_nombre || listaEstados.find((e) => e.codigo === u.estado_codigo)?.nombre || u.estado_codigo}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-gray-800">
                      {u.ingresos_totales || 0}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end items-center gap-1">
                        {u.estado_codigo === 'LISTA_ESPERA' && (
                          <button
                            onClick={() => handlePromover(u.id)}
                            className="px-2 py-1 bg-green-50 text-green-700 hover:bg-green-100 rounded text-xs font-semibold transition"
                            title="Promover a Confirmado"
                          >
                            ⭐ Promover
                          </button>
                        )}
                        <a
                          href={`/mi-credencial?dni=${encodeURIComponent(u.dni_pasaporte)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-1 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded text-xs font-semibold transition flex items-center gap-1"
                          title="Ver Credencial Digital y Código QR"
                        >
                          🪪 QR
                        </a>
                        <button
                          onClick={() => handleReenviarCredencial(u.id, `${u.nombre} ${u.apellido}`)}
                          className="px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-xs font-semibold transition flex items-center gap-1"
                          title="Reenviar Credencial y Código QR por Correo"
                        >
                          ✉️ Correo
                        </button>
                        <button
                          onClick={() => {
                            setCurrentUser(u);
                            setIsEditOpen(true);
                          }}
                          className="px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-xs font-semibold transition"
                        >
                          ✏️ Editar
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u.id, `${u.nombre} ${u.apellido}`)}
                          className="px-2 py-1 bg-red-50 text-red-700 hover:bg-red-100 rounded text-xs font-semibold transition"
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

        {/* Paginación */}
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
          <div>
            Total: <span className="font-bold text-gray-700">{total}</span> participantes
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

      {/* MODAL: ALTA DE PARTICIPANTE */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-gray-900">➕ Nuevo Participante (Alta Manual)</h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">DNI / Pasaporte *</label>
                  <input
                    type="text"
                    required
                    value={formData.dni_pasaporte}
                    onChange={(e) => setFormData({ ...formData, dni_pasaporte: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Teléfono Móvil</label>
                  <input
                    type="text"
                    value={formData.celular}
                    onChange={(e) => setFormData({ ...formData, celular: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

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
                <label className="block text-xs font-semibold text-gray-700 mb-1">Correo Electrónico *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Rol Principal</label>
                  <select
                    value={formData.rol_principal_id}
                    onChange={(e) => {
                      const newRolId = parseInt(e.target.value, 10);
                      const isEst = newRolId === 1;
                      const currentSelectedEst = listaEstados.find((s) => s.id === formData.estado_id);
                      const isCurrentRestricted = currentSelectedEst && (ESTADOS_ESTUDIANTE_EXCLUSIVOS.includes(currentSelectedEst.codigo) || ESTADOS_ESTUDIANTE_EXCLUSIVOS_IDS.includes(currentSelectedEst.id));
                      setFormData({
                        ...formData,
                        rol_principal_id: newRolId,
                        estado_id: !isEst && isCurrentRestricted ? 1 : formData.estado_id,
                      });
                    }}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {(catalogos?.roles_participantes || catalogos?.roles.filter((r) => r.jerarquia <= 4 && !['Operador', 'Verificador', 'Administrador', 'Superadmin'].includes(r.nombre)))?.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Estado de Admisión</label>
                  <select
                    value={formData.estado_id}
                    onChange={(e) => setFormData({ ...formData, estado_id: parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {getEstadosParaRol(formData.rol_principal_id).map((est) => (
                      <option key={est.id} value={est.id}>
                        {est.nombre}
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
                  Registrar Participante
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDICIÓN DE PARTICIPANTE */}
      {isEditOpen && currentUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-gray-900">✏️ Editar Participante</h3>
              <button
                onClick={() => {
                  setIsEditOpen(false);
                  setCurrentUser(null);
                }}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Nombre</label>
                  <input
                    type="text"
                    required
                    value={currentUser.nombre}
                    onChange={(e) => setCurrentUser({ ...currentUser, nombre: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Apellido</label>
                  <input
                    type="text"
                    required
                    value={currentUser.apellido}
                    onChange={(e) => setCurrentUser({ ...currentUser, apellido: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={currentUser.email}
                    onChange={(e) => setCurrentUser({ ...currentUser, email: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Celular</label>
                  <input
                    type="text"
                    value={currentUser.celular || ''}
                    onChange={(e) => setCurrentUser({ ...currentUser, celular: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Rol</label>
                  <select
                    value={currentUser.rol_principal_id}
                    onChange={(e) => {
                      const newRolId = parseInt(e.target.value, 10);
                      const isEst = newRolId === 1;
                      const isCurrentRestricted = ESTADOS_ESTUDIANTE_EXCLUSIVOS.includes(currentUser.estado_codigo);
                      setCurrentUser({
                        ...currentUser,
                        rol_principal_id: newRolId,
                        estado_codigo: !isEst && isCurrentRestricted ? 'CONFIRMADO' : currentUser.estado_codigo,
                      });
                    }}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {(catalogos?.roles_participantes || catalogos?.roles.filter((r) => r.jerarquia <= 4 && !['Operador', 'Verificador', 'Administrador', 'Superadmin'].includes(r.nombre)))?.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Estado de Admisión</label>
                  <select
                    value={currentUser.estado_codigo}
                    onChange={(e) => setCurrentUser({ ...currentUser, estado_codigo: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {getEstadosParaRol(currentUser.rol_principal_id).map((est) => (
                      <option key={est.id} value={est.codigo}>
                        {est.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditOpen(false);
                    setCurrentUser(null);
                  }}
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
