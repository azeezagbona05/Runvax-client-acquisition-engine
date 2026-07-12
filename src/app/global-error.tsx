'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body className="bg-gray-950 text-white min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold mb-3">Something went wrong</h1>
          <p className="text-gray-400 text-sm mb-6">
            An unexpected error occurred. It has been reported automatically — try again, or head back home.
          </p>
          <button
            onClick={reset}
            className="bg-gradient-to-r from-purple-600 to-orange-500 text-white font-semibold px-5 py-2.5 rounded-lg text-sm"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
