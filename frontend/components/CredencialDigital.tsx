'use client';

import React, { useState, useEffect } from 'react';

interface CredencialProps {
  usuario: {
    nombre: string;
    apellido: string;
    dni_pasaporte: string;
    rol?: string;
    rol_nombre?: string;
    roles_adicionales?: string[];
    foto_url?: string | null;
    homologacion_estado?: string | null;
  };
  qr_token: string;
}

export const CredencialDigital: React.FC<CredencialProps> = ({ usuario, qr_token }) => {
  const [currentTime, setCurrentTime] = useState<string>('');

  const esExpositor =
    (usuario.rol && usuario.rol.toLowerCase().includes('expositor')) ||
    (usuario.rol_nombre && usuario.rol_nombre.toLowerCase().includes('expositor')) ||
    (usuario.roles_adicionales &&
      usuario.roles_adicionales.some((r) => r.toLowerCase().includes('expositor')));

  const rolPrincipal = (usuario.rol || usuario.rol_nombre || 'Participante').toLowerCase();
  let colorRol = '#334155';
  if (rolPrincipal.includes('autoridad')) {
    colorRol = '#b45309'; // Oro / Ámbar
  } else if (rolPrincipal.includes('docente')) {
    colorRol = '#005691'; // Azul DETS
  } else if (rolPrincipal.includes('expositor')) {
    colorRol = '#b91c1c'; // Rojo Carmesí
  } else if (rolPrincipal.includes('estudiante')) {
    colorRol = '#15803d'; // Verde Esmeralda
  }

  const homologado = usuario.homologacion_estado === 'VALIDADO';

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('es-AR', { hour12: false }) +
          '.' +
          String(now.getMilliseconds()).padStart(3, '0').slice(0, 2)
      );
    };
    update();
    const interval = setInterval(update, 100);
    return () => clearInterval(interval);
  }, []);

  // Generación de código QR 100% local y offline con fallback
  const [localQrUrl, setLocalQrUrl] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    import('qrcode').then((QRCode) => {
      QRCode.toDataURL(qr_token, {
        margin: 1,
        width: 220,
        color: { dark: '#002B49', light: '#FFFFFF' },
      })
        .then((url) => {
          if (isMounted) setLocalQrUrl(url);
        })
        .catch(() => {});
    });
    return () => {
      isMounted = false;
    };
  }, [qr_token]);

  const qrImageUrl =
    localQrUrl ||
    `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
      qr_token
    )}`;

  return (
    <div className="credential-print-wrapper w-100">
      {/* Encabezado Oficial Institucional (Solo visible al imprimir en A4) */}
      <div className="d-none d-print-block text-center mb-2 print-header" style={{ width: '100%' }}>
        <div style={{ fontSize: '10pt', fontWeight: 800, color: '#002B49', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Gobierno de la Ciudad Autónoma de Buenos Aires · Ministerio de Educación
        </div>
        <div style={{ fontSize: '9pt', color: '#005691', fontWeight: 700 }}>
          Dirección de Educación Técnica Superior (DETS) · 1er Congreso ETS 2026
        </div>
        <div style={{ fontSize: '7.5pt', color: '#64748b', marginTop: '1px' }}>
          Auditorio Polo Saavedra · 15, 16 y 17 de Octubre de 2026 · Ciudad de Buenos Aires
        </div>
        <div style={{ borderBottom: '2px solid #005691', width: '70%', margin: '6px auto 6px auto' }}></div>
        <div style={{ fontSize: '7.5pt', color: '#64748b' }}>
          ✂️ <em>Doblar o recortar por la línea punteada para portacredencial estándar (10 × 15 cm)</em>
        </div>
      </div>

      <div
        className="credential-card p-3 mx-auto text-center position-relative shadow"
        style={{ maxWidth: '380px', borderRadius: '16px', borderTop: `8px solid ${colorRol}`, backgroundColor: '#ffffff' }}
      >
        {/* Perforación para cinta colgante Lanyard */}
        <div className="d-flex justify-content-center mb-2">
          <div
            className="rounded-pill bg-dark border border-2 border-white shadow-sm"
            style={{ width: '45px', height: '9px', opacity: 0.85 }}
            title="Ranura para gancho de cinta colgante (Lanyard)"
          ></div>
        </div>

        {/* Cabecera de la credencial */}
        <div className="d-flex align-items-center justify-content-between mb-2 border-bottom pb-2">
          <span className="badge" style={{ backgroundColor: colorRol, color: '#ffffff' }}>
            ETS 2026
          </span>
          <span
            className="small text-muted fw-bold text-uppercase"
            style={{ fontSize: '0.72rem', letterSpacing: '0.5px' }}
          >
            {usuario.rol || usuario.rol_nombre || 'Credencial Oficial'}
          </span>
        </div>

        {/* Marca de agua viva con segundero en tiempo real (Anti-captura digital en pantalla) */}
        <div className="mb-2 no-print">
          <div className="live-watermark text-primary">
            <i className="bx bx-time-five bx-spin"></i>
            <span>EN VIVO: {currentTime}</span>
          </div>
        </div>

        {/* Foto del Participante */}
        <div className="mb-2">
          {usuario.foto_url ? (
            <img
              src={usuario.foto_url}
              alt="Foto oficial"
              className="rounded-circle shadow"
              style={{
                width: '100px',
                height: '100px',
                objectFit: 'cover',
                border: '3px solid #005691',
              }}
            />
          ) : (
            <div
              className="rounded-circle bg-light d-inline-flex align-items-center justify-content-center shadow-sm"
              style={{ width: '100px', height: '100px', border: '3px solid #cbd5e1' }}
            >
              <i className="bx bx-user fs-1 text-secondary"></i>
            </div>
          )}
        </div>

        {/* Datos del Participante */}
        <h2 className="h5 fw-bold text-dark mb-0">
          {usuario.nombre} {usuario.apellido}
        </h2>
        <div className="d-flex flex-wrap justify-content-center gap-1 my-1">
          <span className="badge bg-warning text-dark fw-bold">
            {usuario.rol || usuario.rol_nombre || 'Participante'}
          </span>
          {usuario.roles_adicionales &&
            usuario.roles_adicionales.map((rolAdic, idx) => (
              <span key={idx} className="badge bg-secondary text-white">
                + {rolAdic}
              </span>
            ))}
        </div>
        <p className="small text-muted mb-2">
          DNI / Pasaporte: <strong>{usuario.dni_pasaporte}</strong>
        </p>

        {/* Estado de Homologación para Expositores */}
        {esExpositor && (
          <div className="mb-2">
            {homologado ? (
              <span className="badge bg-success text-white py-1 px-2 d-inline-flex align-items-center gap-1">
                <i className="bx bx-check-double"></i> Pergaminos Homologados
              </span>
            ) : (
              <div
                className="alert alert-warning py-1 px-2 small text-start border-warning shadow-sm mb-1"
                style={{ fontSize: '0.75rem' }}
              >
                <div className="fw-bold d-flex align-items-center gap-1 text-dark">
                  <i className="bx bx-error-circle text-warning fs-6"></i>
                  <span>HOMOLOGACIÓN PENDIENTE</span>
                </div>
                <p className="mb-0 text-dark" style={{ fontSize: '0.72rem' }}>
                  Exhibí tus títulos o certificados probatorios en la Mesa de Homologación antes de ingresar.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Código QR Cifrado */}
        <div className="p-2 bg-white rounded shadow-sm border d-inline-block mb-2">
          <img
            src={qrImageUrl}
            alt="Código QR Criptográfico"
            style={{ width: '165px', height: '165px', display: 'block' }}
          />
        </div>

        <div className="text-muted small mb-2 d-none d-print-block" style={{ fontSize: '7pt' }}>
          Código QR criptográfico personal e intransferible · Control de aforo en puerta
        </div>

        <div
          className="alert alert-info py-2 px-3 small mb-3 text-start no-print"
          style={{ fontSize: '0.8rem' }}
        >
          <i className="bx bx-info-circle me-1"></i>
          <strong>Control en Puerta:</strong> Exhibí esta pantalla activa junto a tu DNI físico en el
          ingreso al Auditorio Polo Saavedra.
        </div>

        <button
          type="button"
          className="btn btn-sm btn-outline-primary w-100 no-print fw-bold d-flex align-items-center justify-content-center gap-1 shadow-sm cursor-pointer"
          onClick={() => window.print()}
        >
          <i className="bx bx-printer fs-6"></i> Imprimir Credencial / Guardar PDF
        </button>
      </div>

      {/* Pie Institucional e Instrucciones de Acreditación (Solo visible al imprimir en A4) */}
      <div className="d-none d-print-block text-center mt-2 print-footer" style={{ maxWidth: '420px', margin: '0 auto' }}>
        <div style={{ borderTop: '1px solid #cbd5e1', width: '75%', margin: '0 auto 6px auto' }}></div>
        <div style={{ fontSize: '7.5pt', color: '#475569', lineHeight: '1.4' }}>
          <strong>Instrucciones para el Asistente:</strong><br />
          1. Presentá esta credencial física o en tu teléfono junto con tu DNI físico en los molinetes de ingreso.<br />
          2. El código QR es personal e intransferible y registra tus ingresos y egresos al auditorio.<br />
          3. Las asistencias registradas habilitan automáticamente tu constancia de asistencia oficial.
        </div>
        <div style={{ fontSize: '6.5pt', color: '#94a3b8', marginTop: '4px', fontFamily: 'monospace' }}>
          Credencial Oficial ETS 2026 · DETS GCABA · Firma Criptográfica Verificada
        </div>
      </div>
    </div>
  );
};

