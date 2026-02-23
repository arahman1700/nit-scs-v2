import * as Sentry from '@sentry/react';

declare const __COMMIT_SHA__: string;

const dsn = import.meta.env.VITE_SENTRY_DSN;
const sha = typeof __COMMIT_SHA__ !== 'undefined' ? __COMMIT_SHA__ : 'dev';

if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: `nit-scs-v2@${sha}`,
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: import.meta.env.PROD ? 0.5 : 1.0,
    enabled: !!dsn,
  });
}

export { Sentry };
