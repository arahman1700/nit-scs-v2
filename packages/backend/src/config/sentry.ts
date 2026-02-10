import * as Sentry from '@sentry/node';

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.SENTRY_RELEASE || `nit-scs-v2@${process.env.npm_package_version || 'unknown'}`,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.3 : 1.0,
    enabled: !!dsn,
    beforeSend(event) {
      // Redact PII from error events
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
      }
      return event;
    },
  });
}

export { Sentry };
