import * as Sentry from '@sentry/node';

const dsn = process.env.SENTRY_DSN;
const commitSha = process.env.RENDER_GIT_COMMIT || process.env.COMMIT_SHA || '';
const release = process.env.SENTRY_RELEASE || (commitSha ? `nit-scs-v2@${commitSha.slice(0, 7)}` : 'nit-scs-v2@dev');

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    release,
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
