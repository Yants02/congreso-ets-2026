'use client';

import React, { useState, useEffect } from 'react';
import { Rnd } from 'react-rnd';
import Swal from 'sweetalert2';

interface Widget {
  id: string;
  type: 'live_clock' | 'avatar_usuario' | 'codigo_qr' | 'texto_dinamico' | 'badge' | 'alert_box' | 'imagen_estatica' | 'divider' | 'barcode' | 'firma' | 'fecha_validez' | 'dynamic_icon';
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex?: number;
  props: any;
}

interface IdentificaciónTemplate {
  width: number;
  height: number;
  backgroundColor: string;
  backgroundImage: string | null;
  widgets: Widget[];
}

const DEFAULT_TEMPLATE: IdentificaciónTemplate = {
  width: 400,
  height: 650,
  backgroundColor: '#ffffff',
  backgroundImage: null,
  widgets: [
    { id: '1', type: 'badge', x: 20, y: 20, width: 100, height: 30, props: { bg: '#0f766e', color: '#fff', text: 'ETS 2026' } },
    { id: '2', type: 'live_clock', x: 100, y: 70, width: 200, height: 30, props: { color: '#2563eb', format: 'EN VIVO: HH:mm:ss.SS' } },
    { id: '3', type: 'avatar_usuario', x: 140, y: 120, width: 120, height: 120, props: { shape: 'circle' } },
    { id: '4', type: 'texto_dinamico', x: 20, y: 260, width: 360, height: 40, props: { template: '{NOMBRE} {APELLIDO}', fontSize: 24, fontWeight: 'bold', align: 'center' } },
    { id: '5', type: 'badge', x: 120, y: 310, width: 160, height: 30, props: { bg: '#fbbf24', color: '#000', text: '{ROL}' } },
    { id: '6', type: 'texto_dinamico', x: 20, y: 360, width: 360, height: 30, props: { template: 'DNI / Pasaporte: {DNI}', fontSize: 16, fontWeight: 'normal', align: 'center', color: '#4b5563' } },
    { id: '7', type: 'codigo_qr', x: 75, y: 400, width: 250, height: 250, props: { fgColor: '#002B49' } }
  ],
};

interface Props {
  onNotice: (msg: string) => void;
}

export default function AdminIdentificacionEditorView({ onNotice }: Props) {
  const [template, setTemplate] = useState<IdentificaciónTemplate>(DEFAULT_TEMPLATE);
  const [loading, setLoading] = useState(true);
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(false);

  const [history, setHistory] = useState<IdentificaciónTemplate[]>([DEFAULT_TEMPLATE]);
  const [historyIndex, setHistoryIndex] = useState(0);

  function updateTemplate(newTemplate: IdentificaciónTemplate) {
    setTemplate(newTemplate);
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newTemplate);
    if (newHistory.length > 50) newHistory.shift();
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }

  function handleUndo() {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setTemplate(history[historyIndex - 1]);
    }
  }

  function handleRedo() {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setTemplate(history[historyIndex + 1]);
    }
  }

  useEffect(() => {
    async function loadTemplate() {
      try {
        const res = await fetch('/api/admin/configuracion');
        if (res.ok) {
          const data = await res.json();
          const config = data.configuracion.find((c: any) => c.clave === 'plantilla_identificacion_digital');
          if (config && config.valor) {
            const loaded = config.valor as IdentificaciónTemplate;
            setTemplate(loaded);
            setHistory([loaded]);
            setHistoryIndex(0);
          }
        }
      } catch (err) {
        console.error('Error loading template:', err);
      } finally {
        setLoading(false);
      }
    }
    loadTemplate();
  }, []);

  async function handleSaveToDB() {
    try {
      const res = await fetch('/api/admin/configuracion', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clave: 'plantilla_identificacion_digital',
          valor: template,
          descripcion: 'Estructura visual WYSIWYG de la identificacion digital pública'
        })
      });
      const data = await res.json();
      if (res.ok) {
        onNotice('Plantilla de identificacion guardada correctamente.');
      } else {
        Swal.fire('Error', data.message || 'Error al guardar', 'error');
      }
    } catch (err) {
      Swal.fire('Error', 'Error de conexión', 'error');
    }
  }

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(template, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "plantilla_identificacion.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const obj = JSON.parse(event.target?.result as string);
        if (obj && obj.widgets && Array.isArray(obj.widgets)) {
          setTemplate(obj);
          setHistory([obj]);
          setHistoryIndex(0);
          setSelectedWidgetId(null);
          onNotice('Plantilla importada con éxito desde el archivo.');
        } else {
          Swal.fire('Error', 'El archivo no tiene el formato correcto de plantilla.', 'error');
        }
      } catch (err) {
        Swal.fire('Error', 'Error al procesar el archivo JSON.', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  function handleAddWidget(type: Widget['type']) {
    const nextIndex = template.widgets.length + 1;
    const offset = (nextIndex * 25) % 150;
    const newWidget: Widget = {
      id: `widget_${type}_${nextIndex}_${template.widgets.length}`,
      type,
      x: 60 + offset,
      y: 60 + offset,
      width: 150,
      height: 50,
      props: getPropsForType(type)
    };
    updateTemplate({ ...template, widgets: [...template.widgets, newWidget] });
    setSelectedWidgetId(newWidget.id);
  }

  function handleDeleteWidget(id: string) {
    updateTemplate({ ...template, widgets: template.widgets.filter(w => w.id !== id) });
    if (selectedWidgetId === id) setSelectedWidgetId(null);
  }

  function handleDuplicateWidget(id: string) {
    const widget = template.widgets.find(w => w.id === id);
    if (!widget) return;
    const newWidget: Widget = { ...widget, id: Date.now().toString() + '_' + Math.floor(Math.random() * 1000), x: widget.x + 20, y: widget.y + 20, zIndex: (widget.zIndex || 1) + 1 };
    updateTemplate({ ...template, widgets: [...template.widgets, newWidget] });
    setSelectedWidgetId(newWidget.id);
  }

  function handleCenterWidget(id: string, axis: 'h' | 'v') {
    const widget = template.widgets.find(w => w.id === id);
    if (!widget) return;
    const newX = axis === 'h' ? (template.width - widget.width) / 2 : widget.x;
    const newY = axis === 'v' ? (template.height - widget.height) / 2 : widget.y;
    const newWidgets = template.widgets.map(w => w.id === id ? { ...w, x: newX, y: newY } : w);
    updateTemplate({ ...template, widgets: newWidgets });
  }

  function handleChangeZIndex(id: string, delta: number) {
    const widget = template.widgets.find(w => w.id === id);
    if (!widget) return;
    const currentZ = widget.zIndex || 1;
    const newWidgets = template.widgets.map(w => w.id === id ? { ...w, zIndex: currentZ + delta } : w);
    updateTemplate({ ...template, widgets: newWidgets });
  }

  function getPropsForType(type: Widget['type']) {
    switch (type) {
      case 'texto_dinamico': return { template: 'Nuevo Texto', fontFamily: 'sans-serif', fontSize: 16, color: '#000000', align: 'left', fontWeight: 'normal', padding: 0, borderWidth: 0, borderColor: '#000000', borderRadius: 0, bg: 'transparent' };
      case 'fecha_validez': return { template: 'Válido hasta: {FECHA_FIN}', fontFamily: 'sans-serif', fontSize: 14, color: '#000000', align: 'center', fontWeight: 'bold', padding: 0, borderWidth: 0, borderColor: '#000000', borderRadius: 0, bg: 'transparent' };
      case 'badge': return { bg: '#2563eb', color: '#ffffff', text: 'Nueva Insignia', fontFamily: 'sans-serif', padding: 4, borderWidth: 0, borderColor: '#000000', borderRadius: 9999, shape: 'pill' };
      case 'live_clock': return { format: 'HH:mm:ss', color: '#000000', fontFamily: 'sans-serif', padding: 0, borderWidth: 0, borderColor: '#000000', borderRadius: 0, bg: 'transparent' };
      case 'avatar_usuario': return { shape: 'circle', url: '', borderWidth: 0, borderColor: '#000000' };
      case 'codigo_qr': return { fgColor: '#000000', padding: 0, borderWidth: 0, borderColor: '#000000', borderRadius: 0, bg: 'transparent' };
      case 'alert_box': return { bg: '#cffafe', text: 'Nueva Alerta', icon: 'info', padding: 8, borderWidth: 1, borderColor: '#93c5fd', borderRadius: 8, color: '#1e3a8a' };
      case 'imagen_estatica': return { url: '', objectFit: 'contain', padding: 0, borderWidth: 0, borderColor: '#000000', borderRadius: 0, bg: 'transparent' };
      case 'firma': return { url: '', objectFit: 'contain', padding: 0, borderWidth: 0, borderColor: '#000000', borderRadius: 0, bg: 'transparent' };
      case 'divider': return { color: '#d1d5db', borderWidth: 2, padding: 0 };
      case 'barcode': return { fgColor: '#000000', text: '{DNI}', padding: 0, borderWidth: 0, borderColor: '#000000', borderRadius: 0, bg: 'transparent' };
      case 'dynamic_icon': return { iconName: 'star', color: '#fbbf24', fontSize: 32, padding: 0, borderWidth: 0, borderColor: '#000000', borderRadius: 0, bg: 'transparent' };
      default: return {};
    }
  }

  const renderText = (text: string) => {
    if (!previewMode || !text) return text;
    return text.replace(/\{NOMBRE\}/g, 'Juan')
               .replace(/\{APELLIDO\}/g, 'Pérez')
               .replace(/\{DNI\}/g, '12.345.678')
               .replace(/\{ROL\}/g, 'INVITADO VIP')
               .replace(/\{FECHA_FIN\}/g, '31/12/2026');
  };

  const selectedWidget = template.widgets.find(w => w.id === selectedWidgetId);

  return (
    <div className="flex flex-col h-[85vh] min-h-[700px] gap-4">
      
      {/* TOP TOOLBAR (Acciones Globales) */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-3 flex items-center justify-between gap-4 shrink-0">
        
        {/* Historial y Vista */}
        <div className="flex items-center gap-4">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg border">
            <button onClick={handleUndo} disabled={historyIndex <= 0} className="px-3 py-1.5 bg-white hover:bg-gray-50 disabled:bg-transparent disabled:opacity-50 text-gray-700 rounded shadow-sm font-bold text-sm transition">↩️ Deshacer</button>
            <button onClick={handleRedo} disabled={historyIndex >= history.length - 1} className="px-3 py-1.5 bg-white hover:bg-gray-50 disabled:bg-transparent disabled:opacity-50 text-gray-700 rounded shadow-sm font-bold text-sm transition">↪️ Rehacer</button>
          </div>
          
          <div className="h-8 w-px bg-gray-300"></div>

          <label className="flex items-center gap-2 text-sm font-bold cursor-pointer text-gray-700 hover:text-blue-600 transition">
            <input type="checkbox" checked={previewMode} onChange={e => setPreviewMode(e.target.checked)} className="rounded w-4 h-4 accent-blue-600" />
            👁️ Modo Preview
          </label>
          <label className="flex items-center gap-2 text-sm font-bold cursor-pointer text-gray-700 hover:text-blue-600 transition">
            <input type="checkbox" checked={snapToGrid} onChange={e => setSnapToGrid(e.target.checked)} className="rounded w-4 h-4 accent-blue-600" />
            📏 Snap a Cuadrícula (10px)
          </label>
        </div>

        {/* Acciones de Guardado e Importación */}
        <div className="flex items-center gap-2">
          <label className="bg-white border border-gray-300 text-gray-700 font-bold py-1.5 px-3 rounded-lg hover:bg-gray-50 transition text-sm cursor-pointer shadow-sm">
            <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
            📥 Importar JSON
          </label>
          <button type="button" onClick={handleExportJSON} className="bg-gray-800 text-white font-bold py-1.5 px-3 rounded-lg hover:bg-gray-900 transition shadow-sm text-sm">
            📄 Exportar JSON
          </button>
          <button type="button" onClick={handleSaveToDB} className="bg-blue-600 text-white font-bold py-1.5 px-4 rounded-lg hover:bg-blue-700 transition shadow-sm text-sm">
            💾 Guardar en BD
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 gap-4">
        {/* TOOLBOX (Panel Izquierdo - Elementos) */}
        <div className="w-72 bg-white border border-gray-200 rounded-xl shadow-sm p-4 flex flex-col min-h-0">
          <h3 className="font-bold text-gray-800 border-b pb-2 mb-3 shrink-0">📦 Elementos Arrastrables</h3>
          <p className="text-xs text-gray-500 mb-3 shrink-0">Haz clic para añadir un elemento al lienzo central. Luego arrástralo y redimensiónalo libremente.</p>
          
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar grid grid-cols-2 gap-2 content-start">
            <button type="button" onClick={() => handleAddWidget('texto_dinamico')} className="p-3 border rounded hover:bg-gray-50 text-xs font-bold text-center flex flex-col items-center gap-2 bg-white shadow-sm transition hover:-translate-y-0.5"><span className="text-xl">📝</span> Texto</button>
            <button type="button" onClick={() => handleAddWidget('fecha_validez')} className="p-3 border rounded hover:bg-gray-50 text-xs font-bold text-center flex flex-col items-center gap-2 bg-white shadow-sm transition hover:-translate-y-0.5"><span className="text-xl">🗓️</span> Fecha</button>
            <button type="button" onClick={() => handleAddWidget('badge')} className="p-3 border rounded hover:bg-gray-50 text-xs font-bold text-center flex flex-col items-center gap-2 bg-white shadow-sm transition hover:-translate-y-0.5"><span className="text-xl">🏷️</span> Badge</button>
            <button type="button" onClick={() => handleAddWidget('dynamic_icon')} className="p-3 border rounded hover:bg-gray-50 text-xs font-bold text-center flex flex-col items-center gap-2 bg-white shadow-sm transition hover:-translate-y-0.5"><span className="text-xl">⭐</span> Icono</button>
            <button type="button" onClick={() => handleAddWidget('divider')} className="p-3 border rounded hover:bg-gray-50 text-xs font-bold text-center flex flex-col items-center gap-2 bg-white shadow-sm transition hover:-translate-y-0.5"><span className="text-xl">📏</span> Línea</button>
            <button type="button" onClick={() => handleAddWidget('live_clock')} className="p-3 border rounded hover:bg-gray-50 text-xs font-bold text-center flex flex-col items-center gap-2 bg-white shadow-sm transition hover:-translate-y-0.5"><span className="text-xl">⏱️</span> Reloj</button>
            <button type="button" onClick={() => handleAddWidget('avatar_usuario')} className="p-3 border rounded hover:bg-gray-50 text-xs font-bold text-center flex flex-col items-center gap-2 bg-white shadow-sm transition hover:-translate-y-0.5"><span className="text-xl">👤</span> Foto</button>
            <button type="button" onClick={() => handleAddWidget('codigo_qr')} className="p-3 border rounded hover:bg-gray-50 text-xs font-bold text-center flex flex-col items-center gap-2 bg-white shadow-sm transition hover:-translate-y-0.5"><span className="text-xl">🔳</span> QR</button>
            <button type="button" onClick={() => handleAddWidget('barcode')} className="p-3 border rounded hover:bg-gray-50 text-xs font-bold text-center flex flex-col items-center gap-2 bg-white shadow-sm transition hover:-translate-y-0.5"><span className="text-xl">🔲</span> Barcode</button>
            <button type="button" onClick={() => handleAddWidget('alert_box')} className="p-3 border rounded hover:bg-gray-50 text-xs font-bold text-center flex flex-col items-center gap-2 bg-white shadow-sm transition hover:-translate-y-0.5"><span className="text-xl">⚠️</span> Alerta</button>
            <button type="button" onClick={() => handleAddWidget('imagen_estatica')} className="p-3 border rounded hover:bg-gray-50 text-xs font-bold text-center flex flex-col items-center gap-2 bg-white shadow-sm transition hover:-translate-y-0.5"><span className="text-xl">🖼️</span> Imagen</button>
            <button type="button" onClick={() => handleAddWidget('firma')} className="p-3 border rounded hover:bg-gray-50 text-xs font-bold text-center flex flex-col items-center gap-2 bg-white shadow-sm transition hover:-translate-y-0.5"><span className="text-xl">✍️</span> Firma</button>
          </div>
        </div>

        {/* CANVAS (Centro) */}
        <div 
          className="flex-1 bg-gray-100 border border-gray-200 rounded-xl overflow-auto relative flex items-center justify-center shadow-inner"
          style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        >
        {loading ? (
          <p>Cargando lienzo...</p>
        ) : (
          <div 
            className="relative shadow-2xl overflow-hidden" 
            style={{ 
              width: template.width, 
              height: template.height, 
              backgroundColor: template.backgroundColor,
              backgroundImage: template.backgroundImage ? `url(${template.backgroundImage})` : 'none',
              backgroundSize: 'cover'
            }}
            onClick={() => setSelectedWidgetId(null)}
          >
            {template.widgets.slice().sort((a, b) => (a.zIndex || 1) - (b.zIndex || 1)).map((widget) => (
              <Rnd
                key={widget.id}
                size={{ width: widget.width, height: widget.height }}
                position={{ x: widget.x, y: widget.y }}
                dragGrid={snapToGrid ? [10, 10] : [1, 1]}
                resizeGrid={snapToGrid ? [10, 10] : [1, 1]}
                style={{ zIndex: widget.zIndex || 1 }}
                onDragStop={(e, d) => {
                  const newWidgets = template.widgets.map(w => w.id === widget.id ? { ...w, x: d.x, y: d.y } : w);
                  updateTemplate({ ...template, widgets: newWidgets });
                }}
                onResizeStop={(e, direction, ref, delta, position) => {
                  const newWidgets = template.widgets.map(w => w.id === widget.id ? { 
                    ...w, 
                    width: parseInt(ref.style.width), 
                    height: parseInt(ref.style.height),
                    x: position.x,
                    y: position.y
                  } : w);
                  updateTemplate({ ...template, widgets: newWidgets });
                }}
                bounds="parent"
                onClick={(e: any) => { e.stopPropagation(); setSelectedWidgetId(widget.id); }}
                className={`border-2 ${selectedWidgetId === widget.id ? 'border-blue-500 border-dashed z-10' : 'border-transparent hover:border-gray-300 border-dashed'}`}
              >
                <div className="w-full h-full flex items-center justify-center select-none overflow-hidden" style={{
                  backgroundColor: widget.type === 'avatar_usuario' ? '#e5e7eb' : (widget.props.bg || 'transparent'),
                  color: widget.props.color || '#000',
                  fontSize: `${widget.props.fontSize || 16}px`,
                  fontFamily: widget.props.fontFamily || 'sans-serif',
                  fontWeight: widget.props.fontWeight || 'normal',
                  textAlign: widget.props.align || 'center',
                  borderRadius: widget.props.borderRadius !== undefined && widget.props.borderRadius > 0 ? `${widget.props.borderRadius}px` : 
                                (widget.props.shape === 'circle' ? '50%' : 
                                 widget.props.shape === 'pill' ? '9999px' : 
                                 widget.props.shape === 'rounded' ? '8px' : 
                                 (widget.type === 'badge' ? '9999px' : (widget.type === 'alert_box' ? '8px' : '0'))),
                  padding: widget.props.padding !== undefined ? `${widget.props.padding}px` : (widget.type === 'badge' || widget.type === 'alert_box' ? '4px' : '0'),
                  borderWidth: widget.props.borderWidth !== undefined ? `${widget.props.borderWidth}px` : '0',
                  borderColor: widget.props.borderColor || 'transparent',
                  borderStyle: widget.props.borderWidth ? 'solid' : 'none'
                }}>
                  {widget.type === 'codigo_qr' && <div className="w-full h-full flex items-center justify-center text-xs text-gray-500 font-bold bg-white border border-gray-300">QR Token</div>}
                  {widget.type === 'barcode' && (
                    <div className="w-full h-full flex flex-col items-center justify-center text-xs font-mono font-bold bg-white border border-gray-300" style={{ color: widget.props.fgColor }}>
                      <div className="flex-1 w-full bg-repeat-x" style={{ backgroundImage: `linear-gradient(to right, ${widget.props.fgColor} 2px, transparent 2px, transparent 4px, ${widget.props.fgColor} 4px, ${widget.props.fgColor} 8px, transparent 8px, transparent 10px)`, backgroundSize: '12px 100%' }}></div>
                      <span className="mt-1">{renderText(widget.props.text)}</span>
                    </div>
                  )}
                  {widget.type === 'divider' && (
                    <div className="w-full h-full flex items-center justify-center">
                      <div style={{ width: widget.width > widget.height ? '100%' : `${widget.props.borderWidth}px`, height: widget.height >= widget.width ? '100%' : `${widget.props.borderWidth}px`, backgroundColor: widget.props.color }}></div>
                    </div>
                  )}
                  {widget.type === 'dynamic_icon' && (
                    <div className="w-full h-full flex items-center justify-center" style={{ color: widget.props.color, fontSize: `${widget.props.fontSize}px` }}>
                      {widget.props.iconName === 'star' && '⭐'}
                      {widget.props.iconName === 'shield' && '🛡️'}
                      {widget.props.iconName === 'crown' && '👑'}
                      {widget.props.iconName === 'check' && '✅'}
                      {widget.props.iconName === 'user' && '👤'}
                    </div>
                  )}
                  {widget.type === 'avatar_usuario' && (
                    widget.props.url ? 
                      <img src={widget.props.url} className="w-full h-full" style={{ objectFit: 'cover' }} alt="Avatar Placeholder" draggable={false} /> :
                      <div className="text-4xl text-gray-400 flex items-center justify-center w-full h-full">👤</div>
                  )}
                  {widget.type === 'live_clock' && <span>{widget.props.format}</span>}
                  {(widget.type === 'texto_dinamico' || widget.type === 'fecha_validez' || widget.type === 'badge') && <span className="w-full" style={{textAlign: widget.props.align}}>{widget.props.template || widget.props.text}</span>}
                  {widget.type === 'alert_box' && (
                    <div className="w-full h-full flex items-center justify-center gap-2">
                      <span className="text-xl">{widget.props.icon === 'info' ? 'ℹ️' : (widget.props.icon === 'warning' ? '⚠️' : '🚨')}</span>
                      <span className="font-medium text-sm flex-1">{widget.props.text}</span>
                    </div>
                  )}
                  {(widget.type === 'imagen_estatica' || widget.type === 'firma') && (
                    widget.props.url ? 
                      <img src={widget.props.url} className="w-full h-full" style={{ objectFit: widget.props.objectFit || 'contain' }} alt="Widget" draggable={false} /> :
                      <div className="w-full h-full border-2 border-dashed border-gray-400 flex items-center justify-center text-xs text-gray-500 bg-gray-50 text-center p-2">
                        {widget.type === 'firma' ? 'Firma (Subir Imagen)' : 'Sin Imagen'}
                      </div>
                  )}
                </div>
              </Rnd>
            ))}
          </div>
        )}
      </div>

      {/* PROPIEDADES (Panel Derecho) */}
      <div className="w-96 bg-white border border-gray-200 rounded-xl shadow-sm p-4 flex flex-col min-h-0 overflow-y-auto custom-scrollbar">
        <h3 className="font-bold text-gray-800 border-b pb-2 shrink-0 text-lg">⚙️ Propiedades</h3>
        {!selectedWidget ? (
          <div className="mt-4 flex flex-col gap-3">
            <p className="text-sm text-gray-500 mb-2 border-b pb-2">Propiedades del Lienzo (Fondo)</p>
            
            <div>
              <label className="text-xs font-bold text-gray-700">Color de Fondo</label>
              <input type="color" 
                value={template.backgroundColor || '#ffffff'} 
                onChange={e => updateTemplate({ ...template, backgroundColor: e.target.value })} 
                className="w-full border p-1 rounded h-8 cursor-pointer" />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700">Imagen de Fondo / Filigrana</label>
              <input type="text" 
                placeholder="URL (https://...)"
                value={template.backgroundImage || ''} 
                onChange={e => updateTemplate({ ...template, backgroundImage: e.target.value || null })} 
                className="w-full border p-1.5 rounded text-sm mb-2" />
              <input type="file" accept="image/*" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    updateTemplate({ ...template, backgroundImage: reader.result as string });
                  };
                  reader.readAsDataURL(file);
                }
              }} className="w-full text-xs border p-1 rounded" />
              <p className="text-[10px] text-gray-400 mt-1">Sube un archivo (se guarda localmente) o usa una URL absoluta.</p>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-2">
              <div>
                <label className="text-xs font-bold text-gray-700">Ancho Base (px)</label>
                <input type="number" 
                  value={template.width} 
                  onChange={e => updateTemplate({ ...template, width: parseInt(e.target.value) || 400 })} 
                  className="w-full border p-1 rounded text-sm bg-gray-50" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700">Alto Base (px)</label>
                <input type="number" 
                  value={template.height} 
                  onChange={e => updateTemplate({ ...template, height: parseInt(e.target.value) || 650 })} 
                  className="w-full border p-1 rounded text-sm bg-gray-50" />
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            <div className="bg-blue-50 p-3 text-xs font-mono text-blue-800 rounded-lg border border-blue-100 shadow-sm flex flex-col gap-1">
              <span><strong>ID:</strong> {selectedWidget.id}</span>
              <span><strong>Tipo:</strong> <span className="uppercase font-bold">{selectedWidget.type}</span></span>
            </div>
            
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => handleChangeZIndex(selectedWidget.id, 1)} title="Traer al frente" className="flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 border p-2 rounded-lg text-xs font-bold text-gray-700 transition shadow-sm">
                <span className="text-lg">🔼</span> Frente
              </button>
              <button onClick={() => handleChangeZIndex(selectedWidget.id, -1)} title="Enviar al fondo" className="flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 border p-2 rounded-lg text-xs font-bold text-gray-700 transition shadow-sm">
                <span className="text-lg">🔽</span> Fondo
              </button>
              <button onClick={() => handleDuplicateWidget(selectedWidget.id)} title="Duplicar" className="flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 border p-2 rounded-lg text-xs font-bold text-gray-700 transition shadow-sm">
                <span className="text-lg">👯</span> Clonar
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => handleCenterWidget(selectedWidget.id, 'h')} title="Centrar Horizontal" className="bg-gray-50 hover:bg-gray-100 border py-2 rounded-lg text-xs font-bold text-gray-700 transition shadow-sm flex items-center justify-center gap-1">
                <span className="text-lg">↔️</span> Centrar Horiz.
              </button>
              <button onClick={() => handleCenterWidget(selectedWidget.id, 'v')} title="Centrar Vertical" className="bg-gray-50 hover:bg-gray-100 border py-2 rounded-lg text-xs font-bold text-gray-700 transition shadow-sm flex items-center justify-center gap-1">
                <span className="text-lg">↕️</span> Centrar Vert.
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded-lg border border-gray-100 mt-2">
              <div>
                <label className="text-xs font-bold text-gray-700">Ancho (px)</label>
                <input type="number" value={selectedWidget.width} readOnly className="w-full border p-1 rounded text-sm bg-gray-100" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700">Alto (px)</label>
                <input type="number" value={selectedWidget.height} readOnly className="w-full border p-1 rounded text-sm bg-gray-100" />
              </div>
            </div>

            {(selectedWidget.type === 'texto_dinamico' || selectedWidget.type === 'fecha_validez' || selectedWidget.type === 'badge' || selectedWidget.type === 'alert_box' || selectedWidget.type === 'barcode') && (
              <div>
                <label className="text-xs font-bold text-gray-700">Texto / Plantilla</label>
                <input type="text" 
                  value={selectedWidget.props.template || selectedWidget.props.text || ''} 
                  onChange={e => {
                    const key = (selectedWidget.type === 'texto_dinamico' || selectedWidget.type === 'fecha_validez') ? 'template' : 'text';
                    const newWidgets = template.widgets.map(w => w.id === selectedWidget.id ? { ...w, props: { ...w.props, [key]: e.target.value } } : w);
                    updateTemplate({ ...template, widgets: newWidgets });
                  }} 
                  className="w-full border p-1.5 rounded text-sm" />
              </div>
            )}

            {(selectedWidget.type === 'imagen_estatica' || selectedWidget.type === 'avatar_usuario' || selectedWidget.type === 'firma') && (
              <div>
                <label className="text-xs font-bold text-gray-700">
                  {selectedWidget.type === 'avatar_usuario' ? 'Imagen / Silueta por Defecto' : (selectedWidget.type === 'firma' ? 'Imagen de Firma' : 'Imagen Estática / Logo')}
                </label>
                <input type="text" 
                  placeholder="URL (https://...)"
                  value={selectedWidget.props.url || ''} 
                  onChange={e => {
                    const newWidgets = template.widgets.map(w => w.id === selectedWidget.id ? { ...w, props: { ...w.props, url: e.target.value } } : w);
                    updateTemplate({ ...template, widgets: newWidgets });
                  }} 
                  className="w-full border p-1.5 rounded text-sm mb-2" />
                <input type="file" accept="image/*" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      const newWidgets = template.widgets.map(w => w.id === selectedWidget.id ? { ...w, props: { ...w.props, url: reader.result as string } } : w);
                      updateTemplate({ ...template, widgets: newWidgets });
                    };
                    reader.readAsDataURL(file);
                  }
                }} className="w-full text-xs border p-1 rounded" />
              </div>
            )}

            {selectedWidget.props.objectFit !== undefined && (
              <div>
                <label className="text-xs font-bold text-gray-700">Ajuste de Imagen</label>
                <select 
                  value={selectedWidget.props.objectFit} 
                  onChange={e => {
                    const newWidgets = template.widgets.map(w => w.id === selectedWidget.id ? { ...w, props: { ...w.props, objectFit: e.target.value } } : w);
                    updateTemplate({ ...template, widgets: newWidgets });
                  }} 
                  className="w-full border p-1.5 rounded text-sm bg-white"
                >
                  <option value="contain">Contener (Contain)</option>
                  <option value="cover">Cubrir (Cover)</option>
                  <option value="fill">Rellenar (Fill)</option>
                </select>
              </div>
            )}

            {selectedWidget.props.format !== undefined && (
              <div>
                <label className="text-xs font-bold text-gray-700">Formato (Hora)</label>
                <input type="text" 
                  value={selectedWidget.props.format} 
                  onChange={e => {
                    const newWidgets = template.widgets.map(w => w.id === selectedWidget.id ? { ...w, props: { ...w.props, format: e.target.value } } : w);
                    updateTemplate({ ...template, widgets: newWidgets });
                  }} 
                  className="w-full border p-1.5 rounded text-sm" />
              </div>
            )}

            {(selectedWidget.props.icon !== undefined || selectedWidget.props.iconName !== undefined) && (
              <div>
                <label className="text-xs font-bold text-gray-700">Icono</label>
                <select 
                  value={selectedWidget.props.icon || selectedWidget.props.iconName} 
                  onChange={e => {
                    const key = selectedWidget.props.icon !== undefined ? 'icon' : 'iconName';
                    const newWidgets = template.widgets.map(w => w.id === selectedWidget.id ? { ...w, props: { ...w.props, [key]: e.target.value } } : w);
                    updateTemplate({ ...template, widgets: newWidgets });
                  }} 
                  className="w-full border p-1.5 rounded text-sm bg-white"
                >
                  {selectedWidget.type === 'alert_box' ? (
                    <>
                      <option value="info">Información</option>
                      <option value="warning">Advertencia</option>
                      <option value="danger">Peligro</option>
                    </>
                  ) : (
                    <>
                      <option value="star">⭐ Estrella VIP</option>
                      <option value="shield">🛡️ Escudo / Seguridad</option>
                      <option value="crown">👑 Corona / Main</option>
                      <option value="check">✅ Verificado</option>
                      <option value="user">👤 Usuario / Prensa</option>
                    </>
                  )}
                </select>
              </div>
            )}

            {selectedWidget.props.fontFamily !== undefined && (
              <div>
                <label className="text-xs font-bold text-gray-700">Tipografía (Fuente)</label>
                <select 
                  value={selectedWidget.props.fontFamily} 
                  onChange={e => {
                    const newWidgets = template.widgets.map(w => w.id === selectedWidget.id ? { ...w, props: { ...w.props, fontFamily: e.target.value } } : w);
                    updateTemplate({ ...template, widgets: newWidgets });
                  }} 
                  className="w-full border p-1.5 rounded text-sm bg-white"
                >
                  <option value="sans-serif">Sans Serif (Inter/Roboto)</option>
                  <option value="serif">Serif (Elegante)</option>
                  <option value="monospace">Monospace (Técnico)</option>
                </select>
              </div>
            )}

            {selectedWidget.props.fontSize !== undefined && (
              <div>
                <label className="text-xs font-bold text-gray-700">Tamaño de Fuente (px)</label>
                <input type="number" 
                  value={selectedWidget.props.fontSize} 
                  onChange={e => {
                    const newWidgets = template.widgets.map(w => w.id === selectedWidget.id ? { ...w, props: { ...w.props, fontSize: parseInt(e.target.value) } } : w);
                    updateTemplate({ ...template, widgets: newWidgets });
                  }} 
                  className="w-full border p-1.5 rounded text-sm" />
              </div>
            )}

            {selectedWidget.props.fontWeight !== undefined && (
              <div>
                <label className="text-xs font-bold text-gray-700">Grosor de Fuente</label>
                <select 
                  value={selectedWidget.props.fontWeight} 
                  onChange={e => {
                    const newWidgets = template.widgets.map(w => w.id === selectedWidget.id ? { ...w, props: { ...w.props, fontWeight: e.target.value } } : w);
                    updateTemplate({ ...template, widgets: newWidgets });
                  }} 
                  className="w-full border p-1.5 rounded text-sm bg-white"
                >
                  <option value="normal">Normal</option>
                  <option value="bold">Negrita</option>
                </select>
              </div>
            )}

            {selectedWidget.props.align !== undefined && (
              <div>
                <label className="text-xs font-bold text-gray-700">Alineación</label>
                <select 
                  value={selectedWidget.props.align} 
                  onChange={e => {
                    const newWidgets = template.widgets.map(w => w.id === selectedWidget.id ? { ...w, props: { ...w.props, align: e.target.value } } : w);
                    updateTemplate({ ...template, widgets: newWidgets });
                  }} 
                  className="w-full border p-1.5 rounded text-sm bg-white"
                >
                  <option value="left">Izquierda</option>
                  <option value="center">Centro</option>
                  <option value="right">Derecha</option>
                </select>
              </div>
            )}

            {selectedWidget.props.color !== undefined && selectedWidget.type !== 'divider' && (
              <div>
                <label className="text-xs font-bold text-gray-700">Color de Texto / Icono</label>
                <input type="color" 
                  value={selectedWidget.props.color} 
                  onChange={e => {
                    const newWidgets = template.widgets.map(w => w.id === selectedWidget.id ? { ...w, props: { ...w.props, color: e.target.value } } : w);
                    updateTemplate({ ...template, widgets: newWidgets });
                  }} 
                  className="w-full border p-1 rounded h-8 cursor-pointer" />
              </div>
            )}

            {selectedWidget.type === 'divider' && (
              <div>
                <label className="text-xs font-bold text-gray-700">Color de Línea</label>
                <input type="color" 
                  value={selectedWidget.props.color} 
                  onChange={e => {
                    const newWidgets = template.widgets.map(w => w.id === selectedWidget.id ? { ...w, props: { ...w.props, color: e.target.value } } : w);
                    updateTemplate({ ...template, widgets: newWidgets });
                  }} 
                  className="w-full border p-1 rounded h-8 cursor-pointer" />
              </div>
            )}

            {selectedWidget.props.bg !== undefined && (
              <div>
                <label className="text-xs font-bold text-gray-700">Color de Fondo (Widget)</label>
                <input type="color" 
                  value={selectedWidget.props.bg} 
                  onChange={e => {
                    const newWidgets = template.widgets.map(w => w.id === selectedWidget.id ? { ...w, props: { ...w.props, bg: e.target.value } } : w);
                    updateTemplate({ ...template, widgets: newWidgets });
                  }} 
                  className="w-full border p-1 rounded h-8 cursor-pointer" />
              </div>
            )}

            {selectedWidget.props.fgColor !== undefined && (
              <div>
                <label className="text-xs font-bold text-gray-700">Color de Código QR</label>
                <input type="color" 
                  value={selectedWidget.props.fgColor} 
                  onChange={e => {
                    const newWidgets = template.widgets.map(w => w.id === selectedWidget.id ? { ...w, props: { ...w.props, fgColor: e.target.value } } : w);
                    updateTemplate({ ...template, widgets: newWidgets });
                  }} 
                  className="w-full border p-1 rounded h-8 cursor-pointer" />
              </div>
            )}

            {selectedWidget.props.shape !== undefined && (
              <div>
                <label className="text-xs font-bold text-gray-700">Formato / Forma</label>
                <select 
                  value={selectedWidget.props.shape} 
                  onChange={e => {
                    let newRadius = selectedWidget.props.borderRadius;
                    if (e.target.value === 'pill' || e.target.value === 'circle') newRadius = 9999;
                    if (e.target.value === 'rounded') newRadius = 8;
                    if (e.target.value === 'square') newRadius = 0;

                    const newWidgets = template.widgets.map(w => w.id === selectedWidget.id ? { ...w, props: { ...w.props, shape: e.target.value, borderRadius: newRadius } } : w);
                    updateTemplate({ ...template, widgets: newWidgets });
                  }} 
                  className="w-full border p-1.5 rounded text-sm bg-white"
                >
                  <option value="circle">Círculo / Píldora</option>
                  <option value="pill">Píldora (Ovalado)</option>
                  <option value="rounded">Bordes Redondeados</option>
                  <option value="square">Cuadrado</option>
                </select>
              </div>
            )}

            <div className="mt-2 border-t pt-3">
              <p className="text-xs font-bold text-gray-500 mb-2">📦 Estilos de Caja (Bordes y Relleno)</p>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-gray-700">Grosor Borde (px)</label>
                  <input type="number" 
                    value={selectedWidget.props.borderWidth || 0} 
                    onChange={e => {
                      const newWidgets = template.widgets.map(w => w.id === selectedWidget.id ? { ...w, props: { ...w.props, borderWidth: parseInt(e.target.value) || 0 } } : w);
                      updateTemplate({ ...template, widgets: newWidgets });
                    }} 
                    className="w-full border p-1 rounded text-sm bg-gray-50" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700">Color Borde</label>
                  <input type="color" 
                    value={selectedWidget.props.borderColor || '#000000'} 
                    onChange={e => {
                      const newWidgets = template.widgets.map(w => w.id === selectedWidget.id ? { ...w, props: { ...w.props, borderColor: e.target.value } } : w);
                      updateTemplate({ ...template, widgets: newWidgets });
                    }} 
                    className="w-full border p-1 rounded h-8 cursor-pointer" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <label className="text-xs font-bold text-gray-700">Redondeo (px)</label>
                  <input type="number" 
                    value={selectedWidget.props.borderRadius || 0} 
                    onChange={e => {
                      const newWidgets = template.widgets.map(w => w.id === selectedWidget.id ? { ...w, props: { ...w.props, borderRadius: parseInt(e.target.value) || 0 } } : w);
                      updateTemplate({ ...template, widgets: newWidgets });
                    }} 
                    className="w-full border p-1 rounded text-sm bg-gray-50" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700">Relleno Padding (px)</label>
                  <input type="number" 
                    value={selectedWidget.props.padding || 0} 
                    onChange={e => {
                      const newWidgets = template.widgets.map(w => w.id === selectedWidget.id ? { ...w, props: { ...w.props, padding: parseInt(e.target.value) || 0 } } : w);
                      updateTemplate({ ...template, widgets: newWidgets });
                    }} 
                    className="w-full border p-1 rounded text-sm bg-gray-50" />
                </div>
              </div>
            </div>

            <button 
              onClick={() => handleDeleteWidget(selectedWidget.id)}
              className="mt-6 w-full bg-red-50 text-red-600 border border-red-200 font-bold py-2.5 rounded-lg hover:bg-red-100 transition shadow-sm text-sm"
            >
              🗑️ Eliminar Elemento
            </button>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
