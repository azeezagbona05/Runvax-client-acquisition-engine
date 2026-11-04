import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Integration suite: real Prisma against a DISPOSABLE local MySQL only
// (see tests/integration/setup.ts). Run with:
//   TEST_DATABASE_URL=mysql://root@127.0.0.1:3399/runvax_ia_rehearsal npm run test:integration
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    setupFiles: ['tests/integration/setup.ts'],
    restoreMocks: true,
    fileParallelism: false,
    testTimeout: 60_000,
  },
});
