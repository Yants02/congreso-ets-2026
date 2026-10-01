'use client';

import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';

export interface PlantillaConfig {
  membrete: {
    linea1: string;
    linea2: string;
    linea3: string;
  };
  titulos: {
    asistencia: string;
    expositor: string;
  };
  cuerpo: {
    formula_intro: string;
    formula_evento: string;
    nombre_congreso: string;
    leyenda_fechas_horas: string;
  };
  firmas: {
    autoridad1_nombre: string;
    autoridad1_cargo: string;
    autoridad1_entidad: string;
    autoridad2_nombre: string;
    autoridad2_cargo: string;
    autoridad2_entidad: string;
    sello_texto_superior: string;
    sello_texto_inferior: string;
  };
  colores: {
    primario: string;
    primario_oscuro: string;
    dorado: string;
    texto_oscuro: string;
  };
}

const DEFAULT_PLANTILLA: PlantillaConfig = {
  membrete: {
    linea1: 'GOBIERNO DE LA CIUDAD AUTÓNOMA DE BUENOS AIRES',
    linea2: 'MINISTERIO DE EDUCACIÓN · DIRECCIÓN DE EDUCACIÓN TÉCNICA SUPERIOR (DETS)',
    linea3: 'INSTITUTO DE FORMACIÓN TÉCNICA SUPERIOR N° 04 · SEDE POLO EDUCATIVO SAAVEDRA',
  },
  titulos: {
    asistencia: 'CERTIFICADO OFICIAL DE ASISTENCIA Y PARTICIPACIÓN',
    expositor: 'CERTIFICADO OFICIAL DE DISERTANTE / EXPOSITOR',
  },
  cuerpo: {
    formula_intro: 'Por cuanto se certifica con validez académica institucional que:',
    formula_evento: 'ha participado y acreditado su asistencia presencial en las actividades académicas del',
    nombre_congreso: '1er CONGRESO DE EDUCACIÓN TÉCNICA SUPERIOR – ETS 2026',
    leyenda_fechas_horas:
      'Llevado a cabo los días 15, 16 y 17 de Octubre de 2026 en el Auditorio Polo Saavedra, con una carga horaria total de {{HORAS}} horas cátedra.',
  },
  firmas: {
    autoridad1_nombre: 'Lic. Alejandro Rodríguez',
    autoridad1_cargo: 'Director de Educación Técnica Superior',
    autoridad1_entidad: 'Ministerio de Educación · GCABA',
    autoridad2_nombre: 'Prof. Mariana Gómez',
    autoridad2_cargo: 'Rectora Instituto Superior N° 04',
    autoridad2_entidad: 'Comité Académico Organizador',
    sello_texto_superior: 'DETS',
    sello_texto_inferior: 'GCABA',
  },
  colores: {
    primario: '#005691',
    primario_oscuro: '#003865',
    dorado: '#f39c12',
    texto_oscuro: '#2c3e50',
  },
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (msg: string) => void;
}

export default function AdminCertificadoEditorModal({ isOpen, onClose, onSaved }: Props) {
  const [plantilla, setPlantilla] = useState<PlantillaConfig>(DEFAULT_PLANTILLA);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [activeTab, setActiveTab] = useState<'membrete' | 'cuerpo' | 'firmas' | 'colores'>('membrete');
  const [previewTipo, setPreviewTipo] = useState<'ASISTENCIA' | 'EXPOSITOR'>('ASISTENCIA');

  async function cargarPlantilla() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/certificados/plantilla');
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.plantilla) {
          setPlantilla(data.plantilla);
        }
      }
    } catch (err) {
      console.error('Error al cargar plantilla:', err);
    } finally {
      setLoading(false);
    }
  }

  // Cargar configuración existente
  useEffect(() => {
    if (isOpen) {
      cargarPlantilla();
    }
  }, [isOpen]);

  async function handleGuardar() {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/certificados/plantilla', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(plantilla),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        await Swal.fire({
          title: '¡Plantilla Guardada!',
          text: 'Los cambios se aplicaron exitosamente a todos los nuevos certificados.',
          icon: 'success',
          confirmButtonColor: '#005691',
        });
        onSaved('Plantilla oficial de certificados actualizada correctamente.');
        onClose();
      } else {
        await Swal.fire({
          title: 'Error al Guardar',
          text: data.message || 'No se pudo guardar la plantilla',
          icon: 'error',
          confirmButtonColor: '#dc3545',
        });
      }
    } catch {
      await Swal.fire({
        title: 'Error de Red',
        text: 'Error de conexión con el servidor al guardar la plantilla.',
        icon: 'error',
        confirmButtonColor: '#dc3545',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDescargarPreview() {
    setDownloadingPdf(true);
    try {
      const res = await fetch('/api/admin/certificados/plantilla/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plantilla, tipo_certificado: previewTipo }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Certificado_Preview_${previewTipo}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
      } else {
        await Swal.fire({
          title: 'Error',
          text: 'No se pudo generar el PDF de muestra.',
          icon: 'error',
          confirmButtonColor: '#dc3545',
        });
      }
    } catch (err) {
      console.error(err);
      await Swal.fire({
        title: 'Error',
        text: 'Error generando PDF.',
        icon: 'error',
        confirmButtonColor: '#dc3545',
      });
    } finally {
      setDownloadingPdf(false);
    }
  }

  function handleRestablecer() {
    Swal.fire({
      title: '¿Restablecer Valores?',
      text: 'Se restaurarán todos los textos y colores predeterminados oficiales.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, restablecer',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#f39c12',
      cancelButtonColor: '#6c757d',
    }).then((r) => {
      if (r.isConfirmed) {
        setPlantilla(DEFAULT_PLANTILLA);
      }
    });
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-7xl rounded-2xl shadow-2xl border border-gray-200 flex flex-col max-h-[96vh] overflow-hidden">
        {/* Cabecera del Modal */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-900 to-indigo-900 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-xl">
              🎨
            </div>
            <div>
              <h2 className="text-lg font-bold">Editor Visual WYSIWYG de Certificados Oficiales</h2>
              <p className="text-xs text-blue-200">
                Personalice en tiempo real los textos, autoridades, membrete y estilo del diploma oficial
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDescargarPreview}
              disabled={downloadingPdf}
              className="px-3.5 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5"
              title="Descarga el documento PDF real generado por el motor vectorial"
            >
              {downloadingPdf ? '⏳ Generando...' : '📄 Descargar PDF de Muestra'}
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-gray-200 transition"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Cuerpo Dividido (Split View: Formulario Izq + Lienzo Der) */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Panel Izquierdo: Formularios de Edición */}
          <div className="w-full lg:w-5/12 border-r border-gray-200 flex flex-col bg-gray-50 overflow-y-auto">
            {/* Selector de Pestañas de Edición */}
            <div className="flex border-b border-gray-200 bg-white px-2 pt-2 gap-1 shrink-0 overflow-x-auto">
              <button
                onClick={() => setActiveTab('membrete')}
                className={`px-3 py-2 text-xs font-bold rounded-t-lg transition border-b-2 ${
                  activeTab === 'membrete'
                    ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                🏛️ Membrete
              </button>
              <button
                onClick={() => setActiveTab('cuerpo')}
                className={`px-3 py-2 text-xs font-bold rounded-t-lg transition border-b-2 ${
                  activeTab === 'cuerpo'
                    ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                📜 Cuerpo y Textos
              </button>
              <button
                onClick={() => setActiveTab('firmas')}
                className={`px-3 py-2 text-xs font-bold rounded-t-lg transition border-b-2 ${
                  activeTab === 'firmas'
                    ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                ✍️ Firmas y Sello
              </button>
              <button
                onClick={() => setActiveTab('colores')}
                className={`px-3 py-2 text-xs font-bold rounded-t-lg transition border-b-2 ${
                  activeTab === 'colores'
                    ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                🎨 Paleta de Color
              </button>
            </div>

            {/* Contenido de Formularios según Pestaña */}
            <div className="p-4 space-y-4 flex-1">
              {loading ? (
                <div className="py-12 text-center text-gray-400 text-sm">Cargando plantilla...</div>
              ) : (
                <>
                  {activeTab === 'membrete' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Línea 1: Jurisdicción Superior
                        </label>
                        <input
                          type="text"
                          value={plantilla.membrete.linea1}
                          onChange={(e) =>
                            setPlantilla({
                              ...plantilla,
                              membrete: { ...plantilla.membrete, linea1: e.target.value },
                            })
                          }
                          className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Línea 2: Ministerio y Dirección General
                        </label>
                        <input
                          type="text"
                          value={plantilla.membrete.linea2}
                          onChange={(e) =>
                            setPlantilla({
                              ...plantilla,
                              membrete: { ...plantilla.membrete, linea2: e.target.value },
                            })
                          }
                          className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Línea 3: Instituto / Entidad Académica Emisora
                        </label>
                        <input
                          type="text"
                          value={plantilla.membrete.linea3}
                          onChange={(e) =>
                            setPlantilla({
                              ...plantilla,
                              membrete: { ...plantilla.membrete, linea3: e.target.value },
                            })
                          }
                          className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                        />
                      </div>
                      <div className="pt-2 border-t border-gray-200">
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Título: Certificado de Asistencia
                        </label>
                        <input
                          type="text"
                          value={plantilla.titulos.asistencia}
                          onChange={(e) =>
                            setPlantilla({
                              ...plantilla,
                              titulos: { ...plantilla.titulos, asistencia: e.target.value },
                            })
                          }
                          className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Título: Certificado de Expositor / Disertante
                        </label>
                        <input
                          type="text"
                          value={plantilla.titulos.expositor}
                          onChange={(e) =>
                            setPlantilla({
                              ...plantilla,
                              titulos: { ...plantilla.titulos, expositor: e.target.value },
                            })
                          }
                          className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                        />
                      </div>
                    </div>
                  )}

                  {activeTab === 'cuerpo' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Fórmula de Certificación Introductoria
                        </label>
                        <input
                          type="text"
                          value={plantilla.cuerpo.formula_intro}
                          onChange={(e) =>
                            setPlantilla({
                              ...plantilla,
                              cuerpo: { ...plantilla.cuerpo, formula_intro: e.target.value },
                            })
                          }
                          className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Fórmula de Participación en Actividades
                        </label>
                        <input
                          type="text"
                          value={plantilla.cuerpo.formula_evento}
                          onChange={(e) =>
                            setPlantilla({
                              ...plantilla,
                              cuerpo: { ...plantilla.cuerpo, formula_evento: e.target.value },
                            })
                          }
                          className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Denominación Oficial del Congreso / Jornada
                        </label>
                        <input
                          type="text"
                          value={plantilla.cuerpo.nombre_congreso}
                          onChange={(e) =>
                            setPlantilla({
                              ...plantilla,
                              cuerpo: { ...plantilla.cuerpo, nombre_congreso: e.target.value },
                            })
                          }
                          className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Leyenda de Fechas, Sede y Carga Horaria
                        </label>
                        <textarea
                          rows={3}
                          value={plantilla.cuerpo.leyenda_fechas_horas}
                          onChange={(e) =>
                            setPlantilla({
                              ...plantilla,
                              cuerpo: { ...plantilla.cuerpo, leyenda_fechas_horas: e.target.value },
                            })
                          }
                          className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white resize-none"
                        />
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          Nota: Use <code className="text-blue-600 font-bold">{`{{HORAS}}`}</code> para que el sistema inserte dinámicamente las horas cátedra computadas.
                        </p>
                      </div>
                    </div>
                  )}

                  {activeTab === 'firmas' && (
                    <div className="space-y-4">
                      {/* Autoridad 1 */}
                      <div className="p-3 bg-white rounded-xl border border-gray-200 space-y-2">
                        <span className="text-xs font-bold text-blue-900 block">Autoridad 1 (Izquierda)</span>
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-600">Nombre Completo</label>
                          <input
                            type="text"
                            value={plantilla.firmas.autoridad1_nombre}
                            onChange={(e) =>
                              setPlantilla({
                                ...plantilla,
                                firmas: { ...plantilla.firmas, autoridad1_nombre: e.target.value },
                              })
                            }
                            className="w-full text-xs px-2.5 py-1.5 border border-gray-300 rounded-lg outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-600">Cargo Directivo</label>
                          <input
                            type="text"
                            value={plantilla.firmas.autoridad1_cargo}
                            onChange={(e) =>
                              setPlantilla({
                                ...plantilla,
                                firmas: { ...plantilla.firmas, autoridad1_cargo: e.target.value },
                              })
                            }
                            className="w-full text-xs px-2.5 py-1.5 border border-gray-300 rounded-lg outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-600">Entidad / Ministerio</label>
                          <input
                            type="text"
                            value={plantilla.firmas.autoridad1_entidad}
                            onChange={(e) =>
                              setPlantilla({
                                ...plantilla,
                                firmas: { ...plantilla.firmas, autoridad1_entidad: e.target.value },
                              })
                            }
                            className="w-full text-xs px-2.5 py-1.5 border border-gray-300 rounded-lg outline-none"
                          />
                        </div>
                      </div>

                      {/* Autoridad 2 */}
                      <div className="p-3 bg-white rounded-xl border border-gray-200 space-y-2">
                        <span className="text-xs font-bold text-blue-900 block">Autoridad 2 (Derecha)</span>
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-600">Nombre Completo</label>
                          <input
                            type="text"
                            value={plantilla.firmas.autoridad2_nombre}
                            onChange={(e) =>
                              setPlantilla({
                                ...plantilla,
                                firmas: { ...plantilla.firmas, autoridad2_nombre: e.target.value },
                              })
                            }
                            className="w-full text-xs px-2.5 py-1.5 border border-gray-300 rounded-lg outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-600">Cargo Directivo / Rectoral</label>
                          <input
                            type="text"
                            value={plantilla.firmas.autoridad2_cargo}
                            onChange={(e) =>
                              setPlantilla({
                                ...plantilla,
                                firmas: { ...plantilla.firmas, autoridad2_cargo: e.target.value },
                              })
                            }
                            className="w-full text-xs px-2.5 py-1.5 border border-gray-300 rounded-lg outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-600">Comité Organizador / Sede</label>
                          <input
                            type="text"
                            value={plantilla.firmas.autoridad2_entidad}
                            onChange={(e) =>
                              setPlantilla({
                                ...plantilla,
                                firmas: { ...plantilla.firmas, autoridad2_entidad: e.target.value },
                              })
                            }
                            className="w-full text-xs px-2.5 py-1.5 border border-gray-300 rounded-lg outline-none"
                          />
                        </div>
                      </div>

                      {/* Sello Central */}
                      <div className="p-3 bg-white rounded-xl border border-gray-200 space-y-2">
                        <span className="text-xs font-bold text-blue-900 block">Sello Central Institucional</span>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] font-semibold text-gray-600">Texto Superior</label>
                            <input
                              type="text"
                              value={plantilla.firmas.sello_texto_superior}
                              onChange={(e) =>
                                setPlantilla({
                                  ...plantilla,
                                  firmas: { ...plantilla.firmas, sello_texto_superior: e.target.value },
                                })
                              }
                              className="w-full text-xs px-2.5 py-1.5 border border-gray-300 rounded-lg outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-gray-600">Texto Inferior</label>
                            <input
                              type="text"
                              value={plantilla.firmas.sello_texto_inferior}
                              onChange={(e) =>
                                setPlantilla({
                                  ...plantilla,
                                  firmas: { ...plantilla.firmas, sello_texto_inferior: e.target.value },
                                })
                              }
                              className="w-full text-xs px-2.5 py-1.5 border border-gray-300 rounded-lg outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'colores' && (
                    <div className="space-y-4">
                      <div className="p-3 bg-white rounded-xl border border-gray-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-bold text-gray-700 block">Color Primario (Títulos y Marcos)</span>
                            <span className="text-[11px] text-gray-400">Usado en nombre del alumno y marcos interiores</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={plantilla.colores.primario}
                              onChange={(e) =>
                                setPlantilla({
                                  ...plantilla,
                                  colores: { ...plantilla.colores, primario: e.target.value },
                                })
                              }
                              className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
                            />
                            <span className="text-xs font-mono text-gray-600">{plantilla.colores.primario}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                          <div>
                            <span className="text-xs font-bold text-gray-700 block">Color Primario Oscuro</span>
                            <span className="text-[11px] text-gray-400">Usado en títulos principales y encabezado QR</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={plantilla.colores.primario_oscuro}
                              onChange={(e) =>
                                setPlantilla({
                                  ...plantilla,
                                  colores: { ...plantilla.colores, primario_oscuro: e.target.value },
                                })
                              }
                              className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
                            />
                            <span className="text-xs font-mono text-gray-600">{plantilla.colores.primario_oscuro}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                          <div>
                            <span className="text-xs font-bold text-gray-700 block">Color Dorado Ornamental</span>
                            <span className="text-[11px] text-gray-400">Marco exterior y líneas divisorias</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={plantilla.colores.dorado}
                              onChange={(e) =>
                                setPlantilla({
                                  ...plantilla,
                                  colores: { ...plantilla.colores, dorado: e.target.value },
                                })
                              }
                              className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
                            />
                            <span className="text-xs font-mono text-gray-600">{plantilla.colores.dorado}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                          <div>
                            <span className="text-xs font-bold text-gray-700 block">Color Texto Oscuro</span>
                            <span className="text-[11px] text-gray-400">Tipografía de lectura general</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={plantilla.colores.texto_oscuro}
                              onChange={(e) =>
                                setPlantilla({
                                  ...plantilla,
                                  colores: { ...plantilla.colores, texto_oscuro: e.target.value },
                                })
                              }
                              className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
                            />
                            <span className="text-xs font-mono text-gray-600">{plantilla.colores.texto_oscuro}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Barra de Acciones del Formulario */}
            <div className="p-4 bg-white border-t border-gray-200 flex justify-between items-center shrink-0">
              <button
                type="button"
                onClick={handleRestablecer}
                className="px-3 py-1.5 text-xs text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg font-semibold border border-amber-200 transition"
              >
                🔄 Valores por Defecto
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleGuardar}
                  disabled={saving}
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow transition flex items-center gap-1.5"
                >
                  {saving ? '💾 Guardando...' : '💾 Guardar Plantilla'}
                </button>
              </div>
            </div>
          </div>

          {/* Panel Derecho: Lienzo WYSIWYG en Vivo */}
          <div className="w-full lg:w-7/12 p-4 bg-gray-100 flex flex-col items-center justify-center overflow-y-auto">
            {/* Control superior de tipo de certificado para previsualizar */}
            <div className="w-full max-w-2xl flex justify-between items-center mb-3">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                👁️ Vista Previa WYSIWYG en Tiempo Real
              </span>
              <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-gray-200 text-xs">
                <button
                  type="button"
                  onClick={() => setPreviewTipo('ASISTENCIA')}
                  className={`px-2.5 py-1 rounded font-semibold transition ${
                    previewTipo === 'ASISTENCIA' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Asistencia
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTipo('EXPOSITOR')}
                  className={`px-2.5 py-1 rounded font-semibold transition ${
                    previewTipo === 'EXPOSITOR' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Expositor
                </button>
              </div>
            </div>

            {/* Lienzo A4 Paisaje Representativo */}
            <div
              className="w-full max-w-2xl bg-white shadow-xl rounded p-6 relative transition-all duration-200 select-none"
              style={{
                aspectRatio: '842 / 595',
                color: plantilla.colores.texto_oscuro,
              }}
            >
              {/* Marco Exterior Dorado */}
              <div
                className="absolute inset-2 border-2 pointer-events-none"
                style={{ borderColor: plantilla.colores.dorado }}
              />
              {/* Marco Interior Azul */}
              <div
                className="absolute inset-3 border pointer-events-none"
                style={{ borderColor: plantilla.colores.primario }}
              />

              {/* Contenido Central del Diploma */}
              <div className="h-full flex flex-col justify-between py-1 px-4 text-center">
                {/* 1. Membrete */}
                <div className="space-y-0.5">
                  <p className="text-[9px] font-bold tracking-wide uppercase">
                    {plantilla.membrete.linea1}
                  </p>
                  <p
                    className="text-[8.5px] font-bold tracking-wide"
                    style={{ color: plantilla.colores.primario }}
                  >
                    {plantilla.membrete.linea2}
                  </p>
                  <p className="text-[7.5px] text-gray-500 font-medium">
                    {plantilla.membrete.linea3}
                  </p>
                  <div
                    className="w-3/4 mx-auto border-b my-1.5"
                    style={{ borderColor: plantilla.colores.dorado }}
                  />
                </div>

                {/* 2. Título */}
                <div>
                  <h3
                    className="text-xs sm:text-sm font-extrabold tracking-wider uppercase"
                    style={{ color: plantilla.colores.primario_oscuro }}
                  >
                    {previewTipo === 'EXPOSITOR'
                      ? plantilla.titulos.expositor
                      : plantilla.titulos.asistencia}
                  </h3>
                  <p className="text-[8.5px] italic text-gray-600 mt-0.5">
                    {plantilla.cuerpo.formula_intro}
                  </p>
                </div>

                {/* 3. Datos del Titular */}
                <div className="my-1">
                  <h2
                    className="text-base sm:text-lg font-black tracking-wide uppercase"
                    style={{ color: plantilla.colores.primario }}
                  >
                    JUAN MARTÍN PÉREZ
                  </h2>
                  <p className="text-[9px] font-bold tracking-wider text-gray-700">
                    D.N.I. / Pasaporte N°: 35.890.123
                  </p>
                </div>

                {/* 4. Descripción del Congreso */}
                <div className="space-y-0.5 px-4">
                  <p className="text-[8px] text-gray-600">
                    {plantilla.cuerpo.formula_evento}
                  </p>
                  <p
                    className="text-[9.5px] font-bold uppercase"
                    style={{ color: plantilla.colores.primario_oscuro }}
                  >
                    {plantilla.cuerpo.nombre_congreso}
                  </p>
                  <p className="text-[7.5px] text-gray-600 leading-tight">
                    {plantilla.cuerpo.leyenda_fechas_horas.replace('{{HORAS}}', '16')}
                  </p>
                </div>

                {/* 5. Firmas y Sello */}
                <div className="grid grid-cols-3 items-end pt-2 pb-1 border-t border-gray-100">
                  {/* Firma 1 */}
                  <div className="flex flex-col items-center text-center">
                    <div className="w-24 border-b border-gray-400 mb-1" />
                    <span className="text-[8.5px] font-bold leading-none">
                      {plantilla.firmas.autoridad1_nombre}
                    </span>
                    <span className="text-[7px] text-gray-500 leading-tight">
                      {plantilla.firmas.autoridad1_cargo}
                    </span>
                    <span className="text-[6.5px] text-gray-400 leading-tight">
                      {plantilla.firmas.autoridad1_entidad}
                    </span>
                  </div>

                  {/* Sello */}
                  <div className="flex flex-col items-center justify-center">
                    <div
                      className="w-10 h-10 rounded-full border flex flex-col items-center justify-center shadow-inner"
                      style={{ borderColor: plantilla.colores.dorado }}
                    >
                      <span
                        className="text-[7.5px] font-bold leading-none"
                        style={{ color: plantilla.colores.primario }}
                      >
                        {plantilla.firmas.sello_texto_superior}
                      </span>
                      <span className="text-[6.5px] font-bold leading-none mt-0.5">
                        {plantilla.firmas.sello_texto_inferior}
                      </span>
                    </div>
                  </div>

                  {/* Firma 2 */}
                  <div className="flex flex-col items-center text-center">
                    <div className="w-24 border-b border-gray-400 mb-1" />
                    <span className="text-[8.5px] font-bold leading-none">
                      {plantilla.firmas.autoridad2_nombre}
                    </span>
                    <span className="text-[7px] text-gray-500 leading-tight">
                      {plantilla.firmas.autoridad2_cargo}
                    </span>
                    <span className="text-[6.5px] text-gray-400 leading-tight">
                      {plantilla.firmas.autoridad2_entidad}
                    </span>
                  </div>
                </div>

                {/* 6. Pie de Página con Código y QR de Muestra */}
                <div className="flex justify-between items-end border-t border-gray-100 pt-1 text-left">
                  <div className="space-y-0.5">
                    <span
                      className="text-[7.5px] font-bold block"
                      style={{ color: plantilla.colores.primario_oscuro }}
                    >
                      CÓDIGO DE VALIDACIÓN ÚNICO: ETS26-DEMO-PREVIEW
                    </span>
                    <span className="text-[6.5px] text-gray-500 block">
                      Verificación pública en línea: http://localhost:3000/validar-certificado/...
                    </span>
                    <span className="text-[6px] text-gray-400 block">
                      Documento digital oficial firmado con hash criptográfico SHA-256
                    </span>
                  </div>
                  <div className="w-10 h-10 border border-gray-200 bg-gray-50 flex items-center justify-center text-[8px] text-gray-400 font-mono">
                    [ QR ]
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
