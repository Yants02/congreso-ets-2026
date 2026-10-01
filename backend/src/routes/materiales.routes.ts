import { Router, Request, Response } from 'express';

const router = Router();

interface MaterialItem {
  id: string;
  type: 'novedad' | 'documento' | 'video' | 'flyer' | 'foto' | 'recurso';
  date: string;
  title: string;
  description: string;
  fileUrl?: string;
  videoUrl?: string;
  images?: string[];
}

const defaultMaterials: MaterialItem[] = [
  {
    id: '1',
    type: 'novedad',
    date: '11 sep 2026',
    title: 'Novedades del Congreso ETS 2026',
    description: 'En este espacio se publicarán las novedades relacionadas con el Congreso de Educación Técnica Superior.',
  },
  {
    id: '2',
    type: 'documento',
    date: '10 sep 2026',
    title: 'Documento general de participación',
    description: 'Información orientativa para participar del 1er Congreso de Educación Técnica Superior.',
    fileUrl: '/documentos/participacion.pdf',
  },
  {
    id: '3',
    type: 'video',
    date: '9 sep 2026',
    title: 'Conocé el Congreso ETS 2026',
    description: 'Contenido audiovisual institucional relacionado con el Congreso.',
    videoUrl: 'https://www.youtube.com/',
  },
  {
    id: '4',
    type: 'flyer',
    date: '8 sep 2026',
    title: 'Flyer oficial del Congreso',
    description: 'Pieza gráfica institucional del Congreso de Educación Técnica Superior.',
  },
  {
    id: '5',
    type: 'foto',
    date: '7 sep 2026',
    title: 'Fotografías del Congreso',
    description: 'Registro fotográfico de las actividades del Congreso de Educación Técnica Superior.',
    images: [],
  },
  {
    id: '6',
    type: 'recurso',
    date: '6 sep 2026',
    title: 'Plantillas de Presentación Institucional',
    description: 'Guía y diapositivas oficiales para expositores y disertantes.',
    fileUrl: '/documentos/plantilla_presentacion.pptx',
  },
];

/**
 * GET /api/materiales
 * Entrega los recursos y novedades institucionales para el frontend
 */
router.get('/', (_req: Request, res: Response): void => {
  res.json({
    success: true,
    total: defaultMaterials.length,
    materiales: defaultMaterials,
  });
});

export default router;
