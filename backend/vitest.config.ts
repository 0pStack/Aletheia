import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      // index.ts only wires the server together and starts listening; the app it builds is tested.
      exclude: ['src/**/*.test.ts', 'src/index.ts'],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 80,
      },
    },
  },
})
