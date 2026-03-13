// ---------------------------------------------------------------------------
// Prometheus HTTP Metrics Middleware
// ---------------------------------------------------------------------------
// Records request duration and total count per method/route/status_code.
// Applied globally before domain routes to capture all API traffic.
// ---------------------------------------------------------------------------

import type { Request, Response, NextFunction } from 'express';
import { httpRequestDuration, httpRequestsTotal } from '../infrastructure/metrics/prometheus.js';

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const end = httpRequestDuration.startTimer();

  res.on('finish', () => {
    const route = req.route?.path || req.baseUrl || req.path;
    const labels = { method: req.method, route, status_code: String(res.statusCode) };
    end(labels);
    httpRequestsTotal.inc(labels);
  });

  next();
}
