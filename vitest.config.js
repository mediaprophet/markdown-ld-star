import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.ts', 'tests/**/*.mts'],
    exclude: ['node_modules', 'dist']
  }
});
