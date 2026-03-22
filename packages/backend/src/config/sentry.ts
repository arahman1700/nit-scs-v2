import * as Sentry from '@sentry/node';
import { getCorrelationId } from '../middleware/request-context.js';

const dsn = process.env.SENTRY_DSN;
const commitSha = process.env.RENDER_GIT_COMMIT || process.env.COMMIT_SHA || '';
const release = process.env.SENTRY_RELEASE || (commitSha ? `nit-scs-v2@${commitSha.slice(0, 7)}` : 'nit-scs-v2@dev');

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    release,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    enabled: !!dsn,
    integrations: [Sentry.prismaIntegration()],
    beforeSend(event) {
      // Attach correlationId from AsyncLocalStorage for cross-service tracing
      const correlationId = getCorrelationId();
      if (correlationId) {
        event.tags = { ...event.tags, correlationId };
      }

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
