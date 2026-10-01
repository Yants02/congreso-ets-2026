'use client';

import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';

interface Props {
  onNotice: (msg: string) => void;
}

interface SchedulerStatus {
  isRunning: boolean;
  intervalMinutes: number;
  lastRunAt: string | null;
  lastResult: any;
  nextRunEstimated: string | null;
  totalExecutions: number;
}

export default function AdminCronView({ onNotice }: Props) {
  const [running, setRunning] = useState(false);
  const [scheduler, setScheduler] = useState<SchedulerStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);

  async function loadSchedulerStatus() {
    setLoadingStatus(true);
    try {
      const res = await fetch('/api/admin/cron/scheduler-status');
      if (res.ok) {
        const data = await res.json();
        setScheduler(data.status || null);
      }
    } catch (err) {
      console.error('Error cargando estado del scheduler:', err);
    } finally {
      setLoadingStatus(false);
    }
  }

  useEffect(() => {
    loadSchedulerStatus();
    const interval = setInterval(loadSchedulerStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  async function handleTrigger(tipo: 'CONFIRMACION' | 'DROPS' | 'CICLO_COMPLETO') {
    const confirmRes = await Swal.fire({
      title: '¿Ejecutar proceso de cron?',
      text: `Se iniciará manualmente la tarea programada: ${tipo}.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, ejecutar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#005691',
      cancelButtonColor: '#6c757d',
    });
    if (!confirmRes.isConfirmed) return;

    setRunning(true);
    try {
      const res = await fetch('/api/admin/cron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo }),
      });
      const data = await res.json();
      if (res.ok) {
        await Swal.fire({
          title: 'Proceso Ejecutado',
          text: data.mensaje || `Proceso ${tipo} ejecutado con éxito.`,
          icon: 'success',
          confirmButtonColor: '#005691',
        });
        onNotice(data.mensaje || `Proceso ${tipo} ejecutado.`);
        loadSchedulerStatus();
      } else {
        await Swal.fire({
          title: 'Error',
          text: data.message || 'Error al ejecutar cron',
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
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Tarjeta de Telemetría del Scheduler en Segundo Plano */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🤖</span>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Planificador Autónomo en Segundo Plano (Cron Daemon)</h2>
              <p className="text-xs text-gray-500">Servicio residente en Node.js que ejecuta periódicamente la política de vacantes y reconfirmación</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
              scheduler?.isRunning ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
            }`}>
              <span className={`w-2 h-2 rounded-full ${scheduler?.isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
              {scheduler?.isRunning ? 'ACTIVO (INTERVALO)' : 'EN ESPERA'}
            </span>
            <button
              onClick={loadSchedulerStatus}
              disabled={loadingStatus}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              title="Refrescar estado"
            >
              🔄
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-xs font-bold text-gray-400 uppercase">Frecuencia de Ciclos</span>
            <p className="text-2xl font-extrabold text-gray-900 mt-1">{scheduler?.intervalMinutes || 30} min</p>
            <span className="text-xs text-gray-500">Temporizador automático</span>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-xs font-bold text-gray-400 uppercase">Ciclos Totales</span>
            <p className="text-2xl font-extrabold text-blue-700 mt-1">{scheduler?.totalExecutions || 0}</p>
            <span className="text-xs text-gray-500">Ejecuciones completadas</span>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-xs font-bold text-gray-400 uppercase">Último Ciclo</span>
            <p className="text-xs font-mono font-bold text-gray-800 mt-2 truncate">
              {scheduler?.lastRunAt ? new Date(scheduler.lastRunAt).toLocaleTimeString('es-AR') : 'Pendiente'}
            </p>
            <span className="text-[11px] text-gray-400">
              {scheduler?.lastRunAt ? new Date(scheduler.lastRunAt).toLocaleDateString('es-AR') : 'Sin ejecuciones previas'}
            </span>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-xs font-bold text-gray-400 uppercase">Próximo Ciclo</span>
            <p className="text-xs font-mono font-bold text-emerald-700 mt-2 truncate">
              {scheduler?.nextRunEstimated ? new Date(scheduler.nextRunEstimated).toLocaleTimeString('es-AR') : 'Calculando...'}
            </p>
            <span className="text-[11px] text-gray-400">Hora estimada de ejecución</span>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            disabled={running}
            onClick={() => handleTrigger('CICLO_COMPLETO')}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg shadow-sm disabled:opacity-50 flex items-center gap-1.5"
          >
            {running ? 'Ejecutando ciclo...' : '⚡ Forzar Ciclo Completo Ahora'}
          </button>
        </div>
      </div>

      {/* Disparadores Manuales de Rutinas Específicas */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
        <h2 className="text-lg font-bold text-gray-900">⏱️ Disparadores Manuales Específicos</h2>
        <p className="text-sm text-gray-600">
          Puedes forzar la ejecución manual aislada de cada una de las dos rutinas del sistema para pruebas operativas o contingencias.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="border border-blue-200 bg-blue-50/50 p-5 rounded-xl space-y-3">
            <h3 className="font-bold text-blue-900">1. Recordatorios de Confirmación (48hs)</h3>
            <p className="text-xs text-blue-700">
              Escanea inscripciones confirmadas próximas al evento y despacha tokens de reconfirmación de 24hs por correo electrónico institucional.
            </p>
            <button
              disabled={running}
              onClick={() => handleTrigger('CONFIRMACION')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm disabled:opacity-50"
            >
              {running ? 'Procesando...' : 'Ejecutar Recordatorios'}
            </button>
          </div>

          <div className="border border-amber-200 bg-amber-50/50 p-5 rounded-xl space-y-3">
            <h3 className="font-bold text-amber-900">2. Bajas Automáticas y Promoción FIFO</h3>
            <p className="text-xs text-amber-700">
              Aplica BAJA_AUTOMATICA a quienes venció su token sin confirmar ni acreditarse, y promueve inmediatamente a los aspirantes en lista de espera por orden de llegada.
            </p>
            <button
              disabled={running}
              onClick={() => handleTrigger('DROPS')}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-lg shadow-sm disabled:opacity-50"
            >
              {running ? 'Procesando...' : 'Ejecutar Bajas & Promoción FIFO'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
