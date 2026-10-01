import { runConfirmationCron, runAutoDropAndPromotionCron, runScheduledBackup } from './cronTasks';
import { query } from './db';

interface CronStatus {
  isRunning: boolean;
  intervalMinutes: number;
  lastRunAt: string | null;
  lastBackupAt: string | null;
  lastResult: any;
  nextRunEstimated: string | null;
  totalExecutions: number;
}

let cronTimer: NodeJS.Timeout | null = null;
let isExecuting = false;
let lastBackupTimestamp = 0;
const INTERVAL_MS = parseInt(process.env.CRON_INTERVAL_MS || '1800000', 10); // 30 minutos por defecto

const status: CronStatus = {
  isRunning: false,
  intervalMinutes: Math.round(INTERVAL_MS / 60000),
  lastRunAt: null,
  lastBackupAt: null,
  lastResult: null,
  nextRunEstimated: null,
  totalExecutions: 0,
};

/**
 * Ejecuta un ciclo del cron autónomo de reconfirmaciones y bajas 48hs
 */
export async function executeCronCycle(): Promise<{
  success: boolean;
  bajas?: any;
  confirmaciones?: any;
  error?: string;
}> {
  if (isExecuting) {
    console.log('⏳ [CRON SCHEDULER] Ciclo anterior aún en curso, omitiendo ejecución concurrente.');
    return { success: false, error: 'Ciclo anterior en ejecución' };
  }

  isExecuting = true;
  const startedAt = new Date();
  console.log(`⏱️ [CRON SCHEDULER] Iniciando ciclo programado a las ${startedAt.toISOString()}...`);

  try {
    // 1. Ejecutar procesamiento de bajas automáticas y reasignación FIFO de lista de espera
    const bajasResult = await runAutoDropAndPromotionCron().catch((err) => {
      console.error('❌ [CRON SCHEDULER] Error en bajas automáticas:', err.message);
      return { error: err.message, bajasCount: 0, promovidosCount: 0 };
    });

    // 2. Ejecutar despacho de recordatorios a quienes tengan vacante confirmada (si aplica)
    const confResult = await runConfirmationCron().catch((err) => {
      console.error('❌ [CRON SCHEDULER] Error en recordatorios:', err.message);
      return { error: err.message, totalNotificados: 0 };
    });

    // 3. Ejecutar backup automático diario si han transcurrido más de 24 horas
    let backupResult: any = null;
    if (Date.now() - lastBackupTimestamp >= 24 * 60 * 60 * 1000) {
      console.log('💾 [CRON SCHEDULER] Iniciando backup automático diario y rotación de retención...');
      backupResult = await runScheduledBackup('CRON_PROGRAMADO_DIARIO', 7).catch((err) => {
        console.error('❌ [CRON SCHEDULER] Error en backup automático:', err.message);
        return { error: err.message };
      });
      lastBackupTimestamp = Date.now();
      status.lastBackupAt = new Date(lastBackupTimestamp).toISOString();
    }

    status.lastRunAt = startedAt.toISOString();
    status.lastResult = { bajas: bajasResult, confirmaciones: confResult, backup: backupResult };
    status.totalExecutions++;
    status.nextRunEstimated = new Date(Date.now() + INTERVAL_MS).toISOString();

    // Registrar en auditoría
    await query(
      `INSERT INTO logs_auditoria (evento, actor_usuario, detalles, timestamp)
       VALUES ('CRON_CYCLE_COMPLETED', 'CRON_SCHEDULER', $1, NOW())`,
      [
        JSON.stringify({
          duracion_ms: Date.now() - startedAt.getTime(),
          bajas_aplicadas: (bajasResult as any).bajasCount || 0,
          promociones_fifo: (bajasResult as any).promovidosCount || 0,
          notificados: (confResult as any).totalNotificados || 0,
        }),
      ]
    ).catch(() => {});

    console.log(
      `✅ [CRON SCHEDULER] Ciclo completado. Bajas: ${(bajasResult as any).bajasCount || 0} | Promovidos FIFO: ${(bajasResult as any).promovidosCount || 0}`
    );

    return {
      success: true,
      bajas: bajasResult,
      confirmaciones: confResult,
    };
  } catch (error: any) {
    console.error('❌ [CRON SCHEDULER] Falla crítica en ciclo programado:', error);
    status.lastResult = { error: error.message };
    return { success: false, error: error.message };
  } finally {
    isExecuting = false;
  }
}

/**
 * Inicia el temporizador de fondo
 */
export function startCronScheduler(): void {
  if (cronTimer) {
    console.log('ℹ️ [CRON SCHEDULER] El temporizador ya se encuentra activo.');
    return;
  }

  status.isRunning = true;
  status.nextRunEstimated = new Date(Date.now() + INTERVAL_MS).toISOString();

  // Programar ejecuciones periódicas
  cronTimer = setInterval(() => {
    executeCronCycle().catch((err) => {
      console.error('Error no capturado en executeCronCycle:', err);
    });
  }, INTERVAL_MS);

  console.log(
    `🚀 [CRON SCHEDULER] Planificador en segundo plano iniciado (Intervalo: ${status.intervalMinutes} min).`
  );
}

/**
 * Detiene el temporizador (Graceful Shutdown)
 */
export function stopCronScheduler(): void {
  if (cronTimer) {
    clearInterval(cronTimer);
    cronTimer = null;
    status.isRunning = false;
    status.nextRunEstimated = null;
    console.log('🛑 [CRON SCHEDULER] Planificador en segundo plano detenido limpiamente.');
  }
}

/**
 * Retorna la telemetría actual del scheduler
 */
export function getCronSchedulerStatus(): CronStatus {
  return { ...status };
}
