import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

dotenv.config();

// Middlewares
import { authenticateOperator } from './middlewares/authMiddleware';
import { journalingMiddleware } from './middlewares/journalingMiddleware';

// Rutas
import authRoutes from './routes/auth.routes';
import registroRoutes from './routes/registro.routes';
import vacantesRoutes from './routes/vacantes.routes';
import credencialRoutes from './routes/credencial.routes';
import identificacionRoutes from './routes/identificacion.routes';
import actividadesRoutes from './routes/actividades.routes';
import operatorRoutes from './routes/operator.routes';
import certificadosRoutes from './routes/certificados.routes';
import materialesRoutes from './routes/materiales.routes';
import adminRoutes from './routes/admin.routes';
import usuarioRoutes from './routes/usuario.routes';
import encuestasRoutes from './routes/encuestas.routes';
import pushRoutes from './routes/push.routes';
import frontendRoutes from './routes/frontend.routes';

const app = express();
const PORT = process.env.PORT || 4000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

// Deshabilitar huella de Express
app.disable('x-powered-by');

// Cabeceras HTTP de Seguridad recomendadas para BFF y API Rest
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Configuración CORS
app.use(
  cors({
    origin: (origin, callback) => {
      // Permitir peticiones sin origen (curl, health checks, proxy BFF) o desde localhost / Railway
      if (
        !origin ||
        origin.includes('localhost') ||
        origin.includes('127.0.0.1') ||
        origin.includes('railway.app') ||
        origin.includes('railway.internal') ||
        origin === CORS_ORIGIN
      ) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-operator-jerarquia'],
  })
);

// Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Inyección de contexto de sesión
app.use(authenticateOperator);

// Journaling y Diagnóstico de Peticiones y Errores
app.use(journalingMiddleware);

// Endpoints de diagnóstico profundo (Health-Check & Smoke Test)
const healthHandler = async (_req: Request, res: Response) => {
  let dbOk = false;
  let dbLatencyMs = -1;
  const startDb = Date.now();

  try {
    const { pool } = await import('./lib/db');
    const result = await pool.query('SELECT 1 as ping, NOW() as server_time');
    if (result && result.rows && result.rows.length > 0) {
      dbOk = true;
      dbLatencyMs = Date.now() - startDb;
    }
  } catch (err: any) {
    dbOk = false;
  }

  const isHealthy = dbOk;
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'UP' : 'DEGRADED',
    platform: 'Congreso ETS 2026 Backend',
    database: {
      connected: dbOk,
      latencyMs: dbLatencyMs,
    },
    uptimeSeconds: Math.floor(process.uptime()),
    memoryUsageMb: Math.round(process.memoryUsage().rss / (1024 * 1024)),
    timestamp: new Date().toISOString(),
  });
};

app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

// Registro de endpoints de API
app.use('/api/admin/auth', authRoutes);
app.use('/api/registro', registroRoutes);
app.use('/api/vacantes', vacantesRoutes);
app.use('/api/credencial', credencialRoutes);
app.use('/api/identificacion', identificacionRoutes);
app.use('/api/actividades', actividadesRoutes);
app.use('/api/operator', operatorRoutes);
app.use('/api/certificados', certificadosRoutes);
app.use('/api/materiales', materialesRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/usuario', usuarioRoutes);
app.use('/api/encuestas', encuestasRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/frontend', frontendRoutes);

// Manejador 404
app.use((req: Request, res: Response) => {
  res.status(404).json({
    ok: false,
    error: 'ERR_ENDPOINT_NOT_FOUND',
    message: `Ruta ${req.method} ${req.originalUrl} no encontrada.`,
  });
});

// Manejador global de errores
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error no controlado en el servidor:', err);
  res.status(500).json({
    ok: false,
    error: 'ERR_INTERNAL_SERVER',
    message: err.message || 'Ocurrió un error inesperado en el servidor.',
  });
});

// Inicialización
if (process.env.NODE_ENV !== 'test') {
  const server = app.listen(Number(PORT), '0.0.0.0', async () => {
    console.log(`====================================================`);
    console.log(`🚀 Servidor Backend Congreso ETS 2026 en ejecución`);
    console.log(`📡 URL Base: http://0.0.0.0:${PORT}`);
    console.log(`🌐 CORS permitido para: ${CORS_ORIGIN}`);
    console.log(`🔒 Criptografía: AES-256-CBC activa`);
    console.log(`====================================================`);

    // Iniciar el planificador en segundo plano (Cron autónomo)
    try {
      const { startCronScheduler } = await import('./lib/cronScheduler');
      startCronScheduler();
    } catch (cronErr) {
      console.error('Error al inicializar cron scheduler:', cronErr);
    }
  });

  const gracefulShutdown = async (signal: string) => {
    console.log(`\n🛑 Recibida señal ${signal}. Deteniendo servidor y cron de forma ordenada...`);
    try {
      const { stopCronScheduler } = await import('./lib/cronScheduler');
      stopCronScheduler();
    } catch (_) {}

    server.close(() => {
      console.log('✅ Servidor HTTP cerrado limpiamente.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

export default app;
