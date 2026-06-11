// app/app/router/auth.guard — FSD "app" layer: the authentication route guard
// logic. Decoupled from Nuxt's middleware registration so the rule lives with
// the other app-layer concerns; the global middleware
// (app/middleware/auth.global.ts) just delegates here.
//
// Rule (docs/arquitectura-frontend.md §5.2): `/login` and `/register` are always
// reachable; every other route requires an authenticated session, otherwise the
// user is redirected to `/login`.

import type { RouteLocationNormalized } from 'vue-router'
import { useSessionStore } from '~/entities/user'

/** Routes reachable without a session. */
const PUBLIC_ROUTES = new Set<string>(['/login', '/register'])

/** True when the path is one of the public (no-auth) routes. */
export function isPublicRoute(path: string): boolean {
  return PUBLIC_ROUTES.has(path)
}

/**
 * Pure decision for the auth guard. Returns:
 *   - `undefined` to allow navigation, or
 *   - a redirect target (string path) to send the user elsewhere.
 *
 * Kept side-effect-free (takes the store as an arg) so it is trivial to unit
 * test without a Nuxt runtime.
 */
export function resolveAuthRedirect(
  to: RouteLocationNormalized,
  isAuthenticated: boolean,
): string | undefined {
  if (isPublicRoute(to.path)) {
    // Already signed in: keep authenticated users out of login/register.
    if (isAuthenticated) return '/'
    return undefined
  }
  if (!isAuthenticated) return '/login'
  return undefined
}

/**
 * The guard body invoked by the global middleware. Reads the live session store
 * and returns a `navigateTo(...)` redirect when needed (Nuxt middleware honors a
 * returned route-location as a redirect).
 */
export function runAuthGuard(to: RouteLocationNormalized) {
  const session = useSessionStore()
  const redirect = resolveAuthRedirect(to, session.isAuthenticated)
  if (redirect && redirect !== to.path) {
    return navigateTo(redirect)
  }
}
