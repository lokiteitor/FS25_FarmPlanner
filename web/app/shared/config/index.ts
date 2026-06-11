// shared/config — domain-agnostic configuration helpers.
//
// FSD "shared" layer: no domain knowledge, framework-pure where possible.
// The API base comes from Nuxt runtimeConfig (see nuxt.config.ts -> runtimeConfig
// .public.apiBase, default '/api/v1'); nginx proxies /api in production and
// nitro.devProxy in dev, so the base is a relative path.

/**
 * Default API base path. Mirrors the value declared in `nuxt.config.ts`
 * (`runtimeConfig.public.apiBase`). Kept here so non-component / test code that
 * cannot call `useRuntimeConfig()` still has a sane fallback.
 */
export const DEFAULT_API_BASE = '/api/v1'

/**
 * Resolves the API base path.
 *
 * Inside the Nuxt app (components, plugins, middleware, stores) this reads
 * `useRuntimeConfig().public.apiBase`. Outside that context (e.g. pure unit
 * tests of the engine or the client) `useRuntimeConfig` is undefined, so we
 * fall back to {@link DEFAULT_API_BASE}.
 */
export function getApiBase(): string {
  // `useRuntimeConfig` is a Nuxt auto-import; guard for non-Nuxt contexts.
  const runtimeConfig =
    typeof useRuntimeConfig === 'function' ? useRuntimeConfig() : undefined
  const base = runtimeConfig?.public?.apiBase
  return (typeof base === 'string' && base.length > 0 ? base : DEFAULT_API_BASE).replace(/\/+$/, '')
}

/**
 * localStorage keys used by the SPA. ADR-F03: the access token lives only in
 * memory (Pinia), the refresh token is persisted in localStorage.
 */
export const STORAGE_KEYS = {
  /** Refresh token (rotated by the backend on every /auth/refresh). */
  refreshToken: 'fs25.refreshToken',
} as const

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]
