// vitest.config.ts
// Source: 01-01-PLAN.md Task 2 + RESEARCH.md Standard Stack.
// Phase 1 tests live at tests/**/*.test.{ts,tsx}. The @/ alias mirrors tsconfig.
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node', // component tests can override via // @vitest-environment jsdom
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['./tests/setup.ts'], // Plan 03-03 Task 0: jest-dom matchers for jsdom tests
    globals: false,
    // TODO(REVIEW IN-06): revisit when vitest > 4.1.5 — the upstream default pool
    // was broken on Node 25.x at the time vitest 4.1.5 shipped; vmThreads works
    // on Node 22/24/25. Drop this override once the default is fixed.
    pool: 'vmThreads',
  },
});
