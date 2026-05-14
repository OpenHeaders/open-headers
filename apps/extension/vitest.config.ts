import * as path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Mirror the vite build's compile-time constants so transitive imports
  // (e.g. settings schema → build-info → __BUILD_INFO__) don't blow up
  // in tests that never touch the About surface directly.
  define: {
    __APP_VERSION__: JSON.stringify('0.0.0-test'),
    __BUILD_INFO__: JSON.stringify({
      version: '0.0.0-test',
      commit: 'test',
      commitFull: 'test',
      build: 0,
      date: '1970-01-01T00:00:00Z',
      channel: 'stable',
    }),
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    typecheck: {
      enabled: true,
      tsconfig: './tsconfig.test.json',
      include: ['tests/**/*.test.{ts,tsx}'],
    },
    testTimeout: 10000,
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: [],
      reporter: ['text', 'text-summary', 'html'],
      reportsDirectory: 'coverage',
    },
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@utils': path.resolve(__dirname, 'src/utils'),
      '@context': path.resolve(__dirname, 'src/context'),
      '@hooks': path.resolve(__dirname, 'src/shared/hooks'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@assets': path.resolve(__dirname, 'src/assets'),
      '@styles': path.resolve(__dirname, 'src/assets/styles'),
    },
  },
});
