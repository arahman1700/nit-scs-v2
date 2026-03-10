import { defineConfig } from 'vitest/config';
import os from 'os';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
    pool: 'forks',
    poolOptions: {
      forks: {
        // Cap concurrent forks to 50% of CPU cores to prevent resource exhaustion
        // when running alongside frontend/shared in `pnpm -r run test`.
        // Each fork creates an Express app + supertest server — too many concurrent
        // servers cause "socket hang up" and route resolution failures.
        maxForks: Math.max(2, Math.floor(os.cpus().length / 2)),
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: [
        'node_modules/',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.spec.ts',
        '**/test-setup.*',
        '**/test-app.*',
        '**/prisma-mock.*',
        '**/msw-*',
      ],
      thresholds: {
        lines: 60,
        functions: 55,
        branches: 50,
        statements: 60,
      },
    },
  },
});
