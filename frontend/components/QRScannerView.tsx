'use client';

import React, { useState, useEffect, useRef } from 'react';
import Swal from 'sweetalert2';
import { useOfflineAcreditacion, playAudioFeedback } from '@/hooks/useOfflineAcreditacion';
import PushNotificationToggle from '@/components/PushNotificationToggle';
import { OfflineSyncManagerModal } from '@/components/OfflineSyncManagerModal';

interface QRScannerViewProps {
  triggerWalkInModal?: boolean;
  onWalkInModalClosed?: () => void;
  triggerFocusDni?: number;
}

export const QRScannerView: React.FC<QRScannerViewProps> = ({
  triggerWalkInModal = false,
  onWalkInModalClosed,
  triggerFocusDni,
}) => {
  const { isOnline, pendingCount, queueAcreditacion, syncAcreditaciones } =
    useOfflineAcreditacion();
  const [showSyncModal, setShowSyncModal] = useState<boolean>(false);
  const [tokenInput, setTokenInput] = useState<string>('');
  const [lastResult, setLastResult] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [operadorId, setOperadorId] = useState<number>(1);
  const [operadores, setOperadores] = useState<any[]>([]);
  const [puntoAccesoId, setPuntoAccesoId] = useState<number>(1);
  const [puntosAcceso, setPuntosAcceso] = useState<any[]>([]);
  const [tipoAcreditacionId, setTipoAcreditacionId] = useState<number>(1);
  const [tiposAcreditacion, setTiposAcreditacion] = useState<any[]>([]);
  const [actividades, setActividades] = useState<any[]>([]);
  const [actividadId, setActividadId] = useState<number | null>(null);
  const [modoControl, setModoControl] = useState<'INGRESO' | 'EGRESO'>('INGRESO');
  const [showWalkInModal, setShowWalkInModal] = useState<boolean>(false);
  const [walkInData, setWalkInData] = useState<{
    dni_pasaporte: string;
    nombre: string;
    apellido: string;
    email: string;
    celular: string;
    rol_principal_id: number;
    punto_acceso_id: number;
  }>({
    dni_pasaporte: '',
    nombre: '',
    apellido: '',
    email: '',
    celular: '+5491100000000',
    rol_principal_id: 1,
    punto_acceso_id: 1,
  });
  const [walkInLoading, setWalkInLoading] = useState<boolean>(false);
  const [recentAcreditaciones, setRecentAcreditaciones] = useState<any[]>([]);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraLoading, setCameraLoading] = useState<boolean>(false);
  const [modoKiosco, setModoKiosco] = useState<boolean>(false);
  const [isMobileToolsOpen, setIsMobileToolsOpen] = useState<boolean>(false);

  const scannerRef = useRef<any>(null);
  const qrInputRef = useRef<HTMLInputElement>(null);

  // Auto-foco permanente en modo kiosco
  useEffect(() => {
    if (modoKiosco && qrInputRef.current) {
      qrInputRef.current.focus();
    }
  }, [modoKiosco, loading, lastResult]);

  // Manejar apertura externa del modal Walk-in
  useEffect(() => {
    if (triggerWalkInModal) {
      setShowWalkInModal(true);
    }
  }, [triggerWalkInModal]);

  // Manejar foco directo al input de DNI / Token QR
  useEffect(() => {
    if (triggerFocusDni) {
      setTimeout(() => {
        if (qrInputRef.current) {
          qrInputRef.current.focus();
          qrInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  }, [triggerFocusDni]);

  const fetchRecentAcreditaciones = async () => {
    try {
      const res = await fetch('/api/operator/recent');
      if (res.ok) {
        const data = await res.json();
        setRecentAcreditaciones(data.acreditaciones || []);
      }
    } catch (_) {}
  };

  const handleOperadorChange = (id: number) => {
    setOperadorId(id);
    if (typeof window !== 'undefined') {
      localStorage.setItem('congreso_operador_id', String(id));
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedOp = localStorage.getItem('congreso_operador_id');
      if (savedOp) setOperadorId(Number(savedOp));
    }

    const loadConfig = async () => {
      try {
        const res = await fetch('/api/operator/config');
        if (res.ok) {
          const data = await res.json();
          if (data.operadores && data.operadores.length > 0) setOperadores(data.operadores);
          if (data.puntos_acceso && data.puntos_acceso.length > 0)
            setPuntosAcceso(data.puntos_acceso);
          if (data.tipos_acreditacion && data.tipos_acreditacion.length > 0)
            setTiposAcreditacion(data.tipos_acreditacion);
          if (data.actividades && data.actividades.length > 0) {
            setActividades(data.actividades);
            setActividadId(data.actividades[0].id);
          }
        }
      } catch (_) {}
    };

    loadConfig();
    fetchRecentAcreditaciones();

    const interval = setInterval(fetchRecentAcreditaciones, 10000);
    return () => clearInterval(interval);
  }, []);

  const startCamera = async () => {
    setCameraLoading(true);
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const qrScanner = new Html5Qrcode('qr-camera-reader');
      scannerRef.current = qrScanner;

      await qrScanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        async (decodedText: string) => {
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(100);
          }
          await handleProcesarQR(decodedText);
        },
        () => {
          // Ignorar cuadros sin QR detectado
        }
      );
      setCameraActive(true);
    } catch (err: any) {
      Swal.fire({
        icon: 'warning',
        title: 'Cámara no disponible',
        text: 'No se pudo iniciar la cámara web o faltan permisos de acceso en este navegador.',
        confirmButtonColor: '#005691',
      });
      setCameraActive(false);
    } finally {
      setCameraLoading(false);
    }
  };

  const stopCamera = async () => {
    try {
      if (scannerRef.current) {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
        scannerRef.current = null;
      }
    } catch (_) {}
    setCameraActive(false);
  };

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            scannerRef.current.stop();
          }
          scannerRef.current.clear();
        } catch (_) {}
      }
    };
  }, []);

  const handleProcesarQR = async (tokenParaProcesar?: string) => {
    const token = (tokenParaProcesar || tokenInput).trim();
    if (!token) return;

    if (token.length < 10) {
      playAudioFeedback('error');
      setLastResult({
        status: 'REJECTED',
        message: 'El código QR o token es inválido (longitud mínima no alcanzada).',
      });
      return;
    }

    setLoading(true);
    setLastResult(null);

    const tipoSel = tiposAcreditacion.find((t) => t.id === tipoAcreditacionId);
    const requiereAct = tipoSel ? !!tipoSel.requiere_actividad : tipoAcreditacionId > 1;

    // Si estamos fuera de línea, guardar en IndexedDB
    if (!isOnline) {
      await queueAcreditacion({
        qr_token: token.trim(),
        punto_acceso_id: puntoAccesoId,
        tipo_acreditacion_id: tipoAcreditacionId,
        actividad_id: requiereAct ? (actividadId || undefined) : undefined,
        operador_id: operadorId,
        tipo_movimiento: modoControl,
      });
      setLastResult({
        status: 'OFFLINE_QUEUED',
        message: `${modoControl === 'EGRESO' ? 'Egreso' : 'Acreditación'} encolado en almacenamiento local del dispositivo.`,
      });
      setTokenInput('');
      setLoading(false);
      return;
    }

    try {
      const payload: any = {
        qr_token: token.trim(),
        punto_acceso_id: puntoAccesoId,
        tipo_acreditacion_id: tipoAcreditacionId,
        operador_id: operadorId,
        tipo_movimiento: modoControl,
      };
      if (requiereAct && actividadId) {
        payload.actividad_id = actividadId;
      }

      const res = await fetch('/api/operator/acreditar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        playAudioFeedback('success');
        const defaultMsg =
          modoControl === 'EGRESO'
            ? '¡Egreso Registrado! Salida del predio asentada correctamente.'
            : data.reingreso
              ? data.message || '¡Reingreso Verificado! Acceso autorizado.'
              : '¡Acreditación Exitosa! Acceso Autorizado.';

        setLastResult({
          status: 'SUCCESS',
          tipo_movimiento: data.tipo_movimiento || modoControl,
          usuario: data.usuario,
          message: data.message || defaultMsg,
          actividad: data.actividad,
        });
        fetchRecentAcreditaciones();
      } else if (res.status === 409) {
        playAudioFeedback('error');
        setLastResult({
          status: 'DUPLICATED',
          error: data.error,
          message: data.message,
          usuario: data.usuario,
          hora_previa: data.hora_previa,
          punto_previo: data.punto_previo,
        });
      } else {
        playAudioFeedback('error');
        setLastResult({
          status: 'REJECTED',
          error: data.error,
          message: data.message || 'Credencial no habilitada.',
          usuario: data.usuario,
        });
      }
    } catch (err: any) {
      playAudioFeedback('error');
      setLastResult({
        status: 'NETWORK_ERROR',
        message: 'Error de comunicación. Guardando en cola local de contingencia...',
      });
      await queueAcreditacion({
        qr_token: token.trim(),
        punto_acceso_id: puntoAccesoId,
        tipo_acreditacion_id: tipoAcreditacionId,
        actividad_id: requiereAct ? (actividadId || undefined) : undefined,
        operador_id: operadorId,
        tipo_movimiento: modoControl,
      });
    } finally {
      setTokenInput('');
      setLoading(false);
    }
  };

  const handleWalkInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWalkInLoading(true);
    try {
      const res = await fetch('/api/operator/walk-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...walkInData,
          punto_acceso_id: puntoAccesoId,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        playAudioFeedback('success');
        setShowWalkInModal(false);
        if (onWalkInModalClosed) onWalkInModalClosed();
        setLastResult({
          status: 'SUCCESS',
          tipo_movimiento: 'INGRESO',
          usuario: data.usuario,
          message: '¡Acreditación In Situ Walk-in Exitosa! Participante dado de alta y habilitado.',
        });
        setWalkInData({
          dni_pasaporte: '',
          nombre: '',
          apellido: '',
          email: '',
          celular: '+5491100000000',
          rol_principal_id: 1,
          punto_acceso_id: puntoAccesoId,
        });
        fetchRecentAcreditaciones();
        Swal.fire({
          icon: 'success',
          title: 'Walk-in Acreditado',
          text: `${data.usuario?.nombre} ${data.usuario?.apellido} fue dado de alta e ingresó correctamente.`,
          confirmButtonColor: '#005691',
        });
      } else {
        playAudioFeedback('error');
        Swal.fire({
          icon: 'error',
          title: 'Error en Walk-in',
          text: data.message || data.error || 'No se pudo procesar la acreditación rápida.',
          confirmButtonColor: '#005691',
        });
      }
    } catch (err: any) {
      playAudioFeedback('error');
      Swal.fire({
        icon: 'error',
        title: 'Error de conexión',
        text: 'Ocurrió un fallo al comunicar con el servidor.',
        confirmButtonColor: '#005691',
      });
    } finally {
      setWalkInLoading(false);
    }
  };

  return (
    <div
      className={
        modoKiosco
          ? 'position-fixed top-0 start-0 w-100 h-100 bg-light p-4 overflow-auto'
          : 'p-3'
      }
      style={modoKiosco ? { zIndex: 99999 } : undefined}
    >
      {/* Banner de Modo Kiosco cuando está activo */}
      {modoKiosco && (
        <div className="alert alert-dark shadow-sm d-flex align-items-center justify-content-between py-2 px-3 mb-3">
          <div className="d-flex align-items-center gap-2">
            <span className="badge bg-warning text-dark fs-6">
              <i className="bx bx-broadcast me-1"></i>MODO KIOSCO ACTIVO
            </span>
            <span className="small text-muted">
              Auto-foco permanente en lector. Presione Esc o el botón rojo para salir.
            </span>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-outline-danger fw-bold"
            onClick={() => setModoKiosco(false)}
          >
            <i className="bx bx-exit me-1"></i> Salir de Kiosco
          </button>
        </div>
      )}

      {/* Barra de Estado de Conectividad y Cola Offline */}
      <div className="d-flex flex-wrap align-items-center justify-content-between p-2.5 p-sm-3 rounded mb-3 shadow-sm bg-white border gap-2">
        <div className="d-flex align-items-center gap-2">
          <span
            className={`rounded-circle d-inline-block ${isOnline ? 'bg-success' : 'bg-danger'}`}
            style={{ width: '12px', height: '12px' }}
          ></span>
          <span className="small fw-bold d-none d-sm-inline">Estado Operativo:</span>
          <span className={`badge ${isOnline ? 'bg-success' : 'bg-danger'}`} style={{ fontSize: '0.72rem' }}>
            {isOnline ? 'ONLINE' : 'OFFLINE'}
          </span>
          {pendingCount > 0 && (
            <span className="badge bg-warning text-dark fw-bold" style={{ fontSize: '0.72rem' }}>
              {pendingCount} pend.
            </span>
          )}
        </div>

        {/* VISTA ESCRITORIO (>= sm): BOTONES INDIVIDUALES */}
        <div className="hidden sm:flex align-items-center gap-2">
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
            onClick={() => setShowSyncModal(true)}
            title="Abrir panel detallado de monitoreo de sincronización IndexedDB"
          >
            <i className="bx bx-data"></i>
            <span>Gestor Cola</span>
          </button>
          {isOnline && pendingCount > 0 && (
            <button
              type="button"
              className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1"
              onClick={async () => {
                await syncAcreditaciones();
                Swal.fire({
                  toast: true,
                  position: 'top-end',
                  icon: 'success',
                  title: 'Cola sincronizada con el servidor central',
                  showConfirmButton: false,
                  timer: 3000,
                  timerProgressBar: true,
                });
              }}
            >
              <i className="bx bx-sync"></i> Sincronizar
            </button>
          )}

          <button
            type="button"
            className={`btn btn-sm ${modoKiosco ? 'btn-danger shadow' : 'btn-dark'} d-flex align-items-center gap-1 fw-bold`}
            onClick={() => {
              setModoKiosco(!modoKiosco);
              if (!modoKiosco && typeof window !== 'undefined') {
                if (document.documentElement.requestFullscreen) {
                  document.documentElement.requestFullscreen().catch(() => {});
                }
              } else if (modoKiosco && typeof window !== 'undefined') {
                if (document.exitFullscreen && document.fullscreenElement) {
                  document.exitFullscreen().catch(() => {});
                }
              }
            }}
          >
            <i className={`bx ${modoKiosco ? 'bx-exit-fullscreen' : 'bx-fullscreen'}`}></i>
            {modoKiosco ? 'Salir de Kiosco' : 'Modo Kiosco'}
          </button>

          <PushNotificationToggle compact={true} />
        </div>

        {/* VISTA MÓVIL (< sm): BOTÓN SELECTOR COMPACTO DE 28PX CON MENÚ DESPLEGABLE */}
        <div className="sm:hidden relative">
          <button
            type="button"
            onClick={() => setIsMobileToolsOpen(!isMobileToolsOpen)}
            className="h-7 px-2.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 text-[11px] font-semibold rounded-lg border border-slate-300 flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
            aria-label="Abrir selector de herramientas en móviles"
            aria-expanded={isMobileToolsOpen}
          >
            <span className="flex items-center gap-1">
              <i className="bx bx-wrench fs-6 text-primary"></i>
              <span>Herramientas</span>
            </span>
            <span className="text-slate-400 text-[10px] ml-0.5">
              {isMobileToolsOpen ? '▲' : '▼'}
            </span>
          </button>

          {isMobileToolsOpen && (
            <>
              <div
                className="fixed inset-0 z-40 bg-black/30 backdrop-blur-2xs"
                onClick={() => setIsMobileToolsOpen(false)}
              />
              <div
                className="absolute right-0 top-8 z-50 bg-white border border-gray-200 rounded-xl shadow-2xl p-1 min-w-[220px] max-w-[90vw]"
                style={{ color: '#1e293b' }}
              >
                <div className="px-2.5 py-1 text-[9px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 mb-1">
                  Herramientas Operativas
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsMobileToolsOpen(false);
                    setShowSyncModal(true);
                  }}
                  className="w-full h-[32px] flex items-center gap-2 px-2 rounded-lg text-[11px] font-medium transition cursor-pointer text-left text-gray-700 hover:bg-slate-100"
                >
                  <i className="bx bx-data fs-5 text-secondary flex-shrink-0"></i>
                  <span className="truncate flex-1">Gestor de Cola Offline</span>
                  {pendingCount > 0 && (
                    <span className="badge bg-warning text-dark">{pendingCount}</span>
                  )}
                </button>

                {isOnline && pendingCount > 0 && (
                  <button
                    type="button"
                    onClick={async () => {
                      setIsMobileToolsOpen(false);
                      await syncAcreditaciones();
                      Swal.fire({
                        toast: true,
                        position: 'top-end',
                        icon: 'success',
                        title: 'Cola sincronizada',
                        showConfirmButton: false,
                        timer: 2500,
                      });
                    }}
                    className="w-full h-[32px] flex items-center gap-2 px-2 rounded-lg text-[11px] font-medium transition cursor-pointer text-left text-blue-700 hover:bg-blue-50"
                  >
                    <i className="bx bx-sync fs-5 text-primary flex-shrink-0"></i>
                    <span className="truncate flex-1">Sincronizar Lote Ahora</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setIsMobileToolsOpen(false);
                    setModoKiosco(!modoKiosco);
                    if (!modoKiosco && typeof window !== 'undefined') {
                      if (document.documentElement.requestFullscreen) {
                        document.documentElement.requestFullscreen().catch(() => {});
                      }
                    } else if (modoKiosco && typeof window !== 'undefined') {
                      if (document.exitFullscreen && document.fullscreenElement) {
                        document.exitFullscreen().catch(() => {});
                      }
                    }
                  }}
                  className="w-full h-[32px] flex items-center gap-2 px-2 rounded-lg text-[11px] font-medium transition cursor-pointer text-left text-gray-700 hover:bg-slate-100"
                >
                  <i className={`bx ${modoKiosco ? 'bx-exit-fullscreen text-danger' : 'bx-fullscreen text-dark'} fs-5 flex-shrink-0`}></i>
                  <span className="truncate flex-1">
                    {modoKiosco ? 'Desactivar Modo Kiosco' : 'Activar Modo Kiosco'}
                  </span>
                </button>

                <div className="border-t border-gray-100 my-1 pt-1 px-2">
                  <PushNotificationToggle compact={true} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Selectores de Operador, Punto de Acceso, Tipo y Actividad Dinámica */}
      {(() => {
        const tipoSelAct = tiposAcreditacion.find((t) => t.id === tipoAcreditacionId);
        const requiereActividad = tipoSelAct
          ? !!tipoSelAct.requiere_actividad
          : tipoAcreditacionId > 1;

        return (
          <div className="row g-2 mb-3">
            <div className={requiereActividad ? 'col-md-3 col-6' : 'col-md-4 col-6'}>
              <label className="form-label small fw-bold text-secondary">
                <i className="bx bx-user-check me-1"></i>Operador
              </label>
              <select
                className="form-select form-select-sm"
                value={operadorId}
                onChange={(e) => handleOperadorChange(Number(e.target.value))}
              >
                {operadores.length > 0 ? (
                  operadores.map((op) => (
                    <option key={op.id} value={op.id}>
                      {op.nombre} {op.apellido}
                    </option>
                  ))
                ) : (
                  <>
                    <option value={1}>Operador Turno Mañana 1</option>
                    <option value={2}>Operador Turno Mañana 2</option>
                    <option value={3}>Operador Turno Tarde 1</option>
                  </>
                )}
              </select>
            </div>

            <div className={requiereActividad ? 'col-md-3 col-6' : 'col-md-4 col-6'}>
              <label className="form-label small fw-bold text-secondary">
                <i className="bx bx-door-open me-1"></i>Punto de Acceso
              </label>
              <select
                className="form-select form-select-sm"
                value={puntoAccesoId}
                onChange={(e) => setPuntoAccesoId(Number(e.target.value))}
              >
                {puntosAcceso.length > 0 ? (
                  puntosAcceso.map((pa) => (
                    <option key={pa.id} value={pa.id}>
                      {pa.nombre}
                    </option>
                  ))
                ) : (
                  <>
                    <option value={1}>Puerta Principal (Hall PB)</option>
                    <option value={2}>Puerta Lateral (Rampa Accesible)</option>
                    <option value={3}>Auditorio Central (Aula Magna)</option>
                  </>
                )}
              </select>
            </div>

            <div className={requiereActividad ? 'col-md-3 col-6' : 'col-md-4 col-6'}>
              <label className="form-label small fw-bold text-secondary">
                <i className="bx bx-tag me-1"></i>Tipo Acreditación
              </label>
              <select
                className="form-select form-select-sm"
                value={tipoAcreditacionId}
                onChange={(e) => setTipoAcreditacionId(Number(e.target.value))}
              >
                {tiposAcreditacion.length > 0 ? (
                  tiposAcreditacion.map((ta) => (
                    <option key={ta.id} value={ta.id}>
                      {ta.descripcion || ta.codigo}
                    </option>
                  ))
                ) : (
                  <>
                    <option value={1}>Acceso General al Predio</option>
                    <option value={2}>Actividad en Aula</option>
                    <option value={3}>Taller Práctico</option>
                  </>
                )}
              </select>
            </div>

            {requiereActividad && (
              <div className="col-md-3 col-6">
                <label className="form-label small fw-bold text-primary">
                  <i className="bx bx-chalkboard me-1"></i>Actividad / Sala *
                </label>
                <select
                  className="form-select form-select-sm border-primary fw-semibold"
                  value={actividadId || ''}
                  onChange={(e) => setActividadId(Number(e.target.value))}
                  required
                >
                  {actividades.length > 0 ? (
                    actividades.map((act) => (
                      <option key={act.id} value={act.id}>
                        {act.nombre}
                      </option>
                    ))
                  ) : (
                    <option value="">Sin actividades cargadas</option>
                  )}
                </select>
              </div>
            )}
          </div>
        );
      })()}

      {/* Entrada y Simulación de Escaneo */}
      <div className="card shadow-sm border-0 mb-4">
        <div className="card-body">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
            <h2 className="h6 fw-bold text-dark mb-0">
              <i className="bx bx-qr-scan text-primary me-2"></i>Escaneo de Código QR
            </h2>

            <button
              type="button"
              className={`btn btn-sm ${cameraActive ? 'btn-danger' : 'btn-outline-primary'} fw-bold d-inline-flex align-items-center gap-1`}
              disabled={cameraLoading}
              onClick={cameraActive ? stopCamera : startCamera}
            >
              <i className={`bx ${cameraActive ? 'bx-stop-circle' : 'bx-camera'}`}></i>
              {cameraLoading ? (
                <span className="spinner-border spinner-border-sm"></span>
              ) : cameraActive ? (
                'Detener Cámara'
              ) : (
                'Escanear con Cámara'
              )}
            </button>
          </div>

          {/* Selector Bidireccional INGRESO / EGRESO y Botón Walk-in */}
          <div className="row g-2 mb-3">
            <div className="col-md-8 col-12">
              <div className="btn-group w-100 p-1 bg-light rounded border shadow-sm" role="group">
                <button
                  type="button"
                  className={`btn btn-sm fw-bold d-flex align-items-center justify-content-center gap-2 py-2 ${
                    modoControl === 'INGRESO'
                      ? 'btn-success text-white shadow'
                      : 'btn-light text-muted'
                  }`}
                  onClick={() => setModoControl('INGRESO')}
                >
                  <i className="bx bx-log-in-circle fs-5"></i>
                  <span>MODO: INGRESO / ACCESO</span>
                  {modoControl === 'INGRESO' && (
                    <span className="badge bg-white text-success ms-1">ACTIVO</span>
                  )}
                </button>
                <button
                  type="button"
                  className={`btn btn-sm fw-bold d-flex align-items-center justify-content-center gap-2 py-2 ${
                    modoControl === 'EGRESO'
                      ? 'btn-danger text-white shadow'
                      : 'btn-light text-muted'
                  }`}
                  onClick={() => setModoControl('EGRESO')}
                >
                  <i className="bx bx-log-out-circle fs-5"></i>
                  <span>MODO: EGRESO / SALIDA</span>
                  {modoControl === 'EGRESO' && (
                    <span className="badge bg-white text-danger ms-1">ACTIVO</span>
                  )}
                </button>
              </div>
            </div>

            <div className="col-md-4 col-12">
              <button
                type="button"
                className="btn btn-sm btn-outline-warning w-100 h-100 fw-bold d-flex align-items-center justify-content-center gap-2 shadow-sm text-dark"
                style={{ backgroundColor: '#fff8e6', borderColor: '#f59e0b' }}
                onClick={() => setShowWalkInModal(true)}
              >
                <i className="bx bx-user-plus text-warning fs-5"></i>
                <span>Alta Rápida (Walk-in)</span>
              </button>
            </div>
          </div>

          <p className="small text-muted mb-3">
            {modoControl === 'INGRESO' ? (
              <>
                <i className="bx bx-info-circle text-success me-1"></i>
                <strong>Modo Ingreso:</strong> Valida estado de credencial y aforo. Si el
                participante ya salió y reingresa, registrará el reingreso legítimo.
              </>
            ) : (
              <>
                <i className="bx bx-info-circle text-danger me-1"></i>
                <strong>Modo Egreso:</strong> Asienta la salida física del predio o sala para
                descontar aforo y habilitar un futuro reingreso sin conflicto.
              </>
            )}
          </p>

          {/* Contenedor del Lector de Cámara */}
          <div
            id="qr-camera-reader"
            className={`${cameraActive ? 'd-block mb-3' : 'd-none'}`}
            style={{ width: '100%', maxWidth: '380px', margin: '0 auto' }}
          ></div>

          <div className="input-group mb-2">
            <input
              ref={qrInputRef}
              type="text"
              className={`form-control ${modoKiosco ? 'form-control-lg fs-4' : ''}`}
              placeholder={modoKiosco ? '⚡ Lector QR Listo (Apunta el lector aquí o escribe DNI)...' : 'Token QR o DNI...'}
              value={tokenInput}
              minLength={5}
              maxLength={500}
              title="Token QR criptográfico o DNI"
              onChange={(e) => setTokenInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleProcesarQR()}
              autoFocus
            />
            <button
              className="btn btn-primary fw-bold"
              type="button"
              disabled={loading || !tokenInput.trim()}
              onClick={() => handleProcesarQR()}
            >
              {loading ? (
                <span className="spinner-border spinner-border-sm"></span>
              ) : (
                <>
                  <i className="bx bx-check-circle me-1"></i> Validar Acreditación
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* RESULTADO Y COTEJO VISUAL OBLIGATORIO DE FOTO */}
      {lastResult && (
        <div
          className={`card shadow mb-4 border-start border-4 ${
            lastResult.status === 'SUCCESS'
              ? 'border-success'
              : lastResult.status === 'DUPLICATED'
                ? 'border-danger'
                : lastResult.status === 'OFFLINE_QUEUED'
                  ? 'border-warning'
                  : 'border-danger'
          }`}
        >
          <div
            className={`card-header py-2 px-3 fw-bold text-white d-flex align-items-center justify-content-between ${
              lastResult.status === 'SUCCESS'
                ? lastResult.tipo_movimiento === 'EGRESO'
                  ? 'bg-danger'
                  : 'bg-success'
                : lastResult.status === 'DUPLICATED'
                  ? 'bg-danger'
                  : lastResult.status === 'OFFLINE_QUEUED'
                    ? 'bg-warning text-dark'
                    : 'bg-danger'
            }`}
          >
            <span>
              <i
                className={`bx ${
                  lastResult.status === 'SUCCESS'
                    ? lastResult.tipo_movimiento === 'EGRESO'
                      ? 'bx-log-out-circle'
                      : 'bx-check-circle'
                    : lastResult.status === 'DUPLICATED'
                      ? 'bx-block'
                      : 'bx-error'
                } me-2 fs-5`}
              ></i>
              {lastResult.status === 'SUCCESS'
                ? lastResult.tipo_movimiento === 'EGRESO'
                  ? 'EGRESO REGISTRADO (SALIDA ASENTADA)'
                  : 'ACREDITACIÓN AUTORIZADA'
                : lastResult.status === 'DUPLICATED'
                  ? '¡ALERTA DE DUPLICIDAD! (ANTI-PASSBACK)'
                  : lastResult.status === 'OFFLINE_QUEUED'
                    ? 'GUARDADO LOCAL (MODO OFFLINE)'
                    : 'ACCESO DENEGADO'}
            </span>
          </div>

          <div className="card-body">
            <p className="lead fw-bold mb-3">{lastResult.message}</p>

            {/* Cotejo Visual Obligatorio de Foto de Perfil */}
            {lastResult.usuario && (
              <div className="p-3 bg-light rounded border d-flex flex-column flex-md-row align-items-center gap-4">
                {lastResult.usuario.foto_url ? (
                  <img
                    src={lastResult.usuario.foto_url}
                    alt="Foto oficial"
                    className="rounded shadow"
                    style={{
                      width: '140px',
                      height: '140px',
                      objectFit: 'cover',
                      border: '4px solid #005691',
                    }}
                  />
                ) : (
                  <div
                    className="rounded bg-white d-flex align-items-center justify-content-center shadow-sm"
                    style={{ width: '140px', height: '140px', border: '3px solid #cbd5e1' }}
                  >
                    <i className="bx bx-user fs-1 text-secondary"></i>
                  </div>
                )}

                <div className="flex-grow-1 text-center text-md-start">
                  <div className="badge bg-primary mb-1">
                    {lastResult.usuario.rol || lastResult.usuario.rol_nombre || 'Participante'}
                  </div>
                  <h3 className="h4 fw-bold text-dark mb-1">
                    {lastResult.usuario.nombre} {lastResult.usuario.apellido}
                  </h3>
                  <p className="mb-1 text-muted">
                    DNI / Pasaporte: <strong>{lastResult.usuario.dni_pasaporte}</strong>
                  </p>
                  <div className="alert alert-warning py-1 px-2 small mb-0 mt-2 d-inline-block">
                    <i className="bx bx-show me-1"></i>
                    <strong>Cotejo Visual Obligatorio:</strong> Verificá que la persona frente a vos
                    coincida con esta foto y su DNI físico.
                  </div>
                </div>
              </div>
            )}

            {lastResult.status === 'DUPLICATED' && (
              <div className="alert alert-danger mt-3 mb-0">
                <strong>Detalles del conflicto:</strong> Esta credencial ya fue escaneada
                anteriormente a las <strong>{lastResult.hora_previa}</strong> en el punto{' '}
                <strong>{lastResult.punto_previo}</strong>. Si el portador sostiene ser el titular
                legítimo, derivarlo a la Mesa de Contingencia.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TICKER DE ACREDITACIONES EN VIVO */}
      <div className="card shadow-sm border-0 mb-4">
        <div className="card-header bg-white py-3 border-bottom d-flex flex-wrap align-items-center justify-content-between gap-2">
          <div className="d-flex align-items-center gap-2">
            <h2 className="h6 fw-bold text-dark mb-0">
              <i className="bx bx-history text-primary me-2"></i>Ticker de Acreditaciones en Vivo
            </h2>
            <span className="badge bg-success-subtle text-success border border-success d-inline-flex align-items-center gap-1">
              <span
                className="bg-success rounded-circle d-inline-block"
                style={{ width: '6px', height: '6px' }}
              ></span>
              En directo
            </span>
          </div>

          <button
            type="button"
            className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
            onClick={fetchRecentAcreditaciones}
            title="Actualizar registro reciente"
          >
            <i className="bx bx-refresh"></i> Actualizar
          </button>
        </div>

        <div className="card-body p-0">
          {recentAcreditaciones.length === 0 ? (
            <div className="p-4 text-center text-muted">
              <i className="bx bx-scan fs-2 text-secondary mb-2"></i>
              <p className="small mb-0">No se registran acreditaciones recientes en el sistema.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table
                className="table table-hover align-middle mb-0"
                style={{ fontSize: '0.85rem' }}
              >
                <thead className="table-light text-secondary">
                  <tr>
                    <th>Hora</th>
                    <th>Asistente</th>
                    <th>Rol</th>
                    <th>Punto & Tipo</th>
                    <th>Operador</th>
                  </tr>
                </thead>
                <tbody>
                  {recentAcreditaciones.map((item) => (
                    <tr key={item.id}>
                      <td className="text-nowrap fw-bold text-dark">
                        <i className="bx bx-time-five text-muted me-1"></i>
                        {item.timestamp_acreditacion
                          ? new Date(item.timestamp_acreditacion).toLocaleTimeString('es-AR', {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })
                          : 'Reciente'}
                      </td>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          {item.foto_url ? (
                            <img
                              src={item.foto_url}
                              alt={item.nombre}
                              className="rounded-circle border"
                              style={{ width: '32px', height: '32px', objectFit: 'cover' }}
                            />
                          ) : (
                            <div
                              className="rounded-circle bg-light border d-flex align-items-center justify-content-center text-secondary"
                              style={{ width: '32px', height: '32px', fontSize: '1rem' }}
                            >
                              <i className="bx bx-user"></i>
                            </div>
                          )}
                          <div>
                            <div className="fw-bold text-dark">
                              {item.nombre} {item.apellido}
                            </div>
                            <small className="text-muted">DNI {item.dni_pasaporte}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="badge bg-primary-subtle text-primary border border-primary-subtle">
                          {item.rol_nombre || 'Participante'}
                        </span>
                      </td>
                      <td>
                        <div className="fw-semibold text-dark">{item.punto_acceso_nombre}</div>
                        <small className="text-muted">{item.tipo_acreditacion_nombre}</small>
                      </td>
                      <td>
                        <div className="text-dark">
                          <i className="bx bx-user-check text-muted me-1"></i>
                          {item.operador_nombre}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal Acreditación Rápida Mostrador (Walk-in) */}
      {showWalkInModal && (
        <div
          className="modal fade show d-block"
          tabIndex={-1}
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0">
              <div className="modal-header bg-warning-subtle text-dark border-bottom">
                <h5 className="modal-title fw-bold fs-6 d-flex align-items-center gap-2">
                  <i className="bx bx-user-plus text-warning fs-5"></i>
                  Alta Rápida de Mostrador (Walk-in)
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Cerrar"
                  onClick={() => {
                    setShowWalkInModal(false);
                    if (onWalkInModalClosed) onWalkInModalClosed();
                  }}
                ></button>
              </div>

              <form onSubmit={handleWalkInSubmit}>
                <div className="modal-body p-4">
                  <div className="alert alert-info py-2 small mb-3">
                    <i className="bx bx-info-circle me-1"></i>
                    Permite registrar y acreditar de inmediato a un asistente espontáneo sin
                    inscripción web previa, consumiendo cupo en el recinto actual.
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-bold text-secondary">
                      DNI / Pasaporte *
                    </label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      required
                      placeholder="Ej: 38123456"
                      value={walkInData.dni_pasaporte}
                      onChange={(e) =>
                        setWalkInData({ ...walkInData, dni_pasaporte: e.target.value.trim() })
                      }
                    />
                  </div>

                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label small fw-bold text-secondary">Nombre *</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        required
                        placeholder="Ej: Martín"
                        value={walkInData.nombre}
                        onChange={(e) => setWalkInData({ ...walkInData, nombre: e.target.value })}
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-bold text-secondary">Apellido *</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        required
                        placeholder="Ej: Gómez"
                        value={walkInData.apellido}
                        onChange={(e) => setWalkInData({ ...walkInData, apellido: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-bold text-secondary">
                      Correo Electrónico *
                    </label>
                    <input
                      type="email"
                      className="form-control form-control-sm"
                      required
                      placeholder="asistente@ejemplo.com"
                      value={walkInData.email}
                      onChange={(e) =>
                        setWalkInData({ ...walkInData, email: e.target.value.trim() })
                      }
                    />
                  </div>

                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label small fw-bold text-secondary">
                        Rol Institucional
                      </label>
                      <select
                        className="form-select form-select-sm"
                        value={walkInData.rol_principal_id}
                        onChange={(e) =>
                          setWalkInData({
                            ...walkInData,
                            rol_principal_id: Number(e.target.value),
                          })
                        }
                      >
                        <option value={1}>Estudiante / General</option>
                        <option value={2}>Docente</option>
                        <option value={3}>Expositor</option>
                        <option value={4}>Autoridad</option>
                      </select>
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-bold text-secondary">
                        Punto de Ingreso
                      </label>
                      <select
                        className="form-select form-select-sm"
                        value={walkInData.punto_acceso_id || puntoAccesoId}
                        onChange={(e) =>
                          setWalkInData({
                            ...walkInData,
                            punto_acceso_id: Number(e.target.value),
                          })
                        }
                      >
                        {puntosAcceso.length > 0 ? (
                          puntosAcceso.map((pa) => (
                            <option key={pa.id} value={pa.id}>
                              {pa.nombre}
                            </option>
                          ))
                        ) : (
                          <option value={puntoAccesoId}>Punto Actual</option>
                        )}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="modal-footer bg-light py-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    disabled={walkInLoading}
                    onClick={() => {
                      setShowWalkInModal(false);
                      if (onWalkInModalClosed) onWalkInModalClosed();
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn btn-sm btn-primary fw-bold d-flex align-items-center gap-1"
                    disabled={walkInLoading}
                  >
                    {walkInLoading ? (
                      <span className="spinner-border spinner-border-sm"></span>
                    ) : (
                      <>
                        <i className="bx bx-check-double"></i> Dar de Alta y Acreditar In Situ
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Monitoreo y Gestión de Sincronización Offline (IndexedDB) */}
      <OfflineSyncManagerModal
        isOpen={showSyncModal}
        onClose={() => setShowSyncModal(false)}
      />
    </div>
  );
};
