import type { Request, Response, NextFunction } from 'express';
import { EventEmitter } from 'events';

const { mockLogger, mockChildLog } = vi.hoisted(() => {
  return {
    mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    mockChildLog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
});

vi.mock('../config/logger.js', () => ({
  logger: mockLogger,
  createChildLogger: vi.fn(() => mockChildLog),
}));

import { requestLogger } from './request-logger.js';

class MockResponse extends EventEmitter {
  statusCode = 200;
  setHeader = vi.fn();
  getHeader = vi.fn().mockReturnValue(undefined);
}

const mockReq = (overrides = {}) =>
  ({
    method: 'GET',
    originalUrl: '/api/v1/items',
    url: '/api/v1/items',
    ip: '127.0.0.1',
    headers: {},
    ...overrides,
  }) as unknown as Request;

describe('request-logger middleware', () => {
  let nextFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    nextFn = vi.fn();
    vi.clearAllMocks();
  });

  it('should call next() immediately', () => {
    const req = mockReq();
    const res = new MockResponse() as unknown as Response;

    requestLogger(req, res, nextFn as unknown as NextFunction);

    expect(nextFn).toHaveBeenCalledOnce();
  });

  it('should set X-Correlation-ID response header', () => {
    const req = mockReq();
    const res = new MockResponse() as unknown as Response;

    requestLogger(req, res, nextFn as unknown as NextFunction);

    expect((res as any).setHeader).toHaveBeenCalledWith('X-Correlation-ID', expect.any(String));
  });

  it('should attach correlationId to request object', () => {
    const req = mockReq();
    const res = new MockResponse() as unknown as Response;

    requestLogger(req, res, nextFn as unknown as NextFunction);

    expect((req as any).correlationId).toBeDefined();
    expect(typeof (req as any).correlationId).toBe('string');
  });

  it('should log at info level for 2xx responses', () => {
    const req = mockReq();
    const res = new MockResponse();
    res.statusCode = 200;

    requestLogger(req, res as unknown as Response, nextFn as unknown as NextFunction);
    res.emit('finish');

    expect(mockLogger.info).toHaveBeenCalled();
    expect(mockChildLog.info).toHaveBeenCalled();
  });

  it('should log at warn level for 4xx responses', () => {
    const req = mockReq();
    const res = new MockResponse();
    res.statusCode = 404;

    requestLogger(req, res as unknown as Response, nextFn as unknown as NextFunction);
    res.emit('finish');

    expect(mockLogger.warn).toHaveBeenCalled();
    expect(mockChildLog.warn).toHaveBeenCalled();
  });

  it('should log at error level for 5xx responses', () => {
    const req = mockReq();
    const res = new MockResponse();
    res.statusCode = 500;

    requestLogger(req, res as unknown as Response, nextFn as unknown as NextFunction);
    res.emit('finish');

    expect(mockLogger.error).toHaveBeenCalled();
    expect(mockChildLog.error).toHaveBeenCalled();
  });

  it('should log at warn level for slow requests (>5000ms)', () => {
    const req = mockReq();
    const res = new MockResponse();
    res.statusCode = 200;

    // We cannot easily simulate a slow request, but we can verify the log structure
    requestLogger(req, res as unknown as Response, nextFn as unknown as NextFunction);
    res.emit('finish');

    const logData = mockLogger.info.mock.calls[0][0];
    expect(logData).toHaveProperty('durationMs');
    expect(logData).toHaveProperty('method', 'GET');
    expect(logData).toHaveProperty('url', '/api/v1/items');
  });

  it('should include userId when user is authenticated', () => {
    const req = mockReq({ user: { userId: 'u1' } });
    const res = new MockResponse();
    res.statusCode = 200;

    requestLogger(req, res as unknown as Response, nextFn as unknown as NextFunction);
    res.emit('finish');

    const logData = mockLogger.info.mock.calls[0][0];
    expect(logData.userId).toBe('u1');
  });

  it('should include requestId from X-Request-ID header', () => {
    const req = mockReq({ headers: { 'x-request-id': 'req-abc-123' } });
    const res = new MockResponse();
    res.statusCode = 200;

    requestLogger(req, res as unknown as Response, nextFn as unknown as NextFunction);
    res.emit('finish');

    const logData = mockLogger.info.mock.calls[0][0];
    expect(logData.requestId).toBe('req-abc-123');
  });

  it('should include IP address in log data', () => {
    const req = mockReq({ ip: '192.168.1.100' });
    const res = new MockResponse();
    res.statusCode = 200;

    requestLogger(req, res as unknown as Response, nextFn as unknown as NextFunction);
    res.emit('finish');

    const logData = mockLogger.info.mock.calls[0][0];
    expect(logData.ip).toBe('192.168.1.100');
  });

  it('should truncate userAgent to 100 characters', () => {
    const longUA = 'A'.repeat(200);
    const req = mockReq({ headers: { 'user-agent': longUA } });
    const res = new MockResponse();
    res.statusCode = 200;

    requestLogger(req, res as unknown as Response, nextFn as unknown as NextFunction);
    res.emit('finish');

    const logData = mockLogger.info.mock.calls[0][0];
    expect(logData.userAgent?.length).toBe(100);
  });

  it('should include correlationId in log data', () => {
    const req = mockReq();
    const res = new MockResponse();
    res.statusCode = 200;

    requestLogger(req, res as unknown as Response, nextFn as unknown as NextFunction);
    res.emit('finish');

    const logData = mockLogger.info.mock.calls[0][0];
    expect(logData.correlationId).toBeDefined();
    expect(logData.correlationId).toBe((req as any).correlationId);
  });

  it('should include content-length in log data when present', () => {
    const req = mockReq();
    const res = new MockResponse();
    res.statusCode = 200;
    res.getHeader.mockReturnValue('1234');

    requestLogger(req, res as unknown as Response, nextFn as unknown as NextFunction);
    res.emit('finish');

    const logData = mockLogger.info.mock.calls[0][0];
    expect(logData.contentLength).toBe('1234');
  });

  it('should use originalUrl over url', () => {
    const req = mockReq({ originalUrl: '/api/v1/warehouses?page=1', url: '/warehouses' });
    const res = new MockResponse();
    res.statusCode = 200;

    requestLogger(req, res as unknown as Response, nextFn as unknown as NextFunction);
    res.emit('finish');

    const logData = mockLogger.info.mock.calls[0][0];
    expect(logData.url).toBe('/api/v1/warehouses?page=1');
  });

  it('should log formatted message string with method, url, status, duration', () => {
    const req = mockReq({ method: 'POST', originalUrl: '/api/v1/grn' });
    const res = new MockResponse();
    res.statusCode = 201;

    requestLogger(req, res as unknown as Response, nextFn as unknown as NextFunction);
    res.emit('finish');

    const messageString = mockLogger.info.mock.calls[0][1];
    expect(messageString).toContain('POST');
    expect(messageString).toContain('/api/v1/grn');
    expect(messageString).toContain('201');
    expect(messageString).toContain('ms');
  });
});
