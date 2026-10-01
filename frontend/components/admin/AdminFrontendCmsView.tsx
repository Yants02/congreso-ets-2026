'use client';

import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import Image from 'next/image';

interface FrontendCard {
  id: number | string;
  title: string;
  description: string;
  image: string;
  builtinKey?: string;
  pdfUrl?: string;
  badge?: string;
  colorAccent?: string;
  activo: boolean;
  orden: number;
}

interface Props {
  onNotice: (msg: string) => void;
}

const BUILTIN_ICONS = [
  { key: 'card1', path: '/assets/icons/card1.svg', name: 'Demostración (Card 1)' },
  { key: 'card2', path: '/assets/icons/card2.svg', name: 'Stands (Card 2)' },
  { key: 'card3', path: '/assets/icons/card3.svg', name: 'Académico (Card 3)' },
  { key: 'card4', path: '/assets/icons/card4.svg', name: 'Estudiantes (Card 4)' },
  { key: 'card5', path: '/assets/icons/card5.svg', name: 'Talentos (Card 5)' },
];

const BUILTIN_PDFS = [
  { path: '/PDF/1 Aula Abierta - demostraciones aplicadas.pdf', label: '1. Aula Abierta - Demostraciones aplicadas' },
  { path: '/PDF/2 Muestra permanente - Stands.pdf', label: '2. Muestra permanente - Stands' },
  { path: '/PDF/3 Presentaciones académico-aplicadas.pdf', label: '3. Presentaciones académico - aplicadas' },
  { path: '/PDF/4 Proyectos y producciones estudiantiles.pdf', label: '4. Proyectos y producciones estudiantiles' },
  { path: '/PDF/5 Talentos ETS.pdf', label: '5. Talentos ETS' },
];

export default function AdminFrontendCmsView({ onNotice }: Props) {
  const [cards, setCards] = useState<FrontendCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Modal de Edición / Creación
  const [editingCard, setEditingCard] = useState<FrontendCard | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [iconMode, setIconMode] = useState<'builtin' | 'upload' | 'url'>('builtin');
  const [pdfMode, setPdfMode] = useState<'builtin' | 'upload' | 'url'>('builtin');
  const [uploadingFile, setUploadingFile] = useState(false);

  // Cargar tarjetas desde la API
  const loadCards = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/frontend-cms/cards');
      const data = await res.json();
      if (data.ok && Array.isArray(data.cards)) {
        setCards(data.cards);
        setHasChanges(false);
      } else {
        throw new Error(data.message || 'No se pudieron obtener las tarjetas.');
      }
    } catch (err: any) {
      console.error(err);
      onNotice(`Error cargando CMS: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCards();
  }, []);

  // Formateador de títulos según regla del usuario (espacio antes y después de / y -)
  const formatTitle = (text: string) => {
    return text ? text.replace(/\s*([/-])\s*/g, ' $1 ') : '';
  };

  // Reordenar tarjetas
  const moveCard = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= cards.length) return;

    const newCards = [...cards];
    const [moved] = newCards.splice(index, 1);
    newCards.splice(targetIndex, 0, moved);

    // Actualizar orden secuencial
    const updated = newCards.map((c, i) => ({ ...c, orden: i + 1 }));
    setCards(updated);
    setHasChanges(true);
  };

  // Conmutar activo/inactivo
  const toggleActive = (id: number | string) => {
    setCards((prev) =>
      prev.map((c) => (c.id === id ? { ...c, activo: !c.activo } : c))
    );
    setHasChanges(true);
  };

  // Abrir modal de edición
  const handleEdit = (card: FrontendCard) => {
    setEditingCard({ ...card });
    // Determinar modo de ícono
    if (card.builtinKey || BUILTIN_ICONS.some((b) => b.path === card.image)) {
      setIconMode('builtin');
    } else if (card.image.startsWith('/uploads/')) {
      setIconMode('upload');
    } else {
      setIconMode('url');
    }

    // Determinar modo de PDF
    if (BUILTIN_PDFS.some((p) => p.path === card.pdfUrl)) {
      setPdfMode('builtin');
    } else if (card.pdfUrl?.startsWith('/uploads/')) {
      setPdfMode('upload');
    } else {
      setPdfMode('url');
    }

    setIsModalOpen(true);
  };

  // Abrir modal para nueva tarjeta
  const handleNewCard = () => {
    const nextOrden = cards.length + 1;
    const newCard: FrontendCard = {
      id: `new-${Date.now()}`,
      title: '',
      description: '',
      image: '/assets/icons/card1.svg',
      builtinKey: 'card1',
      pdfUrl: '',
      badge: 'Nueva Modalidad',
      colorAccent: '#1D3343',
      activo: true,
      orden: nextOrden,
    };
    setEditingCard(newCard);
    setIconMode('builtin');
    setPdfMode('builtin');
    setIsModalOpen(true);
  };

  // Eliminar tarjeta
  const handleDelete = (id: number | string) => {
    Swal.fire({
      title: '¿Eliminar tarjeta?',
      text: 'Esta modalidad dejará de mostrarse en el portal público.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
    }).then((result) => {
      if (result.isConfirmed) {
        const remaining = cards.filter((c) => c.id !== id).map((c, i) => ({ ...c, orden: i + 1 }));
        setCards(remaining);
        setHasChanges(true);
        onNotice('Tarjeta removida de la lista.');
      }
    });
  };

  // Guardar tarjeta editada en el estado local
  const saveCardModal = () => {
    if (!editingCard) return;
    if (!editingCard.title.trim()) {
      Swal.fire('Atención', 'El título de la tarjeta no puede estar vacío.', 'warning');
      return;
    }

    // Aplicar normalización de conectores al título guardado
    const sanitizedTitle = formatTitle(editingCard.title.trim());
    const finalCard = { ...editingCard, title: sanitizedTitle };

    setCards((prev) => {
      const exists = prev.some((c) => c.id === finalCard.id);
      if (exists) {
        return prev.map((c) => (c.id === finalCard.id ? finalCard : c));
      } else {
        return [...prev, finalCard];
      }
    });

    setIsModalOpen(false);
    setEditingCard(null);
    setHasChanges(true);
    onNotice('Cambios aplicados localmente. Recordá presionar "Guardar en Base de Datos".');
  };

  // Guardar todo en PostgreSQL
  const saveAllToDatabase = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/frontend-cms/cards', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cards }),
      });
      const data = await res.json();
      if (data.ok) {
        setCards(data.cards);
        setHasChanges(false);
        Swal.fire({
          icon: 'success',
          title: '¡Guardado Exitoso!',
          text: 'Las tarjetas del frontend se han actualizado en la base de datos central PostgreSQL.',
          timer: 2500,
          showConfirmButton: false,
        });
        onNotice('Tarjetas del frontend guardadas en PostgreSQL.');
      } else {
        throw new Error(data.message || 'Error al persistir cambios.');
      }
    } catch (err: any) {
      console.error(err);
      Swal.fire('Error', err.message || 'No se pudo guardar la configuración.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Restablecer tarjetas a los valores oficiales
  const handleResetToDefault = () => {
    Swal.fire({
      title: '¿Restablecer tarjetas oficiales?',
      text: 'Se revertirán los textos, imágenes y orden a las 5 modalidades oficiales predeterminadas del Congreso ETS.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#f59e0b',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, restablecer',
      cancelButtonText: 'Cancelar',
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const res = await fetch('/api/admin/frontend-cms/cards/reset', { method: 'POST' });
          const data = await res.json();
          if (data.ok) {
            setCards(data.cards);
            setHasChanges(false);
            Swal.fire('Restablecido', 'Las tarjetas oficiales han sido restauradas.', 'success');
            onNotice('Tarjetas oficiales restauradas exitosamente.');
          }
        } catch (err: any) {
          Swal.fire('Error', err.message, 'error');
        }
      }
    });
  };

  // Subir archivo (Ícono / Imagen / PDF)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, targetField: 'image' | 'pdfUrl') => {
    const file = e.target.files?.[0];
    if (!file || !editingCard) return;

    if (file.size > 8 * 1024 * 1024) {
      Swal.fire('Archivo muy pesado', 'El archivo no debe exceder los 8 MB.', 'warning');
      return;
    }

    setUploadingFile(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const fileBase64 = reader.result as string;
        const res = await fetch('/api/admin/frontend-cms/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            fileBase64,
          }),
        });

        const data = await res.json();
        if (data.ok && data.url) {
          setEditingCard((prev) =>
            prev
              ? {
                  ...prev,
                  [targetField]: data.url,
                  builtinKey: targetField === 'image' ? undefined : prev.builtinKey,
                }
              : null
          );
          onNotice(`Archivo "${file.name}" cargado exitosamente.`);
        } else {
          throw new Error(data.message || 'Error al procesar archivo.');
        }
        setUploadingFile(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setUploadingFile(false);
      Swal.fire('Error de subida', err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* ENCABEZADO Y ACCIONES PRINCIPALES */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-blue-50 text-blue-700 rounded-xl text-xl">🎴</span>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                Editor CMS de Tarjetas del Frontend
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Gestioná dinámicamente las modalidades, títulos, descripciones, íconos y PDFs de la sección &quot;Actividades&quot; en el portal público.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <a
            href="/#actividades"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition flex items-center gap-1.5"
            title="Ver sección en una nueva pestaña"
          >
            <span>🌐</span> Ver en Portal
          </a>

          <button
            type="button"
            onClick={handleResetToDefault}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition flex items-center gap-1.5"
          >
            <span>🔄</span> Restablecer Oficiales
          </button>

          <button
            type="button"
            onClick={handleNewCard}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition flex items-center gap-1.5"
          >
            <span>➕</span> Nueva Tarjeta
          </button>

          <button
            type="button"
            onClick={saveAllToDatabase}
            disabled={saving || !hasChanges}
            className={`px-5 py-2 rounded-xl text-xs font-bold text-white transition flex items-center gap-2 shadow-sm ${
              hasChanges
                ? 'bg-emerald-600 hover:bg-emerald-700 ring-2 ring-emerald-400 ring-offset-1 animate-pulse'
                : 'bg-gray-400 cursor-not-allowed opacity-80'
            }`}
          >
            <span>💾</span> {saving ? 'Guardando en DB...' : hasChanges ? 'Guardar Cambios *' : 'Cambios Guardados'}
          </button>
        </div>
      </div>

      {hasChanges && (
        <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-xl flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-800 text-sm">
            <span className="text-lg">⚠️</span>
            <span>Tenés cambios pendientes de confirmación. Presioná <strong>&quot;Guardar Cambios&quot;</strong> para que se reflejen en la base de datos y en el portal público.</span>
          </div>
          <button
            type="button"
            onClick={saveAllToDatabase}
            className="text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg transition"
          >
            Guardar Ahora
          </button>
        </div>
      )}

      {/* GRILLA DE TARJETAS EN ADMINISTRACIÓN */}
      {loading ? (
        <div className="bg-white rounded-2xl p-12 text-center text-gray-500 border border-gray-200">
          <div className="animate-spin text-3xl mb-3">⏳</div>
          <p className="text-sm">Cargando tarjetas del CMS desde la base de datos...</p>
        </div>
      ) : cards.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center text-gray-500 border border-dashed border-gray-300">
          <p className="text-base font-semibold text-gray-700 mb-2">No hay tarjetas configuradas</p>
          <p className="text-sm text-gray-500 mb-4">Podés restablecer las 5 tarjetas oficiales o crear una personalizada.</p>
          <button
            type="button"
            onClick={handleResetToDefault}
            className="px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl shadow-sm hover:bg-blue-700 transition"
          >
            Cargar Tarjetas Oficiales
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cards.map((card, index) => {
            const formatted = formatTitle(card.title);
            return (
              <div
                key={card.id}
                className={`bg-white rounded-2xl border transition-all duration-200 flex flex-col relative overflow-hidden shadow-sm hover:shadow-md ${
                  card.activo ? 'border-gray-200' : 'border-gray-300 bg-gray-50/70 opacity-70'
                }`}
              >
                {/* BARRA SUPERIOR DE ORDEN Y ESTADO */}
                <div className="bg-gray-50 border-b border-gray-100 px-4 py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold bg-gray-200 text-gray-800 px-2 py-0.5 rounded-md">
                      #{card.orden}
                    </span>
                    {card.badge && (
                      <span className="bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded-md text-[11px]">
                        {card.badge}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Botones de orden */}
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => moveCard(index, 'up')}
                      className={`p-1 rounded hover:bg-gray-200 transition ${index === 0 ? 'opacity-30 cursor-not-allowed' : ''}`}
                      title="Mover a la izquierda / arriba"
                    >
                      ◀
                    </button>
                    <button
                      type="button"
                      disabled={index === cards.length - 1}
                      onClick={() => moveCard(index, 'down')}
                      className={`p-1 rounded hover:bg-gray-200 transition ${index === cards.length - 1 ? 'opacity-30 cursor-not-allowed' : ''}`}
                      title="Mover a la derecha / abajo"
                    >
                      ▶
                    </button>

                    {/* Switch activo */}
                    <button
                      type="button"
                      onClick={() => toggleActive(card.id)}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
                        card.activo ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                      }`}
                    >
                      {card.activo ? 'Visible' : 'Oculta'}
                    </button>
                  </div>
                </div>

                {/* CUERPO DE LA TARJETA */}
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex items-start gap-3.5 mb-3">
                    <div className="w-12 h-12 rounded-full flex-shrink-0 relative overflow-hidden bg-white border border-gray-200 shadow-xs flex items-center justify-center p-2.5">
                      {card.image.startsWith('http') || card.image.startsWith('/') ? (
                        <img
                          src={card.image}
                          alt={card.title}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/assets/icons/card1.svg';
                          }}
                        />
                      ) : (
                        <span className="text-xl">📄</span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-base text-[#1D3343] leading-snug break-words hyphens-none">
                        {formatted || '(Sin título)'}
                      </h3>
                      {card.image && (
                        <p className="text-[10px] text-gray-400 truncate mt-0.5 font-mono">
                          {card.builtinKey ? `Oficial (${card.builtinKey})` : card.image}
                        </p>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-gray-600 leading-relaxed flex-1 line-clamp-4">
                    {card.description || '(Sin descripción provista)'}
                  </p>

                  {/* ENLACE PDF */}
                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                    {card.pdfUrl ? (
                      <a
                        href={card.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-bold text-[#035C80] hover:text-amber-500 transition flex items-center gap-1 truncate max-w-[200px]"
                        title={card.pdfUrl}
                      >
                        <span>📎</span> Saber más &rarr;
                      </a>
                    ) : (
                      <span className="text-gray-400 italic text-[11px]">Sin PDF adjunto</span>
                    )}

                    <div className="flex items-center gap-1.5 ml-auto">
                      <button
                        type="button"
                        onClick={() => handleEdit(card)}
                        className="p-1.5 text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition text-xs font-semibold flex items-center gap-1"
                        title="Editar contenido"
                      >
                        <span>✏️</span> Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(card.id)}
                        className="p-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition text-xs font-semibold"
                        title="Eliminar tarjeta"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL DE EDICIÓN / CREACIÓN */}
      {isModalOpen && editingCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-2xl w-full p-6 space-y-5 my-8 max-h-[90vh] overflow-y-auto">
            {/* Cabecera del modal */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">✏️</span>
                <h2 className="text-lg font-bold text-gray-900">
                  {typeof editingCard.id === 'string' && editingCard.id.startsWith('new-')
                    ? 'Nueva Tarjeta de Actividad'
                    : `Editar Tarjeta: ${editingCard.title}`}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-700 text-xl font-bold p-1"
              >
                ✕
              </button>
            </div>

            {/* Formulario */}
            <div className="space-y-4 text-xs">
              {/* TÍTULO */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Título de la Modalidad <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editingCard.title}
                  onChange={(e) => setEditingCard({ ...editingCard, title: e.target.value })}
                  placeholder="Ej: Presentaciones académico - aplicadas"
                  className="w-full border border-gray-300 rounded-xl px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
                <p className="text-[11px] text-gray-500 mt-1 flex items-center gap-1">
                  <span>💡</span> Los conectores como <code>/</code> o <code>-</code> se separan automáticamente con espacios para permitir que las palabras desciendan a la línea inferior sin división silábica.
                </p>
                {editingCard.title && (
                  <div className="mt-1.5 p-2 bg-blue-50/60 rounded-lg text-blue-900 text-xs">
                    <strong>Previsualización del título:</strong> {formatTitle(editingCard.title)}
                  </div>
                )}
              </div>

              {/* BADGE Y ORDEN */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Etiqueta / Badge (Opcional)
                  </label>
                  <input
                    type="text"
                    value={editingCard.badge || ''}
                    onChange={(e) => setEditingCard({ ...editingCard, badge: e.target.value })}
                    placeholder="Ej: Demostración, Stands, Pitch"
                    className="w-full border border-gray-300 rounded-xl px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Posición / Orden
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={editingCard.orden}
                    onChange={(e) => setEditingCard({ ...editingCard, orden: parseInt(e.target.value, 10) || 1 })}
                    className="w-full border border-gray-300 rounded-xl px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* DESCRIPCIÓN */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Descripción Formativa
                </label>
                <textarea
                  rows={4}
                  value={editingCard.description}
                  onChange={(e) => setEditingCard({ ...editingCard, description: e.target.value })}
                  placeholder="Detallá los objetivos, metodología y alcance de la actividad..."
                  className="w-full border border-gray-300 rounded-xl px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
                <div className="flex justify-between text-[11px] text-gray-400 mt-0.5">
                  <span>Recomendado: entre 120 y 260 caracteres.</span>
                  <span>{editingCard.description.length} caracteres</span>
                </div>
              </div>

              {/* ÍCONO / IMAGEN */}
              <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                <label className="block font-bold text-gray-800">
                  Ícono o Imagen de Cabecera
                </label>

                {/* Selector de modo */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIconMode('builtin')}
                    className={`px-3 py-1 rounded-lg font-semibold text-xs transition ${
                      iconMode === 'builtin' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Íconos Oficiales
                  </button>
                  <button
                    type="button"
                    onClick={() => setIconMode('upload')}
                    className={`px-3 py-1 rounded-lg font-semibold text-xs transition ${
                      iconMode === 'upload' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Subir SVG / PNG
                  </button>
                  <button
                    type="button"
                    onClick={() => setIconMode('url')}
                    className={`px-3 py-1 rounded-lg font-semibold text-xs transition ${
                      iconMode === 'url' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    URL / Enlace Directo
                  </button>
                </div>

                {iconMode === 'builtin' && (
                  <div className="grid grid-cols-5 gap-2 pt-1">
                    {BUILTIN_ICONS.map((icon) => (
                      <button
                        type="button"
                        key={icon.key}
                        onClick={() =>
                          setEditingCard({
                            ...editingCard,
                            image: icon.path,
                            builtinKey: icon.key,
                          })
                        }
                        className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 transition ${
                          editingCard.image === icon.path
                            ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-400'
                            : 'border-gray-200 bg-white hover:bg-gray-100'
                        }`}
                      >
                        <div className="w-8 h-8 relative">
                          <img src={icon.path} alt={icon.name} className="w-full h-full object-contain" />
                        </div>
                        <span className="text-[10px] font-medium text-gray-600 truncate max-w-full">
                          {icon.key}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {iconMode === 'upload' && (
                  <div className="space-y-2 pt-1">
                    <input
                      type="file"
                      accept=".svg,.png,.jpg,.jpeg,.webp"
                      onChange={(e) => handleFileUpload(e, 'image')}
                      disabled={uploadingFile}
                      className="block w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                    />
                    {uploadingFile && <p className="text-xs text-blue-600 animate-pulse">Subiendo archivo...</p>}
                    {editingCard.image && !editingCard.builtinKey && (
                      <p className="text-[11px] text-gray-500 font-mono">Archivo actual: {editingCard.image}</p>
                    )}
                  </div>
                )}

                {iconMode === 'url' && (
                  <div className="pt-1">
                    <input
                      type="text"
                      value={editingCard.image}
                      onChange={(e) =>
                        setEditingCard({ ...editingCard, image: e.target.value, builtinKey: undefined })
                      }
                      placeholder="/assets/icons/card1.svg o https://ejemplo.com/icono.svg"
                      className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>
                )}
              </div>

              {/* DOCUMENTO PDF */}
              <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                <label className="block font-bold text-gray-800">
                  Documento PDF Vinculado (Descarga / &quot;Saber más&quot;)
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPdfMode('builtin')}
                    className={`px-3 py-1 rounded-lg font-semibold text-xs transition ${
                      pdfMode === 'builtin' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    PDFs Oficiales
                  </button>
                  <button
                    type="button"
                    onClick={() => setPdfMode('upload')}
                    className={`px-3 py-1 rounded-lg font-semibold text-xs transition ${
                      pdfMode === 'upload' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Subir Nuevo PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => setPdfMode('url')}
                    className={`px-3 py-1 rounded-lg font-semibold text-xs transition ${
                      pdfMode === 'url' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Enlace Personalizado
                  </button>
                </div>

                {pdfMode === 'builtin' && (
                  <select
                    value={editingCard.pdfUrl || ''}
                    onChange={(e) => setEditingCard({ ...editingCard, pdfUrl: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  >
                    <option value="">-- Sin PDF vinculado --</option>
                    {BUILTIN_PDFS.map((p) => (
                      <option key={p.path} value={p.path}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                )}

                {pdfMode === 'upload' && (
                  <div className="space-y-2 pt-1">
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={(e) => handleFileUpload(e, 'pdfUrl')}
                      disabled={uploadingFile}
                      className="block w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                    />
                    {uploadingFile && <p className="text-xs text-blue-600 animate-pulse">Subiendo PDF...</p>}
                    {editingCard.pdfUrl && (
                      <p className="text-[11px] text-gray-500 font-mono">PDF asignado: {editingCard.pdfUrl}</p>
                    )}
                  </div>
                )}

                {pdfMode === 'url' && (
                  <div className="pt-1">
                    <input
                      type="text"
                      value={editingCard.pdfUrl || ''}
                      onChange={(e) => setEditingCard({ ...editingCard, pdfUrl: e.target.value })}
                      placeholder="/PDF/documento.pdf o https://servidor.gob.ar/doc.pdf"
                      className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>
                )}
              </div>

              {/* ESTADO VISIBLE */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="activoCheckbox"
                  checked={editingCard.activo}
                  onChange={(e) => setEditingCard({ ...editingCard, activo: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <label htmlFor="activoCheckbox" className="font-semibold text-gray-700 cursor-pointer">
                  Tarjeta Activa (Visible para los asistentes en el portal web público)
                </label>
              </div>
            </div>

            {/* Botones del Modal */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveCardModal}
                className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition"
              >
                Aplicar Cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
