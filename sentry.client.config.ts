import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Capture 10% of sessions for performance monitoring (adjust up when needed)
  tracesSampleRate: 0.1,
  // Capture replays only when an error occurs
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.05,

  // Suppress noisy browser errors that are not actionable
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'Non-Error promise rejection captured',
    'Network request failed',
    'Load failed',
  ],
});
