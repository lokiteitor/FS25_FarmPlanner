// Global test setup. Runs once before each test file (see vitest.config.ts
// `setupFiles`).
//
// The source under test reads two Nuxt auto-imported globals:
//   - `useRuntimeConfig()` (shared/config -> getApiBase): guarded with
//     `typeof useRuntimeConfig === 'function'`, so when it is simply absent the
//     code falls back to DEFAULT_API_BASE. We leave it undefined here so the
//     base resolves to the documented '/api/v1' default; individual tests can
//     stub it if they need a custom base.
//   - `$fetch` (shared/api/client -> rawFetch): every client test installs its
//     own `$fetch` mock, so we only declare the ambient global type here.
//
// happy-dom provides `localStorage`, `document`, `DOMException`, etc.

import { beforeEach, vi } from 'vitest'

declare global {
  // eslint-disable-next-line no-var
  var $fetch: unknown
  // eslint-disable-next-line no-var
  var useRuntimeConfig: unknown
}

beforeEach(() => {
  // Start every test from a clean global + storage + mock state so the
  // single-flight refresh latch and persisted tokens never leak across tests.
  vi.restoreAllMocks()
  if (typeof localStorage !== 'undefined') localStorage.clear()
})
