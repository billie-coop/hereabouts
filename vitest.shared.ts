import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 50000,
    // Pin the host timezone so the suite is deterministic on any machine. Tests
    // must not depend on this — construct dates with Date.UTC()/epoch millis,
    // never with local-time Date constructors.
    env: {
      TZ: 'UTC',
    },
    include: ['**/__tests__/**/*.test.ts'],
    // Benchmarks run only under `vitest bench` (root `yarn bench`), never in the test run.
    // Restrict to the TypeScript sources: `.scratch/` holds compiled copies from build:lint.
    benchmark: {
      include: ['__benchmarks__/**/*.bench.ts'],
    },
    environment: 'node',
    reporters: ['verbose'],
    coverage: {
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['__benchmarks__/**', 'tztool/**', 'scripts/**'],
      provider: 'istanbul',
    },
  },
});
