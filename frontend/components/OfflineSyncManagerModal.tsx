'use client';

import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { useOfflineAcreditacion, playAudioFeedback } from '@/hooks/useOfflineAcreditacion';
import { openDB } from 'idb';

interface QueuedItem {
  id?: number;
  qr_token: string;
  punto_acceso_id: number;
  tipo_acreditacion_id: number;
  actividad_id?: number | null;
  operador_id?: number | null;
  tipo_movimiento?: 'INGRESO' | 'EGRESO';
  timestamp?: string;
}

export const OfflineSyncManagerModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const { isOnline, pendingCount, syncAcreditaciones } = useOfflineAcreditacion();
  const [queuedRecords, setQueuedRecords] = useState<QueuedItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);

  const loadQueuedItems = async () => {
    try {
      setLoading(true);
      const db = await openDB('ets_acreditaciones_db', 1);
      if (db.objectStoreNames.contains('queue_acreditaciones')) {
        const records = await db.getAll('queue_acreditaciones');
        setQueuedRecords(records || []);
      }
    } catch (err) {
      console.error('Error cargando registros IndexedDB:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadQueuedItems();
    }
  }, [isOpen, pendingCount]);

  const handleManualSync = async () => {
    if (!isOnline) {
      Swal.fire({
        icon: 'warning',
        title: 'Sin Conexión a Internet',
        text: 'No es posible sincronizar mientras el dispositivo se encuentre en estado OFFLINE. Los registros permanecen seguros en IndexedDB.',
        confirmButtonColor: '#005691',
      });
      return;
    }

    try {
      setSyncing(true);
      await syncAcreditaciones();
      await loadQueuedItems();
      playAudioFeedback('success');
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Sincronización Completada',
        text: 'Todos los registros pendientes fueron subidos a PostgreSQL.',
        showConfirmButton: false,
        timer: 3000,
      });
    } catch (err: any) {
      playAudioFeedback('error');
      Swal.fire({
        icon: 'error',
        title: 'Error de Sincronización',
        text: err?.message || 'Ocurrió un error al enviar el lote.',
        confirmButtonColor: '#005691',
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleClearQueue = async () => {
    const result = await Swal.fire({
      title: '¿Purgar Cola Local?',
      text: 'Esta acción eliminará todos los registros encolados en IndexedDB que no hayan sido sincronizados.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, purgar',
      cancelButtonText: 'Cancelar',
    });

    if (result.isConfirmed) {
      try {
        const db = await openDB('ets_acreditaciones_db', 1);
        const tx = db.transaction('queue_acreditaciones', 'readwrite');
        await tx.objectStore('queue_acreditaciones').clear();
        await tx.done;
        await loadQueuedItems();
        Swal.fire('Purgado', 'La cola local de IndexedDB ha sido vaciada.', 'success');
      } catch (err: any) {
        Swal.fire('Error', 'No se pudo purgar la cola local.', 'error');
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal fade show d-block"
      tabIndex={-1}
      style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 10500 }}
    >
      <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content shadow-lg border-0">
          <div className="modal-header bg-dark text-white py-2 px-3">
            <div className="d-flex align-items-center gap-2">
              <i className="bx bx-sync fs-4 text-warning"></i>
              <div>
                <h5 className="modal-title fs-6 fw-bold mb-0">
                  Panel de Monitoreo de Sincronización Offline
                </h5>
                <small className="text-white-50" style={{ fontSize: '0.75rem' }}>
                  IndexedDB (Local PWA) ➔ PostgreSQL Central
                </small>
              </div>
            </div>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={onClose}
              aria-label="Cerrar"
            ></button>
          </div>

          <div className="modal-body p-3">
            {/* Tarjeta de estado de conectividad */}
            <div className="row g-2 mb-3">
              <div className="col-12 col-md-6">
                <div className="p-3 border rounded bg-light d-flex align-items-center justify-content-between">
                  <div>
                    <span className="text-muted small d-block">Estado del Canal</span>
                    <strong className={isOnline ? 'text-success' : 'text-danger'}>
                      <i className={`bx ${isOnline ? 'bx-wifi' : 'bx-wifi-off'} me-1`}></i>
                      {isOnline ? 'CONECTADO (ONLINE)' : 'SIN SEÑAL (OFFLINE)'}
                    </strong>
                  </div>
                  <span
                    className={`badge ${isOnline ? 'bg-success' : 'bg-danger'} px-2 py-1`}
                  >
                    {isOnline ? 'HTTP Activo' : 'Tolerancia Local'}
                  </span>
                </div>
              </div>

              <div className="col-12 col-md-6">
                <div className="p-3 border rounded bg-light d-flex align-items-center justify-content-between">
                  <div>
                    <span className="text-muted small d-block">Acreditaciones Encoladas</span>
                    <strong className="fs-5 text-dark">{queuedRecords.length}</strong>
                  </div>
                  <span
                    className={`badge ${
                      queuedRecords.length > 0 ? 'bg-warning text-dark' : 'bg-secondary'
                    } px-2 py-1`}
                  >
                    {queuedRecords.length > 0 ? 'Pendientes de Subida' : 'Al Día'}
                  </span>
                </div>
              </div>
            </div>

            {/* Listado de acreditaciones en cola */}
            <h6 className="fw-bold text-secondary mb-2 d-flex align-items-center justify-content-between">
              <span>Registros en Cola Local (IndexedDB)</span>
              <button
                type="button"
                className="btn btn-sm btn-link text-decoration-none p-0"
                onClick={loadQueuedItems}
                disabled={loading}
              >
                <i className="bx bx-refresh"></i> Actualizar lista
              </button>
            </h6>

            {loading ? (
              <div className="text-center py-4">
                <div className="spinner-border spinner-border-sm text-primary" role="status"></div>
                <span className="ms-2 small text-muted">Consultando almacenamiento local...</span>
              </div>
            ) : queuedRecords.length === 0 ? (
              <div className="alert alert-light border text-center py-4 my-2">
                <i className="bx bx-check-circle fs-2 text-success d-block mb-1"></i>
                <p className="mb-0 text-muted small">
                  No hay acreditaciones pendientes de sincronización. Todo está sincronizado con la base de datos central.
                </p>
              </div>
            ) : (
              <div className="table-responsive border rounded" style={{ maxHeight: '250px' }}>
                <table className="table table-sm table-hover mb-0 text-nowrap align-middle" style={{ fontSize: '0.8rem' }}>
                  <thead className="table-light sticky-top">
                    <tr>
                      <th>#ID</th>
                      <th>Token QR</th>
                      <th>Tipo Movimiento</th>
                      <th>Punto Acceso</th>
                      <th>Fecha/Hora Local</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queuedRecords.map((item, idx) => (
                      <tr key={item.id || idx}>
                        <td className="fw-bold">{item.id || idx + 1}</td>
                        <td>
                          <code className="text-truncate d-inline-block" style={{ maxWidth: '140px' }}>
                            {item.qr_token}
                          </code>
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              item.tipo_movimiento === 'EGRESO' ? 'bg-secondary' : 'bg-primary'
                            }`}
                          >
                            {item.tipo_movimiento || 'INGRESO'}
                          </span>
                        </td>
                        <td>Punto #{item.punto_acceso_id}</td>
                        <td className="text-muted">
                          {item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : 'N/D'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="modal-footer bg-light py-2 px-3 d-flex justify-content-between">
            <button
              type="button"
              className="btn btn-sm btn-outline-danger"
              onClick={handleClearQueue}
              disabled={queuedRecords.length === 0 || syncing}
            >
              <i className="bx bx-trash me-1"></i> Purgar Cola
            </button>

            <div className="d-flex gap-2">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={onClose}
              >
                Cerrar
              </button>
              <button
                type="button"
                className="btn btn-sm btn-primary fw-bold d-flex align-items-center gap-1"
                onClick={handleManualSync}
                disabled={queuedRecords.length === 0 || syncing || !isOnline}
              >
                {syncing ? (
                  <>
                    <span className="spinner-border spinner-border-sm" role="status"></span>
                    <span>Sincronizando...</span>
                  </>
                ) : (
                  <>
                    <i className="bx bx-cloud-upload"></i>
                    <span>Sincronizar Ahora</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
