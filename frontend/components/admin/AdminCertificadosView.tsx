'use client';

import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { CertificadoEntity } from './types';
import AdminCertificadoEditorModal from './AdminCertificadoEditorModal';

interface Props {
  onNotice: (msg: string) => void;
}

export default function AdminCertificadosView({ onNotice }: Props) {
  const [certificados, setCertificados] = useState<CertificadoEntity[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [tipo, setTipo] = useState('');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [formData, setFormData] = useState({
    usuario_id: '',
    tipo_certificado: 'ASISTENCIA',
  });

  async function loadCertificados(queryOverride?: string) {
    setLoading(true);
    try {
      const activeQ = queryOverride !== undefined ? queryOverride : q;
      const params = new URLSearchParams();
      if (activeQ) params.set('q', activeQ);
      if (tipo) params.set('tipo', tipo);

      const res = await fetch(`/api/admin/certificados?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setCertificados(data.certificados || []);
      }
    } catch (err) {
      console.error('Error cargando certificados:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCertificados();
  }, [tipo]);

  async function handleEmitir(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/certificados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dni_pasaporte: formData.usuario_id,
          usuario_id: formData.usuario_id,
          tipo_certificado: formData.tipo_certificado,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        await Swal.fire({
          title: '¡Certificado Emitido!',
          text: `Certificado ${data.certificado.codigo_verificacion} emitido exitosamente.`,
          icon: 'success',
          confirmButtonColor: '#005691',
        });
        onNotice(`Certificado ${data.certificado.codigo_verificacion} emitido exitosamente.`);
        setIsCreateOpen(false);
        setFormData({ usuario_id: '', tipo_certificado: 'ASISTENCIA' });
        loadCertificados();
      } else {
        await Swal.fire({
          title: 'Error al Emitir',
          text: data.message || 'Error al emitir certificado',
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

  async function handleEnviarCorreo(id: number | string, nombre: string) {
    const confirmRes = await Swal.fire({
      title: '¿Enviar Certificado?',
      text: `¿Deseas enviar el diploma oficial por correo electrónico al asistente ${nombre}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, enviar diploma',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#005691',
      cancelButtonColor: '#6c757d',
    });
    if (!confirmRes.isConfirmed) return;

    try {
      const res = await fetch(`/api/admin/certificados/${id}/enviar-correo`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.ok) {
        await Swal.fire({
          title: '¡Certificado Enviado!',
          text: data.mensaje || 'Certificado despachado con éxito por correo.',
          icon: 'success',
          confirmButtonColor: '#005691',
        });
        onNotice(data.mensaje || 'Certificado despachado con éxito por correo.');
      } else {
        await Swal.fire({
          title: 'Error de Envío',
          text: data.message || data.error || 'Error al enviar certificado por correo.',
          icon: 'error',
          confirmButtonColor: '#dc3545',
        });
      }
    } catch {
      await Swal.fire({
        title: 'Error de Conexión',
        text: 'Error de conexión al servidor.',
        icon: 'error',
        confirmButtonColor: '#dc3545',
      });
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row gap-3 justify-between items-center">
        <div className="flex flex-wrap gap-2 w-full sm:w-auto flex-1">
          <div className="relative w-full sm:w-84">
            <input
              type="text"
              placeholder="Buscar por Código de verificación, DNI o Nombre de Asistente..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadCertificados()}
              className="w-full pl-3 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
            {q && (
              <button
                type="button"
                onClick={() => {
                  setQ('');
                  loadCertificados('');
                }}
                title="Limpiar búsqueda"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 font-bold text-xs p-1 rounded-full hover:bg-gray-100 transition"
              >
                ✕
              </button>
            )}
          </div>

          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">Todas las Constancias</option>
            <option value="ASISTENCIA">Asistencia General</option>
            <option value="TALLER">Aprobación de Taller</option>
          </select>

          <button
            onClick={() => loadCertificados()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition"
          >
            🔍 Buscar
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setIsEditorOpen(true)}
            style={{
              backgroundColor: '#6366f1',
              color: '#ffffff',
            }}
            className="px-3.5 py-2 hover:bg-indigo-700 font-semibold rounded-lg text-sm transition flex items-center gap-1.5 shadow-sm cursor-pointer border border-indigo-500"
            title="Abre el Editor Visual WYSIWYG interactivo para diseñar y modificar los textos, autoridades y estilo del diploma"
          >
            <span style={{ color: '#ffffff' }}>🎨 Diseñar / Editar Plantilla (WYSIWYG)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              window.open('/api/admin/reportes/certificados.zip', '_blank');
              onNotice('Generando y empaquetando en streaming el archivo ZIP con todos los diplomas PDF oficiales...');
            }}
            style={{
              backgroundColor: '#2563eb',
              color: '#ffffff',
            }}
            className="px-3.5 py-2 hover:bg-blue-700 font-semibold rounded-lg text-sm transition flex items-center gap-1.5 shadow-sm cursor-pointer border border-blue-500"
            title="Genera en streaming todos los PDFs de certificados emitidos y los comprime en un ZIP"
          >
            <span style={{ color: '#ffffff' }}>📦 Descargar Diplomas (ZIP)</span>
          </button>
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            style={{
              backgroundColor: '#16a34a',
              color: '#ffffff',
            }}
            className="px-4 py-2 hover:bg-green-700 font-semibold rounded-lg text-sm transition flex items-center gap-1 shadow-sm cursor-pointer border border-green-500"
          >
            <span style={{ color: '#ffffff' }}>➕ Emitir Certificado a Asistente</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm text-gray-700">
            <thead className="bg-gray-50 text-xs uppercase font-bold text-gray-500 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3">Código Oficial</th>
                <th className="px-4 py-3">Asistente / Estudiante</th>
                <th className="px-4 py-3">DNI</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Constancia</th>
                <th className="px-4 py-3">Fecha de Emisión</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    Cargando certificados emitidos...
                  </td>
                </tr>
              ) : certificados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    No se encontraron certificados emitidos.
                  </td>
                </tr>
              ) : (
                certificados.map((c) => {
                  const nombreAsistente = `${c.nombre || c.usuario_nombre || ''} ${c.apellido || c.usuario_apellido || ''}`.trim() || 'Sin nombre registrado';
                  const nombreConstancia =
                    c.tipo_certificado === 'TALLER'
                      ? 'Constancia de Aprobación de Taller'
                      : `Constancia Oficial de Asistencia (${c.horas_catedra || 16} hs cátedra)`;

                  return (
                    <tr key={c.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 font-mono font-bold text-xs text-blue-700">{c.codigo_verificacion}</td>
                      <td className="px-4 py-3 font-semibold text-gray-900">
                        {nombreAsistente}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">{c.dni_pasaporte}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 text-xs font-semibold bg-blue-50 text-blue-800 rounded">
                          {c.tipo_certificado}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs font-medium text-gray-700">
                        {nombreConstancia}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 font-mono">
                        {new Date(c.emitido_en).toLocaleDateString('es-AR')}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <a
                          href={`/api/admin/certificados/download/${c.codigo_verificacion}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 bg-green-50 text-green-700 hover:bg-green-100 rounded text-xs font-semibold inline-flex items-center gap-1 transition"
                          title="Descargar PDF Oficial"
                        >
                          📄 Descargar PDF
                        </a>
                        <button
                          onClick={() => handleEnviarCorreo(c.id, nombreAsistente)}
                          className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-xs font-semibold inline-flex items-center gap-1 transition ml-1.5 cursor-pointer"
                          title="Enviar Certificado y Diploma en PDF por Correo"
                        >
                          ✉️ Enviar Correo
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Emitir Certificado para Asistente/Estudiante */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-gray-900">➕ Emisión de Certificado (Asistente / Estudiante)</h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold cursor-pointer">
                ✕
              </button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800 space-y-1">
              <p className="font-bold flex items-center gap-1">
                <span>ℹ️</span>
                <span>Exclusivo para Asistentes y Estudiantes</span>
              </p>
              <p className="text-blue-700">
                A los usuarios del sistema (operadores y administradores) no se les emiten diplomas desde esta plataforma.
              </p>
            </div>

            <form onSubmit={handleEmitir} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">DNI del Asistente o Estudiante *</label>
                <input
                  type="text"
                  required
                  placeholder="Ingrese DNI del asistente o estudiante (ej: 99574180)"
                  value={formData.usuario_id}
                  onChange={(e) => setFormData({ ...formData, usuario_id: e.target.value.trim() })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Tipo de Certificación Académica</label>
                <select
                  value={formData.tipo_certificado}
                  onChange={(e) => setFormData({ ...formData, tipo_certificado: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="ASISTENCIA">Constancia Oficial de Asistencia General (16 hs cátedra)</option>
                  <option value="TALLER">Constancia de Aprobación de Taller Específico</option>
                </select>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold shadow cursor-pointer"
                >
                  Emitir Certificado
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editor Visual WYSIWYG de Certificados */}
      <AdminCertificadoEditorModal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        onSaved={(msg) => onNotice(msg)}
      />
    </div>
  );
}
