import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  // Component tests (tests/ui/*.test.tsx): tsconfig says jsx "preserve" (Next
  // compiles JSX itself), so tell Vite 8's oxc transformer to compile it with
  // React 18's automatic runtime for tests.
  oxc: { jsx: { runtime: 'automatic', importSource: 'react' } },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
    exclude: ['tests/integration/**', 'node_modules/**'],
    setupFiles: ['tests/setup.ts'],
    restoreMocks: true,
  },
});
