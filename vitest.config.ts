/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', '**/dist/**'],
    coverage: {
      provider: 'v8',
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
      },
      include: ['src/lib/**/*.ts'],
      exclude: ['src/lib/types.ts', '*.test.ts'],
      reporter: ['text', 'html', 'json'],
    },
  },
});
