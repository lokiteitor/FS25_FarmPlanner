/**
 * Ambient module augmentations for the HTTP layer.
 *
 * Kept in `src/types` so it is picked up by tsconfig's `"include": ["src"]`.
 * These declarations are global side effects (no runtime code) and must not be
 * imported anywhere; TypeScript merges them automatically.
 */

import '@fastify/jwt';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    /** Claims we sign into the access token. `sub` is the user id (UUID v7). */
    payload: { sub: string; email: string };
    /** Shape exposed on `request.user` after a successful `jwtVerify()`. */
    user: { id: string; email: string };
  }
}

declare module 'fastify' {
  /**
   * Per-route config flags. `public: true` opts a route out of the global auth
   * onRequest hook (see `src/plugins/auth.ts`).
   */
  interface FastifyContextConfig {
    public?: boolean;
  }

  interface FastifyInstance {
    /**
     * Pre-handler that enforces a valid access token and populates
     * `request.user`. The auth plugin also installs a global onRequest hook, so
     * this decorator is mainly available for explicit/opt-in use.
     */
    authenticate: (
      request: import('fastify').FastifyRequest,
      reply: import('fastify').FastifyReply,
    ) => Promise<void>;
  }
}
