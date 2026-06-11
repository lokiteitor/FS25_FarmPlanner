// Vitest configuration for the FS25 Farm Planner Web unit tests.
//
// These are PURE unit tests of the framework-agnostic logic (the shared/api
// HTTP client and the entities/user Pinia session store). They do NOT boot a
// full Nuxt runtime: instead we run under happy-dom (so `localStorage` /
// `document` exist) and stub the few Nuxt globals the code touches
// (`$fetch`, `useRuntimeConfig`) per-test. This keeps the suite fast and
// avoids the heavier @nuxt/test-utils environment for logic that does not need
// SFC rendering.
//
// The `~` alias mirrors Nuxt 4's srcDir ("app/"), so `~/shared/...`,
// `~/entities/...` etc. resolve exactly as they do in the app.
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./app', import.meta.url)),
      '@': fileURLToPath(new URL('./app', import.meta.url)),
    },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['app/**/*.{test,spec}.ts', 'tests/**/*.{test,spec}.ts'],
    setupFiles: ['tests/setup.ts'],
  },
})
