import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup-environment-proxy.ts'],
    passWithNoTests: true,
  },
});
