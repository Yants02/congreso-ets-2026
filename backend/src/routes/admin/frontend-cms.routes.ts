import { Router, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { query } from '../../lib/db';
import { AuthenticatedRequest, requireHierarchy } from '../../middlewares/authMiddleware';

export interface FrontendCard {
  id: number | string;
  title: string;
  description: string;
  image: string;
  builtinKey?: string;
  pdfUrl?: string;
  badge?: string;
  colorAccent?: string;
  activo: boolean;
  orden: number;
}

export const DEFAULT_FRONTEND_CARDS: FrontendCard[] = [
  {
    id: 1,
    image: '/assets/icons/card1.svg',
    builtinKey: 'card1',
    title: 'Aula Abierta',
    description:
      'Instancias programadas para mostrar el saber hacer técnico-profesional en acción. Permiten presentar procedimientos, prácticas, simulaciones, intervenciones, uso de herramientas, resolución de problemas o secuencias de trabajo que necesitan ser observadas de manera dinámica y contextualizada.',
    pdfUrl: '/PDF/1 Aula Abierta - demostraciones aplicadas.pdf',
    badge: 'Demostración Práctica',
    activo: true,
    orden: 1,
  },
  {
    id: 2,
    image: '/assets/icons/card2.svg',
    builtinKey: 'card2',
    title: 'Muestra permanente / Stands',
    description:
      'Espacio institucional de muestra permanente destinado a exhibir experiencias, proyectos, producciones y evidencias formativas. El foco no está solamente en el resultado final, sino también en el proceso, las decisiones técnicas, la participación estudiantil y los aprendizajes construidos.',
    pdfUrl: '/PDF/2 Muestra permanente - Stands.pdf',
    badge: 'Exhibición Permanente',
    activo: true,
    orden: 2,
  },
  {
    id: 3,
    image: '/assets/icons/card3.svg',
    builtinKey: 'card3',
    title: 'Presentaciones académico - aplicadas',
    description:
      'Espacios para explicar, analizar y sistematizar experiencias reales vinculadas con la Educación Técnica Superior. Pueden incluir experiencias de enseñanza, prácticas profesionalizantes, investigaciones situadas, sistematizaciones, análisis de casos y modelos de gestión o enseñanza, siempre vinculados con procesos institucionales concretos.',
    pdfUrl: '/PDF/3 Presentaciones académico-aplicadas.pdf',
    badge: 'Académico',
    activo: true,
    orden: 3,
  },
  {
    id: 4,
    image: '/assets/icons/card4.svg',
    builtinKey: 'card4',
    title: 'Proyectos y producciones de estudiantes',
    description:
      'Espacio de presentación de proyectos, producciones y desarrollos realizados por estudiantes en el marco de sus trayectorias formativas. Las presentaciones deberán permitir comprender el problema abordado, el proceso de trabajo, las decisiones tomadas, las evidencias producidas y los aprendizajes construidos, con acompañamiento institucional.',
    pdfUrl: '/PDF/4 Proyectos y producciones estudiantiles.pdf',
    badge: 'Estudiantil',
    activo: true,
    orden: 4,
  },
  {
    id: 5,
    image: '/assets/icons/card5.svg',
    builtinKey: 'card5',
    title: 'Talentos ETS',
    description:
      'Dispositivo de presentación breve de proyectos aplicados con preguntas y devolución formativa de un panel. Su finalidad es enriquecer los proyectos y fortalecer capacidades de comunicación, argumentación y mejora. No constituye una competencia: no hay ranking, ganadores, premiación, reclutamiento ni promesas de oportunidades posteriores.',
    pdfUrl: '/PDF/5 Talentos ETS.pdf',
    badge: 'Pitch / Panel',
    activo: true,
    orden: 5,
  },
];

/**
 * Obtiene las tarjetas de la base de datos o retorna las predeterminadas oficiales
 */
export async function getFrontendCardsFromDb(): Promise<FrontendCard[]> {
  try {
    const res = await query(
      `SELECT valor FROM configuraciones_sistema WHERE clave = 'frontend_cards_cms' LIMIT 1`
    );
    if (res.rows.length > 0 && res.rows[0].valor) {
      const parsed = typeof res.rows[0].valor === 'string' ? JSON.parse(res.rows[0].valor) : res.rows[0].valor;
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error leyendo frontend_cards_cms:', err);
  }
  return DEFAULT_FRONTEND_CARDS;
}

const router = Router();

/**
 * GET /api/admin/frontend-cms/cards
 * Listado completo de tarjetas para el editor CMS del Panel de Administración
 */
router.get('/cards', requireHierarchy(3), async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const cards = await getFrontendCardsFromDb();
    res.json({
      ok: true,
      cards: cards.sort((a, b) => (a.orden || 0) - (b.orden || 0)),
      total: cards.length,
      defaultCardsAvailable: DEFAULT_FRONTEND_CARDS.length,
    });
  } catch (error: any) {
    console.error('Error en GET /api/admin/frontend-cms/cards:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * PUT /api/admin/frontend-cms/cards
 * Guarda o actualiza la totalidad de las tarjetas en la base de datos central PostgreSQL
 */
router.put('/cards', requireHierarchy(4), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { cards } = req.body;
    if (!Array.isArray(cards)) {
      res.status(400).json({ ok: false, error: 'ERR_VALIDATION', message: 'Se espera un array de tarjetas en cards.' });
      return;
    }

    // Normalizar orden y campos
    const sanitizedCards: FrontendCard[] = cards.map((c, index) => ({
      id: c.id || index + 1,
      title: String(c.title || '').trim(),
      description: String(c.description || '').trim(),
      image: String(c.image || '/assets/icons/card1.svg').trim(),
      builtinKey: c.builtinKey || undefined,
      pdfUrl: c.pdfUrl ? String(c.pdfUrl).trim() : '',
      badge: c.badge ? String(c.badge).trim() : '',
      colorAccent: c.colorAccent || '#1D3343',
      activo: c.activo !== false,
      orden: typeof c.orden === 'number' ? c.orden : index + 1,
    }));

    await query(
      `INSERT INTO configuraciones_sistema (clave, valor, descripcion, categoria, actualizado_en)
       VALUES ('frontend_cards_cms', $1, 'Configuración y contenido dinámico de las tarjetas del portal público (CMS Frontend)', 'FRONTEND', NOW())
       ON CONFLICT (clave) DO UPDATE
       SET valor = $1, actualizado_en = NOW()`,
      [JSON.stringify(sanitizedCards)]
    );

    // Registro en auditoría
    await query(
      `INSERT INTO logs_auditoria (tabla_afectada, accion, usuario_responsable, datos_nuevos)
       VALUES ('configuraciones_sistema', 'FRONTEND_CARDS_CMS_UPDATE', $1, $2)`,
      [req.operator?.email || 'ADMIN', JSON.stringify({ total: sanitizedCards.length })]
    ).catch(() => {});

    res.json({
      ok: true,
      mensaje: 'Tarjetas del frontend actualizadas correctamente en la base de datos.',
      cards: sanitizedCards.sort((a, b) => a.orden - b.orden),
    });
  } catch (error: any) {
    console.error('Error en PUT /api/admin/frontend-cms/cards:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * POST /api/admin/frontend-cms/cards/reset
 * Restablece las tarjetas a los valores oficiales predeterminados del congreso
 */
router.post('/cards/reset', requireHierarchy(4), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    await query(
      `INSERT INTO configuraciones_sistema (clave, valor, descripcion, categoria, actualizado_en)
       VALUES ('frontend_cards_cms', $1, 'Configuración y contenido dinámico de las tarjetas del portal público (CMS Frontend)', 'FRONTEND', NOW())
       ON CONFLICT (clave) DO UPDATE
       SET valor = $1, actualizado_en = NOW()`,
      [JSON.stringify(DEFAULT_FRONTEND_CARDS)]
    );

    await query(
      `INSERT INTO logs_auditoria (tabla_afectada, accion, usuario_responsable, datos_nuevos)
       VALUES ('configuraciones_sistema', 'FRONTEND_CARDS_CMS_RESET', $1, $2)`,
      [req.operator?.email || 'ADMIN', JSON.stringify({ reset: true })]
    ).catch(() => {});

    res.json({
      ok: true,
      mensaje: 'Tarjetas restablecidas exitosamente a los valores oficiales predeterminados.',
      cards: DEFAULT_FRONTEND_CARDS,
    });
  } catch (error: any) {
    console.error('Error en POST /api/admin/frontend-cms/cards/reset:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

/**
 * POST /api/admin/frontend-cms/upload
 * Permite subir un ícono, imagen o PDF directamente para las tarjetas
 */
router.post('/upload', requireHierarchy(3), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { filename, fileBase64 } = req.body;
    if (!filename || !fileBase64) {
      res.status(400).json({ ok: false, error: 'ERR_VALIDATION', message: 'Se requiere filename y fileBase64.' });
      return;
    }

    // Limpieza del nombre de archivo
    const ext = path.extname(filename).toLowerCase();
    const allowedExts = ['.svg', '.png', '.jpg', '.jpeg', '.webp', '.pdf'];
    if (!allowedExts.includes(ext)) {
      res.status(400).json({
        ok: false,
        error: 'ERR_INVALID_FILE_TYPE',
        message: `Extensión no permitida. Formatos válidos: ${allowedExts.join(', ')}`,
      });
      return;
    }

    // Extraer base64 puro
    const base64Data = fileBase64.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Directorio de destino: frontend/public/uploads/
    const uploadsDir = path.resolve(__dirname, '../../../../frontend/public/uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const cleanBaseName = path.basename(filename, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const finalFilename = `${cleanBaseName}_${Date.now()}${ext}`;
    const targetFilePath = path.join(uploadsDir, finalFilename);

    await fs.promises.writeFile(targetFilePath, buffer);

    const publicUrl = `/uploads/${finalFilename}`;
    res.json({
      ok: true,
      mensaje: 'Archivo subido exitosamente.',
      url: publicUrl,
      filename: finalFilename,
      sizeBytes: buffer.length,
    });
  } catch (error: any) {
    console.error('Error en POST /api/admin/frontend-cms/upload:', error);
    res.status(500).json({ ok: false, error: 'ERR_UPLOAD', message: error.message });
  }
});

export default router;
