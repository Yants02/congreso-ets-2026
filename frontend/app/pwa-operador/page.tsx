'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { QRScannerView } from '@/components/QRScannerView';

export default function PwaOperadorPage() {
  const router = useRouter();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState<boolean>(false);
  const [showManualModal, setShowManualModal] = useState<boolean>(false);
  const [triggerWalkIn, setTriggerWalkIn] = useState<boolean>(false);
  const [focusDniCounter, setFocusDniCounter] = useState<number>(0);

  const handleSelectWalkIn = () => {
    setShowManualModal(false);
    setTriggerWalkIn(true);
  };

  const handleSelectSearchDni = () => {
    setShowManualModal(false);
    setFocusDniCounter((prev) => prev + 1);
  };

  const handleSelectManualDoc = () => {
    setShowManualModal(false);
    window.open('/manuales/manual_usuario.html', '_blank', 'noopener,noreferrer');
  };

  // Acciones disponibles en el selector desplegable móvil
  const mobileNavOptions = [
    {
      id: 'scan',
      label: 'Control de Accesos (QR / DNI)',
      icon: 'bx-qr-scan',
      color: 'text-primary',
      action: () => {
        setIsMobileNavOpen(false);
        setFocusDniCounter((prev) => prev + 1);
      },
    },
    {
      id: 'manual',
      label: 'Opciones de Operación Manual...',
      icon: 'bx-slider',
      color: 'text-warning',
      action: () => {
        setIsMobileNavOpen(false);
        setShowManualModal(true);
      },
    },
    {
      id: 'walkin',
      label: 'Alta Rápida (Walk-in)',
      icon: 'bx-user-plus',
      color: 'text-warning',
      action: () => {
        setIsMobileNavOpen(false);
        setTriggerWalkIn(true);
      },
    },
    {
      id: 'doc',
      label: 'Manual de Usuario (Documentación)',
      icon: 'bx-book-open',
      color: 'text-info',
      action: () => {
        setIsMobileNavOpen(false);
        window.open('/manuales/manual_usuario.html', '_blank', 'noopener,noreferrer');
      },
    },
    {
      id: 'admin',
      label: 'Ir al Panel Administrativo',
      icon: 'bx-shield-quarter',
      color: 'text-secondary',
      action: () => {
        setIsMobileNavOpen(false);
        router.push('/admin');
      },
    },
  ];

  return (
    <div className="min-vh-100 bg-light d-flex flex-column font-sans">
      {/* Cabecera PWA Operativa */}
      <header className="header-institutional text-white py-2 px-3 shadow-sm d-flex align-items-center justify-content-between sticky-top">
        <div className="d-flex align-items-center gap-2">
          <i className="bx bx-qr-scan fs-4 text-warning"></i>
          <div>
            <h1 className="h6 mb-0 fw-bold text-white">PWA Control de Accesos</h1>
            <small className="text-white-50" style={{ fontSize: '0.7rem' }}>
              Operador en Sede • Polo Saavedra
            </small>
          </div>
        </div>

        {/* VISTA ESCRITORIO (>= sm): BOTONES INDIVIDUALES */}
        <div className="hidden sm:flex align-items-center gap-2">
          <button
            type="button"
            onClick={() => setShowManualModal(true)}
            className="btn btn-sm btn-warning text-dark fw-bold d-flex align-items-center gap-1 shadow-sm"
            title="Abrir opciones de operación manual y documentación"
          >
            <i className="bx bx-cog"></i> Manual
          </button>
          <Link
            href="/admin"
            className="btn btn-sm btn-outline-light d-flex align-items-center gap-1"
          >
            <i className="bx bx-shield-quarter"></i> Admin
          </Link>
        </div>

        {/* VISTA MÓVIL (< sm): BOTÓN SELECTOR COMPACTO DE 28PX DE ALTURA */}
        <div className="sm:hidden relative">
          <button
            type="button"
            id="pwa-module-selector-mobile-trigger"
            onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
            className="h-7 px-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-800 text-[11px] font-semibold rounded-lg flex items-center justify-between gap-1.5 shadow-2xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            aria-label="Abrir selector de navegación de la PWA"
            aria-expanded={isMobileNavOpen}
          >
            <span className="flex items-center gap-1.5 truncate">
              <i className="bx bx-menu-alt-right fs-6 text-primary"></i>
              <span>Acciones</span>
            </span>
            <span className="text-slate-400 text-xs ml-0.5 flex-shrink-0">
              {isMobileNavOpen ? '▲' : '▼'}
            </span>
          </button>

          {/* Menú desplegable flotante con backdrop para móviles */}
          {isMobileNavOpen && (
            <>
              <div
                className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs"
                onClick={() => setIsMobileNavOpen(false)}
              />
              <div
                className="absolute right-0 top-9 z-50 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden p-1 min-w-[240px] max-w-[90vw] animate-in fade-in duration-150"
                style={{ color: '#1e293b' }}
              >
                <div className="px-2.5 py-1 text-[9px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 mb-1">
                  Navegación & Operación
                </div>
                {mobileNavOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={opt.action}
                    className="w-full h-[32px] flex items-center gap-2 px-2 rounded-lg text-[11px] font-medium transition cursor-pointer text-left text-gray-700 hover:bg-slate-100 hover:text-blue-700"
                  >
                    <i className={`bx ${opt.icon} fs-5 ${opt.color} flex-shrink-0`}></i>
                    <span className="truncate flex-1">{opt.label}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </header>

      {/* Contenido Principal de Escaneo */}
      <main className="container-fluid p-2 p-md-3 flex-grow-1" style={{ maxWidth: '800px' }}>
        <div className="alert alert-primary d-flex align-items-center justify-content-between w-100 py-2 px-3 mb-3 shadow-sm">
          <div className="d-flex align-items-center gap-2 small">
            <i className="bx bx-info-circle fs-5"></i>
            <span>¿Cámara inaccesible o participante sin QR?</span>
          </div>
          <button
            type="button"
            onClick={() => setShowManualModal(true)}
            className="btn btn-sm btn-dark text-white fw-bold d-flex align-items-center gap-1"
            title="Opciones de contingencia e ingreso manual"
          >
            <i className="bx bx-list-check"></i> Opciones Manuales
          </button>
        </div>

        <QRScannerView
          triggerWalkInModal={triggerWalkIn}
          onWalkInModalClosed={() => setTriggerWalkIn(false)}
          triggerFocusDni={focusDniCounter}
        />
      </main>

      <footer className="py-2 text-center text-muted small bg-white border-top">
        PWA Operativa DETS • Sincronización automática con backend PostgreSQL
      </footer>

      {/* MODAL POPUP DE OPCIONES MANUALES */}
      {showManualModal && (
        <div
          className="modal fade show d-block"
          tabIndex={-1}
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)', zIndex: 1070 }}
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '480px' }}>
            <div className="modal-content shadow-2xl border-0 rounded-4 overflow-hidden">
              <div className="modal-header bg-gradient bg-primary text-white py-3 px-4 border-0">
                <div className="d-flex align-items-center gap-2">
                  <div className="bg-white bg-opacity-25 rounded-circle p-2 d-flex align-items-center justify-content-center">
                    <i className="bx bx-slider fs-4 text-warning"></i>
                  </div>
                  <div>
                    <h5 className="modal-title fw-bold fs-6 mb-0 text-white">
                      Opciones de Operación Manual
                    </h5>
                    <small className="text-white-50" style={{ fontSize: '0.75rem' }}>
                      Seleccione la acción requerida para continuar
                    </small>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  aria-label="Cerrar"
                  onClick={() => setShowManualModal(false)}
                ></button>
              </div>

              <div className="modal-body p-4 bg-light">
                <p className="text-muted small mb-3">
                  Elija entre validar un participante registrado sin QR, dar de alta a un asistente espontáneo en puerta o consultar la guía paso a paso del sistema:
                </p>

                <div className="d-grid gap-2.5">
                  {/* Opción 1: Acreditar / Buscar por DNI */}
                  <button
                    type="button"
                    onClick={handleSelectSearchDni}
                    className="btn btn-white border border-secondary-subtle p-3 text-start d-flex align-items-center justify-content-between rounded-3 shadow-sm hover-shadow transition"
                    style={{ backgroundColor: '#ffffff' }}
                  >
                    <div className="d-flex align-items-center gap-3">
                      <div className="bg-primary-subtle text-primary p-2.5 rounded-3">
                        <i className="bx bx-id-card fs-4"></i>
                      </div>
                      <div>
                        <div className="fw-bold text-dark" style={{ fontSize: '0.95rem' }}>
                          Acreditar por DNI / Pasaporte
                        </div>
                        <small className="text-muted d-block" style={{ fontSize: '0.78rem' }}>
                          Escribir documento para validar credencial sin cámara
                        </small>
                      </div>
                    </div>
                    <i className="bx bx-chevron-right fs-4 text-muted"></i>
                  </button>

                  {/* Opción 2: Alta Rápida de Mostrador (Walk-in) */}
                  <button
                    type="button"
                    onClick={handleSelectWalkIn}
                    className="btn btn-white border border-secondary-subtle p-3 text-start d-flex align-items-center justify-content-between rounded-3 shadow-sm hover-shadow transition"
                    style={{ backgroundColor: '#ffffff' }}
                  >
                    <div className="d-flex align-items-center gap-3">
                      <div className="bg-warning-subtle text-warning-emphasis p-2.5 rounded-3">
                        <i className="bx bx-user-plus fs-4 text-warning"></i>
                      </div>
                      <div>
                        <div className="fw-bold text-dark" style={{ fontSize: '0.95rem' }}>
                          Alta Rápida de Mostrador (Walk-in)
                        </div>
                        <small className="text-muted d-block" style={{ fontSize: '0.78rem' }}>
                          Registrar e ingresar a un asistente espontáneo in situ
                        </small>
                      </div>
                    </div>
                    <i className="bx bx-chevron-right fs-4 text-muted"></i>
                  </button>

                  {/* Opción 3: Manual de Usuario y Operador */}
                  <button
                    type="button"
                    onClick={handleSelectManualDoc}
                    className="btn btn-white border border-secondary-subtle p-3 text-start d-flex align-items-center justify-content-between rounded-3 shadow-sm hover-shadow transition"
                    style={{ backgroundColor: '#ffffff' }}
                  >
                    <div className="d-flex align-items-center gap-3">
                      <div className="bg-info-subtle text-info-emphasis p-2.5 rounded-3">
                        <i className="bx bx-book-open fs-4 text-info"></i>
                      </div>
                      <div>
                        <div className="fw-bold text-dark" style={{ fontSize: '0.95rem' }}>
                          Manual de Usuario y Operador (PDF/HTML)
                        </div>
                        <small className="text-muted d-block" style={{ fontSize: '0.78rem' }}>
                          Instructivo oficial ilustrado con capturas de pantalla
                        </small>
                      </div>
                    </div>
                    <i className="bx bx-link-external fs-5 text-muted"></i>
                  </button>
                </div>
              </div>

              <div className="modal-footer bg-white py-2.5 px-4 border-top d-flex justify-content-end">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary px-3"
                  onClick={() => setShowManualModal(false)}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
