// ---------------------------------------------------------------------------
// Prometheus Metrics — prom-client Registry & Collectors
// ---------------------------------------------------------------------------
// Central metrics registry with HTTP, DB, EventBus, BullMQ, and cache counters.
// Default Node.js metrics (GC, event loop, memory) are collected automatically.
// ---------------------------------------------------------------------------

import { Registry, Counter, Histogram, collectDefaultMetrics } from 'prom-client';

export const register = new Registry();
collectDefaultMetrics({ register });

// ── HTTP Metrics ────────────────────────────────────────────────────────────

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

// ── Database Metrics ────────────────────────────────────────────────────────

export const dbQueryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries',
  labelNames: ['model', 'operation'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [register],
});

// ── EventBus Metrics ────────────────────────────────────────────────────────

export const eventBusEventsTotal = new Counter({
  name: 'eventbus_events_total',
  help: 'Total EventBus events',
  labelNames: ['event_type'],
  registers: [register],
});

// ── BullMQ Metrics ──────────────────────────────────────────────────────────

export const bullmqJobsTotal = new Counter({
  name: 'bullmq_jobs_total',
  help: 'Total BullMQ jobs',
  labelNames: ['queue', 'status'],
  registers: [register],
});

// ── Cache Metrics ───────────────────────────────────────────────────────────

export const cacheOpsTotal = new Counter({
  name: 'cache_ops_total',
  help: 'Cache operations',
  labelNames: ['operation'],
  registers: [register],
});
