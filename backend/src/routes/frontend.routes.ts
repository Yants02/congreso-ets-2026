import { Router, Request, Response } from 'express';
import { getFrontendCardsFromDb } from './admin/frontend-cms.routes';

const router = Router();

/**
 * GET /api/frontend/cards
 * Endpoint público consumido por el portal web principal para renderizar las tarjetas de modalidades
 */
router.get('/cards', async (_req: Request, res: Response): Promise<void> => {
  try {
    const cards = await getFrontendCardsFromDb();
    // En el portal público solo enviamos las tarjetas marcadas como activas
    const activeCards = cards
      .filter((c) => c.activo !== false)
      .sort((a, b) => (a.orden || 0) - (b.orden || 0));

    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
    res.json({
      ok: true,
      cards: activeCards,
      total: activeCards.length,
    });
  } catch (error: any) {
    console.error('Error en GET /api/frontend/cards:', error);
    res.status(500).json({ ok: false, error: 'ERR_DATABASE', message: error.message });
  }
});

export default router;
