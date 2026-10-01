import { Router, Response } from 'express';
import { query } from '../lib/db';
import { runConfirmationCron, runAutoDropAndPromotionCron } from '../lib/cronTasks';
import { AuthenticatedRequest, requireHierarchy } from '../middlewares/authMiddleware';

// Sub-routers modulares de gestión de entidades
import catalogosRoutes from './admin/catalogos.routes';
import usuariosRoutes from './admin/usuarios.routes';
import actividadesRoutes from './admin/actividades.routes';
import puntosAccesoRoutes from './admin/puntos-acceso.routes';
import operadoresRoutes from './admin/operadores.routes';
import catalogoActividadesRoutes from './admin/catalogo-actividades.routes';
import blacklistRoutes from './admin/blacklist.routes';
import acreditacionesRoutes from './admin/acreditaciones.routes';
import certificadosRoutes from './admin/certificados.routes';
import homologacionesRoutes from './admin/homologaciones.routes';
import eventosRoutes from './admin/eventos.routes';
import configuracionRoutes from './admin/configuracion.routes';
import auditoriaRoutes from './admin/auditoria.routes';
import encuestasRoutes from './encuestas.routes';
import reportesRoutes from './admin/reportes.routes';
import backupsRoutes from './admin/backups.routes';
import presentadoresRoutes from './admin/presentadores.routes';
import estadisticasRoutes from './admin/estadisticas-desglosadas.routes';
import pushAdminRoutes from './admin/push.routes';
import journalingRoutes from './admin/journaling.routes';
import frontendCmsRoutes from './admin/frontend-cms.routes';

const router = Router();

// 1. Montaje de módulos CRUD y buscadores de entidades
router.use('/catalogos', catalogosRoutes);
router.use('/usuarios', usuariosRoutes);
router.use('/actividades', actividadesRoutes);
router.use('/puntos-acceso', puntosAccesoRoutes);
router.use('/operadores', operadoresRoutes);
router.use('/catalogo-actividades', catalogoActividadesRoutes);
router.use('/blacklist', blacklistRoutes);
router.use('/acreditaciones', acreditacionesRoutes);
router.use('/certificados', certificadosRoutes);
router.use('/homologaciones', homologacionesRoutes);
router.use('/eventos', eventosRoutes);
router.use('/configuracion', configuracionRoutes);
router.use('/auditoria', auditoriaRoutes);
router.use('/encuestas', encuestasRoutes);
router.use('/reportes', reportesRoutes);
router.use('/backups', backupsRoutes);
router.use('/presentadores', presentadoresRoutes);
router.use('/estadisticas', estadisticasRoutes);
router.use('/push', pushAdminRoutes);
router.use('/journaling', journalingRoutes);
router.use('/frontend-cms', frontendCmsRoutes);

// 2. Tablero Gerencial (Dashboard 3D)
router.get('/dashboard/gerencial', requireHierarchy(3), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const rawEventoId = req.query.evento_id as string | undefined;
    let targetEventoId = rawEventoId ? parseInt(rawEventoId, 10) : null;
    if (!targetEventoId || isNaN(targetEventoId)) {
      const evRes = await query(
        `SELECT id FROM eventos WHERE codigo = 'ETS_2026' OR activo = TRUE ORDER BY (codigo = 'ETS_2026') DESC, anio ASC LIMIT 1`
      );
      targetEventoId = evRes.rows[0]?.id || 1;
    }

    const [statsRes, rolesRes, puntosRes, ultimosIngresos] = await Promise.all([
      query(`
        SELECT 
          (SELECT COALESCE(cupo_maximo, 400) FROM eventos WHERE id = $1) as cupo_maximo,
          COUNT(*) FILTER (WHERE ei.codigo = 'CONFIRMADO') as confirmados,
          COUNT(*) FILTER (WHERE ei.codigo = 'LISTA_ESPERA') as lista_espera,
          COUNT(*) FILTER (WHERE ei.codigo = 'SANCIONADO') as sancionados,
          COUNT(*) FILTER (WHERE ei.codigo = 'BAJA_AUTOMATICA') as bajas_automaticas,
          COUNT(*) FILTER (WHERE ei.codigo = 'CANCELADO') as cancelados
        FROM usuarios u
        JOIN estados_inscripcion ei ON u.estado_inscripcion_id = ei.id
        WHERE u.evento_id = $1
      `, [targetEventoId]),

      query(`
        SELECT r.nombre, COUNT(u.id) as cantidad
        FROM roles r
        LEFT JOIN usuarios u ON u.rol_principal_id = r.id AND u.evento_id = $1
        GROUP BY r.id, r.nombre
        ORDER BY r.jerarquia ASC
      `, [targetEventoId]),

      query(`
        SELECT pa.id, pa.nombre, pa.ubicacion_fisica, pa.capacidad_maxima,
               COUNT(a.id) as total_movimientos,
               COUNT(a.id) FILTER (WHERE a.tipo_movimiento = 'INGRESO') as ingresos,
               COUNT(a.id) FILTER (WHERE a.tipo_movimiento = 'EGRESO') as egresos
        FROM puntos_acceso pa
        LEFT JOIN acreditaciones a ON a.punto_acceso_id = pa.id
        WHERE pa.activo = TRUE
        GROUP BY pa.id, pa.nombre, pa.ubicacion_fisica, pa.capacidad_maxima
        ORDER BY pa.id ASC
      `),

      query(`
        SELECT a.id, a.timestamp_acreditacion, a.tipo_movimiento,
               u.nombre, u.apellido, u.dni_pasaporte, r.nombre as rol,
               pa.nombre as punto_acceso
        FROM acreditaciones a
        JOIN usuarios u ON a.usuario_id = u.id
        JOIN roles r ON u.rol_principal_id = r.id
        JOIN puntos_acceso pa ON a.punto_acceso_id = pa.id
        ORDER BY a.timestamp_acreditacion DESC
        LIMIT 10
      `),
    ]);

    const stats = statsRes.rows[0] || {};
    const cupoMaximo = parseInt(stats.cupo_maximo || '400', 10);
    const confirmados = parseInt(stats.confirmados || '0', 10);

    res.json({
      ok: true,
      evento_id: targetEventoId,
      resumen: {
        cupo_maximo: cupoMaximo,
        confirmados,
        cupos_disponibles: Math.max(0, cupoMaximo - confirmados),
        lista_espera: parseInt(stats.lista_espera || '0', 10),
        sancionados: parseInt(stats.sancionados || '0', 10),
        bajas_automaticas: parseInt(stats.bajas_automaticas || '0', 10),
        cancelados: parseInt(stats.cancelados || '0', 10),
      },
      distribucion_roles: rolesRes.rows,
      puntos_acceso: puntosRes.rows,
      ultimos_ingresos: ultimosIngresos.rows,
    });
  } catch (error: any) {
    console.error('Error en GET /api/admin/dashboard/gerencial:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

// 3. Telemetría y control del Scheduler en segundo plano
router.get('/cron/scheduler-status', requireHierarchy(4), async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { getCronSchedulerStatus } = await import('../lib/cronScheduler');
    res.json({ ok: true, status: getCronSchedulerStatus() });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// 4. Disparo manual de Cron de caducidades y confirmaciones
router.post('/cron', requireHierarchy(5), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tipo = (req.body.tipo as string) || 'CONFIRMACION';

    if (tipo === 'CONFIRMACION') {
      const resCron = await runConfirmationCron();
      res.json({
        ok: true,
        mensaje: 'Cron de solicitud de reconfirmación (48hs) ejecutado con éxito.',
        resultado: resCron,
      });
    } else if (tipo === 'CICLO_COMPLETO') {
      const { executeCronCycle } = await import('../lib/cronScheduler');
      const cycleResult = await executeCronCycle();
      res.json({
        ok: true,
        mensaje: 'Ciclo completo de bajas automáticas y reconfirmaciones ejecutado con éxito.',
        resultado: cycleResult,
      });
    } else {
      const resDrop = await runAutoDropAndPromotionCron();
      res.json({
        ok: true,
        mensaje: 'Cron de bajas automáticas y ascensos FIFO (24hs) ejecutado con éxito.',
        resultado: resDrop,
      });
    }
  } catch (error: any) {
    console.error('Error en POST /api/admin/cron:', error);
    res.status(500).json({ ok: false, error: 'ERR_CRON_EXECUTION', message: error.message });
  }
});

export default router;
