// Nuxt 4 SPA configuration for FS25 Farm Planner Web.
//
// Architecture (see docs/arquitectura-frontend.md):
//   - ADR-F01: SPA (`ssr: false`) served as static files by nginx.
//   - ADR-F02: Feature-Sliced Design. Nuxt 4 srcDir is "app/", so "~" maps to
//     web/app. The FSD layers live directly under app/:
//       app/app      -> FSD "app" layer (providers, router guards, styles entry)
//       app/pages    -> FSD "pages" layer (Nuxt route directory)
//       app/widgets  -> FSD "widgets" layer   (~/widgets)
//       app/features -> FSD "features" layer  (~/features)
//       app/entities -> FSD "entities" layer  (~/entities)
//       app/shared   -> FSD "shared" layer    (~/shared)
//     Component auto-import is disabled to preserve FSD import discipline;
//     components are imported explicitly via each slice's public API.
//   - ADR-F06: Pinia as the single state management solution.
//
// Nuxt composable auto-import stays ON (we do not touch imports.autoImport) so
// useRuntimeConfig, useFetch, useState, navigateTo, etc. remain available.
export default defineNuxtConfig({
  // Nuxt 4 behaviour explicitly opted in.
  compatibilityVersion: 4,

  // ADR-F01: client-only static SPA.
  ssr: false,

  devtools: { enabled: true },

  modules: ['@pinia/nuxt', '@nuxt/eslint'],

  // Global SCSS entry (design tokens + base glassmorphism theme).
  css: ['~/app/styles/main.scss'],

  // FSD: no component auto-import. Slices expose components via explicit imports.
  components: {
    dirs: [],
  },

  vite: {
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: '@use "~/app/styles/variables" as *; @use "~/app/styles/mixins" as *;',
        },
      },
    },
  },

  // Dev only: proxy /api to the locally running API (production uses nginx).
  nitro: {
    devProxy: {
      '/api': {
        target: 'http://localhost:3000/api',
        changeOrigin: true,
      },
    },
  },

  runtimeConfig: {
    public: {
      // Relative base; nginx proxies /api in production, nitro.devProxy in dev.
      apiBase: '/api/v1',
    },
  },
})
