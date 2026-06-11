// app/app/providers/auth.client — FSD "app" layer: auth bootstrap logic.
//
// Wires the domain-free HTTP client (`shared/api`) to the session store
// (`entities/user`) via `setAuthHooks`, then restores any persisted session on
// app start. Kept here (app layer) so the dependency direction stays correct:
// app -> entities -> shared. The thin Nuxt plugin at app/plugins/auth.client.ts
// just invokes `setupAuth()` so Nuxt actually runs it.
//
// Client-only: the access token lives in memory and the refresh token in
// localStorage (ADR-F03), neither of which exist during SSR — and the app is
// `ssr: false` anyway.

import { setAuthHooks } from '~/shared/api'
import { useSessionStore } from '~/entities/user'

/**
 * Connect auth hooks and restore the session. Returns once `init()` settles so
 * the very first navigation already sees the correct `isAuthenticated` state
 * (the route middleware then redirects appropriately).
 *
 * Must run after `@pinia/nuxt` has installed Pinia; calling `useSessionStore()`
 * inside the Nuxt plugin (which depends on Pinia) guarantees an active Pinia.
 */
export async function setupAuth(): Promise<void> {
  const session = useSessionStore()

  setAuthHooks({
    // Access token is read live from the store on every request.
    getAccessToken: () => session.accessToken,
    // Single-flight refresh is handled inside the client; we just rotate tokens.
    refresh: () => session.refresh(),
    // Irrecoverable auth: drop local state and send the user to /login.
    onAuthError: () => {
      session.clear()
      void navigateTo('/login')
    },
  })

  // Restore a persisted session (refresh + load profile) before first paint.
  await session.init()
}
