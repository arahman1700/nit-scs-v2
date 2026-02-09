import pino from 'pino';

// ---------------------------------------------------------------------------
// Structured Logger
// ---------------------------------------------------------------------------
// Production: JSON output (for log aggregation — Datadog, ELK, CloudWatch)
// Development: Pretty-printed with colors
// ---------------------------------------------------------------------------

const isDev = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),

  // Consistent base fields in every log line
  base: {
    service: 'nit-scs-api',
    env: process.env.NODE_ENV || 'development',
  },

  // Timestamp in ISO format for log aggregation
  timestamp: pino.stdTimeFunctions.isoTime,

  // Serializers for structured error objects
  serializers: {
    err: pino.stdSerializers.err,
    req: req => ({
      method: req.method,
      url: req.url,
      requestId: req.headers?.['x-request-id'],
    }),
    res: res => ({
      statusCode: res.statusCode,
    }),
  },

  // Pretty-print only in development
  transport: isDev ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } } : undefined,
});

/** Backwards-compatible log function for existing callsites */
export function log(level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: unknown) {
  if (data) {
    logger[level]({ data }, message);
  } else {
    logger[level](message);
  }
}

/**
 * Create a child logger with additional context fields.
 * Useful for request-scoped or service-scoped logging.
 */
export function createChildLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}
