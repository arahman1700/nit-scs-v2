import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requestContext, getCorrelationId, getRequestContext } from './request-context.js';
import type { Request, Response, NextFunction } from 'express';

// Also verify the new Prometheus metrics are registered
import { register } from '../infrastructure/metrics/prometheus.js';

function mockReq(headers: Record<string, string> = {}): Request {
  return { headers } as unknown as Request;
}

function mockRes(): Response & { _headers: Record<string, string> } {
  const headers: Record<string, string> = {};
  return {
    _headers: headers,
    setHeader: vi.fn((key: string, value: string) => {
      headers[key] = value;
    }),
  } as unknown as Response & { _headers: Record<string, string> };
}

describe('request-context middleware', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns undefined for getCorrelationId when called outside AsyncLocalStorage scope', () => {
    expect(getCorrelationId()).toBeUndefined();
  });

  it('sets correlationId in AsyncLocalStorage accessible via getCorrelationId inside the run scope', async () => {
    const req = mockReq({ 'x-request-id': 'req-123' });
    const res = mockRes();
    let capturedCorrelationId: string | undefined;

    await new Promise<void>(resolve => {
      const next: NextFunction = () => {
        capturedCorrelationId = getCorrelationId();
        resolve();
      };
      requestContext(req, res, next);
    });

    expect(capturedCorrelationId).toBeDefined();
    expect(capturedCorrelationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('sets X-Correlation-ID response header', async () => {
    const req = mockReq();
    const res = mockRes();

    await new Promise<void>(resolve => {
      const next: NextFunction = () => resolve();
      requestContext(req, res, next);
    });

    expect(res.setHeader).toHaveBeenCalledWith('X-Correlation-ID', expect.any(String));
    expect(res._headers['X-Correlation-ID']).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('getRequestContext returns full store with correlationId and requestId', async () => {
    const req = mockReq({ 'x-request-id': 'req-456' });
    const res = mockRes();
    let capturedContext: ReturnType<typeof getRequestContext>;

    await new Promise<void>(resolve => {
      const next: NextFunction = () => {
        capturedContext = getRequestContext();
        resolve();
      };
      requestContext(req, res, next);
    });

    expect(capturedContext).toBeDefined();
    expect(capturedContext!.correlationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(capturedContext!.requestId).toBe('req-456');
  });

  it('prisma_transaction_duration_seconds histogram exists in Prometheus registry', async () => {
    const metric = await register.getSingleMetricAsString('prisma_transaction_duration_seconds');
    expect(metric).toContain('prisma_transaction_duration_seconds');
  });

  it('optimistic_lock_retries_total counter exists in Prometheus registry', async () => {
    const metric = await register.getSingleMetricAsString('optimistic_lock_retries_total');
    expect(metric).toContain('optimistic_lock_retries_total');
  });
});
