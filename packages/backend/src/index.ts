// Sentry must be imported before all other modules to properly instrument them
import { Sentry } from './config/sentry.js';

import express from 'express';
import compression from 'compression';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import swaggerUi from 'swagger-ui-express';

import { logger } from './config/logger.js';
import { getCorsOptions } from './config/cors.js';
import { getEnv } from './config/env.js';
import { getRedis, disconnectRedis } from './config/redis.js';
import { swaggerSpec } from './config/swagger.js';
import { requestId } from './middleware/request-id.js';
import { requestLogger } from './middleware/request-logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { sanitizeInput } from './middleware/sanitize.js';
import { setupSocketIO } from './socket/setup.js';
import { startRuleEngine } from './events/rule-engine.js';
import { startScheduler, stopScheduler } from './services/scheduler.service.js';
import apiRoutes from './routes/index.js';
import { healthCheck } from './routes/health.routes.js';

// ── Bootstrap ───────────────────────────────────────────────────────────────
dotenv.config({ path: '../../.env' });
getEnv(); // Validate environment on startup (throws in production if vars missing)

const app = express();
const httpServer = createServer(app);
const corsOptions = getCorsOptions();
const io = new SocketIOServer(httpServer, { cors: corsOptions });

// ── Trust proxy (needed for correct IP behind reverse proxy / Render) ─────
app.set('trust proxy', 1);

// ── Global Middleware ─────────────────────────────────────────────────────
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: '2mb' }));
app.use(compression());
app.use(cookieParser());
app.use(sanitizeInput());
app.use(requestId);
// Structured request logging (replaces morgan in production, used alongside in dev)
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}
app.use(requestLogger);

// ── Swagger / OpenAPI Docs ─────────────────────────────────────────────────
app.use(
  '/api/docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'NIT SCS API Docs',
  }),
);
app.get('/api/docs.json', (_req, res) => {
  res.json(swaggerSpec);
});

// ── API Routes (versioned) ────────────────────────────────────────────────
app.use('/api/v1', apiRoutes);

// Backward-compatible redirect: /api/* → /api/v1/*
app.use('/api', (req, res, _next) => {
  // Health check shortcut (no redirect needed)
  if (req.path === '/health') {
    healthCheck(req, res);
    return;
  }
  res.redirect(302, `/api/v1${req.url}`);
});

// ── Socket.IO ─────────────────────────────────────────────────────────────
setupSocketIO(io);
app.set('io', io); // Accessible via req.app.get('io')

// ── Sentry Error Handler (captures errors before our handler) ─────────────
if (Sentry.isInitialized()) {
  Sentry.setupExpressErrorHandler(app);
}

// ── Error Handler (must be last middleware) ────────────────────────────────
app.use(errorHandler);

// ── Production: Serve Frontend SPA ────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const frontendDist = join(currentDir, '../../frontend/dist');
  app.use(express.static(frontendDist));
  app.get('{*path}', (_req, res) => {
    res.sendFile('index.html', { root: frontendDist });
  });
}

// ── Initialise Redis (non-blocking) ───────────────────────────────────────
getRedis(); // Starts connection attempt; failures are non-fatal in dev

// ── Start Server ──────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '4000', 10);

httpServer.listen(PORT, () => {
  logger.info({ port: PORT, env: process.env.NODE_ENV || 'development' }, 'NIT-SCS Backend started');
  startRuleEngine();
  startScheduler(io);
});

// ── Graceful Shutdown ─────────────────────────────────────────────────────
async function shutdown(signal: string) {
  logger.info(`${signal} received — shutting down gracefully...`);

  stopScheduler();
  io.close();
  httpServer.close(async () => {
    logger.info('HTTP server closed');
    try {
      await disconnectRedis();
      const { prisma } = await import('./utils/prisma.js');
      await prisma.$disconnect();
      logger.info('All connections closed');
    } catch (err) {
      logger.error({ err }, 'Error during shutdown');
    }
    process.exit(0);
  });

  // Force exit after 10 s if graceful shutdown hangs
  setTimeout(() => process.exit(1), 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export { app, io, httpServer };
