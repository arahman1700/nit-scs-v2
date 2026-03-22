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

import { logger } from './config/logger.js';
import { getCorsOptions } from './config/cors.js';
import { getEnv } from './config/env.js';
import { getRedis, disconnectRedis } from './config/redis.js';
import { requestId } from './middleware/request-id.js';
import { requestLogger } from './middleware/request-logger.js';
import { requestTimeout } from './middleware/request-timeout.js';
import { errorHandler } from './middleware/error-handler.js';
import { sanitizeInput } from './middleware/sanitize.js';
import { setupSocketIO } from './socket/setup.js';
import { shutdownQueues } from './infrastructure/queue/bullmq.config.js';
import { prisma } from './utils/prisma.js';
// rateLimiter is applied inside routes/index.ts (not here) to avoid double-counting
import { startRuleEngine } from './events/rule-engine.js';
import { startChainNotifications } from './events/chain-notification-handler.js';
import { startNotificationDispatcher } from './domains/notifications/services/notification-dispatcher.service.js';
import { startScheduler, stopScheduler } from './domains/scheduler/services/scheduler.service.js';
import { mountQueueDashboard } from './infrastructure/queue/queue-dashboard.js';
import {
  registerDynamicDataSources,
  register as registerDataSource,
} from './domains/reporting/services/widget-data.service.js';
import { loadCustomDataSources } from './domains/reporting/services/custom-data-source.service.js';
import { healthCheck } from './domains/system/routes/health.routes.js';
import apiRoutes from './routes/index.js';

// ── Bootstrap ───────────────────────────────────────────────────────────────
dotenv.config({ path: '../../.env' });
const env = getEnv(); // Validate environment on startup (throws in production if vars missing)

const app = express();
const httpServer = createServer(app);
const corsOptions = getCorsOptions();
const io = new SocketIOServer(httpServer, { cors: corsOptions });

// ── Trust proxy (needed for correct IP behind reverse proxy / Render) ─────
app.set('trust proxy', 1);

// ── Global Middleware ─────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'", 'wss:', 'ws:'],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }),
);
app.use(cors(corsOptions));
const jsonParser = express.json({ limit: env.BODY_SIZE_LIMIT });
app.use((req, res, next) => {
  // Keep raw body intact for signed webhooks (Svix/Resend).
  const isResendWebhook =
    req.method === 'POST' && (req.path === '/api/v1/webhooks/resend' || req.path === '/api/webhooks/resend');
  if (isResendWebhook) {
    next();
    return;
  }
  jsonParser(req, res, next);
});
app.use(compression());
app.use(cookieParser());
app.use(sanitizeInput());
app.use(requestId);
// Structured request logging (replaces morgan in production, used alongside in dev)
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}
app.use(requestLogger);
app.use(requestTimeout);

// ── API Routes (versioned) ────────────────────────────────────────────────
// Swagger UI is mounted inside the API router at /api/v1/api-docs
// Rate limiter is applied inside apiRoutes (routes/index.ts) — not here,
// to avoid double-counting each request against the same Redis key.
app.use('/api/v1', apiRoutes);

// Backward-compatible redirect: /api/* → /api/v1/*
app.use('/api', (req, res, next) => {
  // Health check shortcut (no redirect needed)
  if (req.path === '/health') {
    healthCheck(req, res);
    return;
  }
  // Only redirect non-versioned paths to avoid double /v1/
  if (!req.path.startsWith('/v1')) {
    res.redirect(302, `/api/v1${req.url}`);
    return;
  }
  next();
});

// ── Socket.IO ─────────────────────────────────────────────────────────────
setupSocketIO(io);
app.set('io', io); // Accessible via req.app.get('io')

// ── Queue Dashboard (admin only, disabled in production unless QUEUE_DASHBOARD=true) ──
if (process.env.NODE_ENV !== 'production' || process.env.QUEUE_DASHBOARD === 'true') {
  mountQueueDashboard(app);
}

// ── Sentry Error Handler (captures errors before our handler) ─────────────
if (Sentry.isInitialized()) {
  Sentry.setupExpressErrorHandler(app);
}

// ── In-Flight Request Tracking (for graceful shutdown draining) ──────────
let inFlightRequests = 0;
let isShuttingDown = false;

app.use((_req, res, next) => {
  if (isShuttingDown) {
    res.set('Connection', 'close');
    res.status(503).json({ error: 'Server is shutting down' });
    return;
  }
  inFlightRequests++;
  res.on('finish', () => {
    inFlightRequests--;
  });
  next();
});

// ── Error Handler (must be last middleware) ────────────────────────────────
app.use(errorHandler);

// ── Production: Serve Frontend SPA ────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const frontendDist = join(currentDir, '../../frontend/dist');

  // Hashed assets (JS/CSS/fonts/images) — long-lived immutable cache
  app.use(
    '/assets',
    express.static(join(frontendDist, 'assets'), {
      maxAge: '1y',
      immutable: true,
    }),
  );

  // All other static files (non-hashed) — short cache with revalidation
  app.use(express.static(frontendDist));

  // SPA fallback — HTML must never be cached
  app.get('{*path}', (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile('index.html', { root: frontendDist });
  });
}

// ── Initialise Redis (non-blocking) ───────────────────────────────────────
getRedis(); // Starts connection attempt; failures are non-fatal in dev

// ── Start Server ──────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '4000', 10);

httpServer.listen(PORT, () => {
  logger.info({ port: PORT, env: process.env.NODE_ENV || 'development' }, 'NIT-SCS Backend started');

  // Eagerly connect Prisma at startup — fail fast if DB is unreachable
  prisma.$connect()
    .then(() => logger.info('Prisma connected to database'))
    .catch((err: unknown) => {
      logger.error({ err }, 'Failed to connect to database -- exiting');
      process.exit(1);
    });

  startRuleEngine();
  startChainNotifications();
  startNotificationDispatcher();
  startScheduler(io).catch(err => logger.error({ err }, 'Failed to start scheduler'));
  registerDynamicDataSources().catch(err => logger.error({ err }, 'Failed to register dynamic data sources'));
  loadCustomDataSources(registerDataSource as (key: string, fn: (config: unknown) => Promise<unknown>) => void).catch(
    err => logger.error({ err }, 'Failed to load custom data sources'),
  );

  // ── AI Module (optional — behind AI_ENABLED flag) ──────────────
  if (process.env.AI_ENABLED === 'true') {
    import('./domains/ai-services/ai-module.js')
      .then(({ initAiModule }) => initAiModule(app))
      .catch(err => logger.error({ err }, 'Failed to initialize AI module'));
  }
});

// ── Graceful Shutdown ─────────────────────────────────────────────────────
async function shutdown(signal: string) {
  if (isShuttingDown) return; // Prevent double-shutdown
  isShuttingDown = true;
  logger.info({ signal, inFlightRequests }, 'Shutdown initiated — draining in-flight requests...');

  stopScheduler();
  io.close();

  // Drain BullMQ workers before draining HTTP (finish current jobs)
  await shutdownQueues();

  // Wait for in-flight requests to finish (configurable, default 15s)
  const drainStart = Date.now();
  while (inFlightRequests > 0 && Date.now() - drainStart < env.SHUTDOWN_TIMEOUT_MS) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (inFlightRequests > 0) {
    logger.warn({ remaining: inFlightRequests }, 'Drain timeout — closing with in-flight requests');
  }

  httpServer.close(async () => {
    logger.info('HTTP server closed');
    try {
      await disconnectRedis();
      await prisma.$disconnect();
      logger.info('All connections closed');
    } catch (err) {
      logger.error({ err }, 'Error during shutdown');
    }
    process.exit(0);
  });

  // Force exit if graceful shutdown hangs (SHUTDOWN_TIMEOUT_MS + 5s buffer)
  setTimeout(() => process.exit(1), env.SHUTDOWN_TIMEOUT_MS + 5000);
}

// ── Unhandled errors — log + report to Sentry, then exit ─────────────────
process.on('unhandledRejection', reason => {
  logger.error({ err: reason }, 'Unhandled promise rejection');
  if (Sentry.isInitialized()) Sentry.captureException(reason);
});
process.on('uncaughtException', err => {
  logger.error({ err }, 'Uncaught exception — shutting down');
  if (Sentry.isInitialized()) Sentry.captureException(err);
  process.exit(1);
});

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export { app, io, httpServer };
