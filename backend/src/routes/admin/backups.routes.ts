import { Router, Response } from 'express';
import { AuthenticatedRequest, requireHierarchy } from '../../middlewares/authMiddleware';
import {
  createIntegralBackup,
  listBackups,
  getBackupPath,
  restoreBackup,
  createStandaloneSqlDump,
  listSqlDumps,
  getSqlDumpPath,
} from '../../lib/backupService';

const router = Router();

/**
 * GET /api/admin/backups
 * Lista todas las copias de seguridad disponibles con el desglose modular
 */
router.get('/', requireHierarchy(4), async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const backups = await listBackups();
    res.json({
      ok: true,
      backups,
      total: backups.length,
    });
  } catch (error: any) {
    console.error('Error listando backups:', error);
    res.status(500).json({ ok: false, error: 'ERR_LIST_BACKUPS', message: error.message });
  }
});

/**
 * POST /api/admin/backups
 * Genera una nueva copia de seguridad con separación modular inmediata y dumps SQL
 */
router.post('/', requireHierarchy(5), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const actor = req.operator?.email || 'ADMIN';
    const metadata = await createIntegralBackup(actor, true);

    res.status(201).json({
      ok: true,
      mensaje: 'Copia de seguridad generada con éxito con segregación modular y dumps SQL.',
      backup: metadata,
    });
  } catch (error: any) {
    console.error('Error creando backup manual:', error);
    res.status(500).json({ ok: false, error: 'ERR_CREATE_BACKUP', message: error.message });
  }
});

/**
 * GET /api/admin/backups/descargar/:filename
 * Descarga el archivo comprimido .zip del backup
 */
router.get('/descargar/:filename', requireHierarchy(4), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const filename = req.params.filename;
    const filepath = getBackupPath(filename);

    if (!filepath) {
      res.status(404).json({ ok: false, error: 'ERR_NOT_FOUND', message: 'Archivo de backup no encontrado.' });
      return;
    }

    res.download(filepath, filename);
  } catch (error: any) {
    console.error('Error descargando backup:', error);
    res.status(500).json({ ok: false, error: 'ERR_DOWNLOAD_BACKUP', message: error.message });
  }
});

/**
 * POST /api/admin/backups/restaurar/:filename
 * Restaura el sistema a partir de un backup (soporta modo 'completo', 'operacion', 'configuracion', 'usuarios')
 */
router.post('/restaurar/:filename', requireHierarchy(5), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const filename = req.params.filename;
    const filepath = getBackupPath(filename);

    if (!filepath) {
      res.status(404).json({ ok: false, error: 'ERR_NOT_FOUND', message: 'Archivo de backup no encontrado.' });
      return;
    }

    const actor = req.operator?.email || 'SUPERADMIN';
    const modo = (req.body?.modo as 'completo' | 'operacion' | 'configuracion' | 'usuarios') || 'completo';

    const resultado = await restoreBackup(filepath, actor, modo);

    res.json({
      ok: true,
      mensaje: `Restauración de backup (${modo}) completada exitosamente.`,
      resultado,
    });
  } catch (error: any) {
    console.error('Error restaurando backup:', error);
    res.status(500).json({ ok: false, error: 'ERR_RESTORE_BACKUP', message: error.message });
  }
});

/**
 * GET /api/admin/backups/dumps
 * Lista todos los dumps SQL de la base de datos disponibles
 */
router.get('/dumps', requireHierarchy(4), async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const dumps = await listSqlDumps();
    res.json({
      ok: true,
      dumps,
      total: dumps.length,
    });
  } catch (error: any) {
    console.error('Error listando dumps SQL:', error);
    res.status(500).json({ ok: false, error: 'ERR_LIST_DUMPS', message: error.message });
  }
});

/**
 * POST /api/admin/backups/dumps
 * Genera un dump SQL nativo de la base de datos del sistema
 */
router.post('/dumps', requireHierarchy(5), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const actor = req.operator?.email || 'SUPERADMIN';
    const tipo = (req.body?.tipo as 'completo' | 'operacion' | 'configuracion' | 'usuarios') || 'completo';

    const dump = await createStandaloneSqlDump(tipo, actor);

    res.status(201).json({
      ok: true,
      mensaje: `Dump SQL (${tipo}) generado exitosamente mediante pg_dump.`,
      dump,
    });
  } catch (error: any) {
    console.error('Error generando dump SQL:', error);
    res.status(500).json({ ok: false, error: 'ERR_CREATE_DUMP', message: error.message });
  }
});

/**
 * GET /api/admin/backups/dumps/descargar/:filename
 * Descarga el archivo de dump SQL directo
 */
router.get('/dumps/descargar/:filename', requireHierarchy(4), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const filename = req.params.filename;
    const filepath = getSqlDumpPath(filename);

    if (!filepath) {
      res.status(404).json({ ok: false, error: 'ERR_NOT_FOUND', message: 'Archivo de dump SQL no encontrado.' });
      return;
    }

    res.download(filepath, filename);
  } catch (error: any) {
    console.error('Error descargando dump SQL:', error);
    res.status(500).json({ ok: false, error: 'ERR_DOWNLOAD_DUMP', message: error.message });
  }
});

export default router;

