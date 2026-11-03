import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/*', 'apps/*'],
    reporters: ['verbose'],
    coverage: {
      reporter: ['text', 'html'],
      include: ['packages/hereabouts/src/**/*.ts'],
      exclude: ['packages/hereabouts/src/types/**'],
      provider: 'istanbul',
    },
  },
});
