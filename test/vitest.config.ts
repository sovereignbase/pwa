import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  test: {
    include: ['test/unit/**/*.test.ts', 'test/integration/**/*.test.ts'],
    environment: 'node',
    fileParallelism: false,
    testTimeout: 30_000,
    coverage: {
      enabled: true,
      provider: 'v8',
      reportsDirectory: fileURLToPath(new URL('./coverage', import.meta.url)),
      include: ['src/**/*.ts'],
      exclude: ['src/types/**'],
      reporter: ['text', 'lcov'],
      reportOnFailure: true,
      thresholds: {
        lines: 100,
        branches: 100,
        functions: 100,
        statements: 100,
      },
    },
  },
})
