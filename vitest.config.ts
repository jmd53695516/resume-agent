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
    globals: false,
  },
});
