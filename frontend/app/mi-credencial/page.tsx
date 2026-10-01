'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Swal from 'sweetalert2';
import { CredencialDigital } from '@/components/CredencialDigital';
import PushNotificationToggle from '@/components/PushNotificationToggle';
import EncuestaSatisfaccionModal from '@/components/EncuestaSatisfaccionModal';

function MiCredencialContent() {
  const searchParams = useSearchParams();
  const urlDni = searchParams.get('dni') || '';

  const [dni, setDni] = useState<string>(urlDni);
  const [usuario, setUsuario] = useState<any>(null);
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [offlineCached, setOfflineCached] = useState<boolean>(false);
  const [descargandoDiploma, setDescargandoDiploma] = useState<boolean>(false);
  const [encuestaPendiente, setEncuestaPendiente] = useState<boolean>(false);
  const [isSurveyModalOpen, setIsSurveyModalOpen] = useState<boolean>(false);

  const handleBuscar = async (dniInput?: string) => {
    const targetDni = (dniInput || dni).trim();
    if (!targetDni) return;

    const regexDni = /^[A-Za-z0-9_-]{5,25}$/;
    if (!regexDni.test(targetDni)) {
      setError('El DNI o Pasaporte debe tener entre 5 y 25 caracteres alfanuméricos.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Consultar endpoint oficial de credencial (genera token QR criptográfico AES-256-CBC)
      const res = await fetch(`/api/credencial?dni=${encodeURIComponent(targetDni)}`);
      const data = await res.json();

      if (res.ok && data.success) {
        const u = data.usuario;
        const token = data.qr_token;

        setUsuario(u);
        setQrToken(token);
        setOfflineCached(false);

        // Consultar estado de encuesta y certificado
        try {
          const certRes = await fetch(`/api/certificados?dni=${encodeURIComponent(targetDni)}`);
          if (certRes.ok) {
            const certData = await certRes.json();
            if (certData.encuesta_pendiente) {
              setEncuestaPendiente(true);
            } else {
              setEncuestaPendiente(false);
            }
            if (certData.certificado?.codigo_verificacion) {
              u.certificado_codigo = certData.certificado.codigo_verificacion;
            }
          }
        } catch (_) {}

        // Guardar en almacenamiento local para acceso offline
        localStorage.setItem(
          'ets2026_credencial_cache',
          JSON.stringify({
            usuario: u,
            qr_token: token,
            guardado_en: new Date().toISOString(),
          })
        );

        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'success',
          title: 'Credencial activa lista para acceso offline',
          showConfirmButton: false,
          timer: 3000,
          timerProgressBar: true,
        });
      } else if (res.status === 403) {
        setError(data.message || 'La credencial solo se emite para vacantes confirmadas.');
        Swal.fire({
          icon: 'info',
          title: 'Inscripción No Confirmada',
          text:
            data.message ||
            'La credencial digital se genera exclusivamente para vacantes confirmadas.',
          confirmButtonColor: '#005691',
        });
      } else if (res.status === 404) {
        setError('No se encontró ninguna inscripción con este DNI.');
        Swal.fire({
          icon: 'warning',
          title: 'No Registrado',
          text: 'No se encontró ninguna inscripción con este DNI o Pasaporte.',
          confirmButtonColor: '#005691',
        });
      } else {
        setError(data.message || 'Error al obtener la credencial.');
      }
    } catch (err: any) {
      // Si falla la red pero hay credencial en caché local para este DNI
      const cached = localStorage.getItem('ets2026_credencial_cache');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (!targetDni || parsed.usuario?.dni_pasaporte === targetDni) {
            setUsuario(parsed.usuario);
            setQrToken(parsed.qr_token);
            setOfflineCached(true);
            return;
          }
        } catch (_) {}
      }
      setError('Sin conexión a internet y no hay credencial guardada previamente para este DNI.');
    } finally {
      setLoading(false);
    }
  };

  // Cargar automáticamente si viene DNI en la URL o restaurar caché local
  useEffect(() => {
    if (urlDni) {
      setDni(urlDni);
      handleBuscar(urlDni);
    } else {
      const cached = localStorage.getItem('ets2026_credencial_cache');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          setUsuario(parsed.usuario);
          setQrToken(parsed.qr_token);
          setOfflineCached(true);
        } catch (_) {}
      }
    }
  }, [urlDni]);

  const handleCerrarSesion = () => {
    localStorage.removeItem('ets2026_credencial_cache');
    setUsuario(null);
    setQrToken(null);
    setOfflineCached(false);
    setDni('');
  };

  const handleDescargarDiploma = async () => {
    if (!usuario) return;
    setDescargandoDiploma(true);
    try {
      // 1. Consultar estado en API de certificados
      const res = await fetch(
        `/api/certificados?dni=${encodeURIComponent(usuario.dni_pasaporte)}`
      );
      const data = await res.json();

      if (!res.ok) {
        Swal.fire({
          icon: 'info',
          title: 'Acreditación en Puerta Requerida',
          text:
            data.message ||
            'El diploma oficial estará disponible una vez que registres tu ingreso presencial en la sede.',
          confirmButtonColor: '#005691',
        });
        return;
      }

      if (data.encuesta_pendiente) {
        setEncuestaPendiente(true);
        setIsSurveyModalOpen(true);
        Swal.fire({
          icon: 'info',
          title: 'Encuesta Obligatoria Requerida',
          text: 'Para descargar tu diploma oficial, por favor completa una breve encuesta de calidad de 4 preguntas.',
          confirmButtonColor: '#005691',
        });
        return;
      }

      const codigo = data.certificado?.codigo_verificacion || usuario.certificado_codigo;
      if (!codigo) {
        Swal.fire({
          icon: 'warning',
          title: 'Certificado no disponible',
          text: 'No se encontró el código de certificación para tu usuario.',
          confirmButtonColor: '#005691',
        });
        return;
      }

      // 2. Disparar descarga binaria directa del diploma PDF
      const downloadUrl = `/api/certificados/download/${encodeURIComponent(codigo)}`;
      const downloadRes = await fetch(downloadUrl);

      if (downloadRes.status === 403) {
        const errJson = await downloadRes.json().catch(() => ({}));
        if (errJson.error === 'ERR_SURVEY_REQUIRED') {
          setEncuestaPendiente(true);
          setIsSurveyModalOpen(true);
          return;
        }
      }

      if (!downloadRes.ok) {
        throw new Error('Error al generar el diploma PDF.');
      }

      const blob = await downloadRes.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `Certificado_ETS2026_${codigo}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);

      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Diploma Oficial PDF descargado con éxito',
        showConfirmButton: false,
        timer: 3500,
        timerProgressBar: true,
      });
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Error de Descarga',
        text: err.message || 'No se pudo generar el documento PDF.',
        confirmButtonColor: '#005691',
      });
    } finally {
      setDescargandoDiploma(false);
    }
  };

  const handleCancelarAsistencia = async () => {
    if (!usuario) return;

    const result = await Swal.fire({
      title: '¿Deseas cancelar tu vacante?',
      text: 'Tu lugar confirmado será liberado de inmediato y reasignado al próximo participante en lista de espera por orden de llegada (FIFO).',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#005691',
      confirmButtonText: 'Sí, liberar mi vacante',
      cancelButtonText: 'Mantener mi lugar',
    });

    if (!result.isConfirmed) return;

    try {
      const res = await fetch('/api/usuario/cancelar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dni_pasaporte: usuario.dni_pasaporte,
          motivo: 'Cancelación voluntaria solicitada desde la credencial digital PWA',
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        localStorage.removeItem('ets2026_credencial_cache');
        setUsuario(null);
        setQrToken(null);
        setOfflineCached(false);
        setDni('');

        Swal.fire({
          icon: 'success',
          title: 'Vacante Liberada',
          text: 'Tu asistencia ha sido cancelada correctamente. Podrás volver a inscribirte en cualquier momento si lo deseas.',
          confirmButtonColor: '#005691',
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: data.message || 'No fue posible procesar la cancelación.',
        });
      }
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Error de red',
        text: err.message || 'Error al comunicarse con el servidor.',
      });
    }
  };

  const handleVolver = () => {
    if (typeof window !== 'undefined') {
      if (window.opener && !window.opener.closed) {
        window.close();
      } else if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = '/admin';
      }
    }
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      {/* Barra superior de la PWA de Usuario */}
      <nav className="header-institutional text-white py-2 px-3 shadow-sm d-flex align-items-center justify-content-between flex-wrap gap-2 no-print">
        <div className="d-flex align-items-center gap-2">
          <i className="bx bxs-id-card fs-4 text-warning"></i>
          <div>
            <span className="fw-bold d-block" style={{ fontSize: '0.85rem' }}>
              Mi Credencial PWA
            </span>
            <small className="text-white-50" style={{ fontSize: '0.7rem' }}>
              ETS 2026 • Auditorio Polo Saavedra
            </small>
          </div>
        </div>

        <div className="d-flex align-items-center gap-1.5">
          <button
            type="button"
            onClick={handleVolver}
            className="btn btn-outline-light d-flex align-items-center gap-1 font-semibold"
            style={{ fontSize: '0.75rem', padding: '0.22rem 0.5rem', borderRadius: '6px' }}
            title="Volver a la pantalla anterior"
          >
            <i className="bx bx-arrow-back" style={{ fontSize: '0.85rem' }}></i> Volver
          </button>
          <Link
            href="/admin"
            className="btn btn-warning text-dark fw-bold d-flex align-items-center gap-1"
            style={{ fontSize: '0.75rem', padding: '0.22rem 0.5rem', borderRadius: '6px' }}
            title="Ir al Panel de Administración"
          >
            <i className="bx bx-shield-quarter" style={{ fontSize: '0.85rem' }}></i> Panel Admin
          </Link>
          <Link
            href="/"
            className="btn btn-outline-light d-flex align-items-center gap-1"
            style={{ fontSize: '0.75rem', padding: '0.22rem 0.5rem', borderRadius: '6px' }}
            title="Ir a la portada pública del Congreso"
          >
            <i className="bx bx-home-alt" style={{ fontSize: '0.85rem' }}></i> Inicio
          </Link>
        </div>
      </nav>

      {/* Contenido */}
      <main className="container py-4 flex-grow-1 d-flex flex-column justify-content-center align-items-center">
        {!usuario ? (
          <div
            className="card shadow-sm border-0 rounded-4 p-4 text-center w-100"
            style={{ maxWidth: '420px' }}
          >
            <div className="mb-3">
              <i className="bx bx-qr-scan fs-1 text-primary"></i>
            </div>
            <h1 className="h5 fw-bold text-dark mb-1">Acceso a tu Credencial Digital</h1>
            <p className="small text-muted mb-4">
              Ingresá tu DNI para descargar tu credencial oficial en tu celular. Quedará guardada
              para su uso sin conexión.
            </p>

            {error && <div className="alert alert-warning small py-2 px-3 mb-3">{error}</div>}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleBuscar();
              }}
            >
              <div className="mb-3">
                <input
                  type="text"
                  className="form-control form-control-lg text-center fw-bold"
                  placeholder="Número de DNI..."
                  required
                  minLength={5}
                  maxLength={25}
                  value={dni}
                  onChange={(e) => setDni(e.target.value)}
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary btn-lg w-100 fw-bold shadow-sm"
                disabled={loading}
              >
                {loading ? (
                  <span className="spinner-border spinner-border-sm"></span>
                ) : (
                  'Obtener Credencial'
                )}
              </button>
            </form>
          </div>
        ) : (
          <div className="w-100 text-center" style={{ maxWidth: '400px' }}>
            {offlineCached && (
              <div className="alert alert-warning py-1 px-3 small mb-2 d-inline-block shadow-sm no-print">
                <i className="bx bx-wifi-off me-1"></i> Modo Fuera de Línea (Credencial guardada en
                tu dispositivo)
              </div>
            )}

            <CredencialDigital
              usuario={{
                nombre: usuario.nombre,
                apellido: usuario.apellido,
                dni_pasaporte: usuario.dni_pasaporte,
                rol: usuario.rol_nombre || usuario.rol,
                rol_nombre: usuario.rol_nombre || usuario.rol,
                roles_adicionales: usuario.roles_adicionales || [],
                foto_url: usuario.foto_url,
                homologacion_estado: usuario.homologacion_estado,
              }}
              qr_token={qrToken || `token_${usuario.id}`}
            />

            {/* Tarjeta de Diploma Oficial para Asistentes con Acreditación Presencial */}
            {usuario.acreditado && (
              <div className="card shadow-sm border-0 rounded-3 mt-3 p-3 bg-success-subtle text-success-emphasis text-start no-print">
                <div className="d-flex align-items-center gap-2 mb-2">
                  <i className="bx bx-check-shield fs-4 text-success"></i>
                  <strong className="small text-dark">¡Ingreso Presencial Acreditado!</strong>
                </div>

                {encuestaPendiente ? (
                  <div className="alert alert-warning border-warning d-flex flex-column gap-2 mb-3 py-2 px-3">
                    <div className="d-flex align-items-center gap-2">
                      <i className="bx bx-error-circle fs-5 text-warning-emphasis"></i>
                      <strong className="small">Encuesta Obligatoria Requerida</strong>
                    </div>
                    <p className="small mb-2 text-dark" style={{ fontSize: '0.82rem' }}>
                      Para desbloquear la descarga de tu diploma oficial con resolución ministerial,
                      por favor completá una breve encuesta de evaluación del congreso (toma menos de 1 minuto).
                    </p>
                    <button
                      type="button"
                      className="btn btn-sm btn-warning fw-bold d-flex align-items-center justify-content-center gap-1 shadow-sm"
                      onClick={() => setIsSurveyModalOpen(true)}
                    >
                      <i className="bx bx-edit-alt"></i>
                      <span>Completar Encuesta de Calidad</span>
                    </button>
                  </div>
                ) : (
                  <p className="small text-muted mb-3" style={{ fontSize: '0.82rem' }}>
                    Completaste tu ingreso en la sede del congreso. Ya podés descargar tu diploma
                    oficial con firmas institucionales y código QR verificable.
                  </p>
                )}

                <div className="d-flex flex-column gap-2">
                  <button
                    type="button"
                    className="btn btn-success fw-bold d-flex align-items-center justify-content-center gap-2 shadow-sm"
                    onClick={handleDescargarDiploma}
                    disabled={descargandoDiploma}
                  >
                    {descargandoDiploma ? (
                      <span className="spinner-border spinner-border-sm"></span>
                    ) : (
                      <>
                        <i className="bx bxs-file-pdf fs-5"></i>
                        <span>Descargar Diploma Oficial (PDF)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Modal de Encuesta de Satisfacción */}
            <EncuestaSatisfaccionModal
              isOpen={isSurveyModalOpen}
              onClose={() => setIsSurveyModalOpen(false)}
              usuarioId={usuario.id}
              onCompleted={() => {
                setEncuestaPendiente(false);
                handleDescargarDiploma();
              }}
            />

            <div className="mt-3 no-print text-start">
              <PushNotificationToggle usuarioId={usuario.id} />
            </div>

            <div className="d-flex flex-wrap justify-content-center gap-2 mt-3 no-print">
              <button
                type="button"
                className="btn btn-sm btn-primary fw-semibold"
                onClick={handleVolver}
                title="Volver a la pantalla anterior del sistema"
              >
                <i className="bx bx-arrow-back me-1"></i> Volver al Panel
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => handleBuscar(usuario.dni_pasaporte)}
              >
                <i className="bx bx-refresh me-1"></i> Actualizar
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={handleCerrarSesion}
              >
                <i className="bx bx-log-out me-1"></i> Cambiar DNI
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-danger"
                onClick={handleCancelarAsistencia}
              >
                <i className="bx bx-user-x me-1"></i> Cancelar Asistencia
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="py-2 text-center text-muted small bg-white border-top no-print">
        DETS • Presentá esta credencial activa en la puerta del congreso
      </footer>
    </div>
  );
}

export default function MiCredencialPWA() {
  return (
    <Suspense
      fallback={
        <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Cargando credencial...</span>
          </div>
        </div>
      }
    >
      <MiCredencialContent />
    </Suspense>
  );
}
