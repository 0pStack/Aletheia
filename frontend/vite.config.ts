import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_TARGET || 'http://localhost:3001'

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': { target: apiTarget, changeOrigin: true },
        '/ws': { target: apiTarget, ws: true },
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['src/test/setup.ts'],
      coverage: {
        provider: 'v8',
        include: ['src/**'],
        exclude: [
          'src/**/*.test.{ts,tsx}',
          'src/**/*.d.ts',
          'src/test/**',
          // Entry point: mounts the app and starts the MSW worker in a real browser.
          'src/main.tsx',
          // MSW mock API used by tests and dev, not product code.
          'src/mocks/**',
          // WebGL scene construction and GLSL. jsdom has no WebGL context, so unit tests cannot
          // reach this code; it belongs to browser tests. The React wrappers and pure scene maths
          // around it stay measured.
          'src/features/home/scene/{createLandingScene,haze,iceBlock,props,lensMaterial,skyMaterial}.ts',
          'src/features/home/scene/siteLayout.json',
          'src/features/team/scene/{createMeerkatScene,meerkatShaders}.ts',
          'src/features/auth/liquid/{createLiquidRenderer,liquidShader}.ts',
          'src/features/patients/inventory/createInventoryScene.ts',
        ],
        // Functions and branches are below 80% today (#117), so they are held at their current
        // floor to stop them slipping; raise them as tests land.
        thresholds: {
          lines: 80,
          statements: 80,
          functions: 77,
          branches: 71,
        },
      },
    },
  }
})
