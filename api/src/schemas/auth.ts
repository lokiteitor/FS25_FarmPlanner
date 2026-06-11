import { z } from 'zod';

/**
 * Zod schemas for the Auth module. These materialise the `/auth/*` request and
 * response shapes from docs/openapi.yaml (Auth section + the User / TokenPair /
 * AuthSession components) as the single runtime + compile-time contract used by
 * the auth routes (fastify-type-provider-zod).
 *
 * Conventions:
 *  - Request bodies are `.strict()` so unknown keys are rejected (a typo in the
 *    client surfaces as 422 VALIDATION_ERROR rather than passing silently).
 *  - Response wrappers use `dataEnvelope(schema)` to match the success envelope
 *    `{ data, meta? }` documented in docs/arquitectura-api.md §8.
 *  - Password policy mirrors the contract: min 8, max 200 characters.
 */

// ---------------------------------------------------------------------------
// Shared field schemas
// ---------------------------------------------------------------------------

const emailSchema = z.string().email();
const passwordSchema = z.string().min(8).max(200);
const displayNameSchema = z.string().max(100);

// ---------------------------------------------------------------------------
// Request bodies
// ---------------------------------------------------------------------------

/** POST /auth/register */
export const registerBody = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    displayName: displayNameSchema.optional(),
  })
  .strict();

/** POST /auth/login */
export const loginBody = z
  .object({
    email: emailSchema,
    // Login does not re-validate password complexity: any string is accepted
    // and matched against the stored hash (so policy changes never lock anyone
    // out). Mirrors openapi.yaml where the login password is just `string`.
    password: z.string(),
  })
  .strict();

/** POST /auth/refresh */
export const refreshBody = z
  .object({
    refreshToken: z.string(),
  })
  .strict();

/** POST /auth/logout */
export const logoutBody = z
  .object({
    refreshToken: z.string(),
  })
  .strict();

/**
 * PATCH /auth/me — update profile and/or password.
 *
 * Per the contract, changing the password requires both `currentPassword` and
 * `newPassword`. The refinement enforces "newPassword present ⇒ currentPassword
 * required"; the error is attached to `currentPassword` so the 422 detail points
 * at the missing field.
 */
export const updateMeBody = z
  .object({
    displayName: displayNameSchema.optional(),
    currentPassword: z.string().optional(),
    newPassword: passwordSchema.optional(),
  })
  .strict()
  .refine(
    (body) => body.newPassword === undefined || body.currentPassword !== undefined,
    {
      message: 'currentPassword is required when newPassword is provided',
      path: ['currentPassword'],
    },
  );

// ---------------------------------------------------------------------------
// Response schemas (serialisation contract)
// ---------------------------------------------------------------------------

/** User (openapi.yaml #/components/schemas/User). */
export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string().nullable(),
  createdAt: z.string().datetime(),
});

/** TokenPair (openapi.yaml #/components/schemas/TokenPair). */
export const tokenPairSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().int(),
});

/** AuthSession (openapi.yaml #/components/schemas/AuthSession). */
export const authSessionSchema = z.object({
  user: userSchema,
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().int(),
});

// ---------------------------------------------------------------------------
// Envelope wrapper
// ---------------------------------------------------------------------------

/**
 * Wraps a payload schema in the success envelope `{ data }` used by every
 * non-204 response (docs/arquitectura-api.md §8). `meta` is added per-route
 * where it applies and is intentionally not part of this base wrapper.
 */
export function dataEnvelope<T extends z.ZodTypeAny>(schema: T) {
  return z.object({ data: schema });
}

// Pre-wrapped envelopes for the auth responses, ready to hand to routes.
export const authSessionResponse = dataEnvelope(authSessionSchema);
export const tokenPairResponse = dataEnvelope(tokenPairSchema);
export const userResponse = dataEnvelope(userSchema);

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type RegisterInput = z.infer<typeof registerBody>;
export type LoginInput = z.infer<typeof loginBody>;
export type RefreshInput = z.infer<typeof refreshBody>;
export type LogoutInput = z.infer<typeof logoutBody>;
export type UpdateMeInput = z.infer<typeof updateMeBody>;

export type UserResponse = z.infer<typeof userSchema>;
export type TokenPairResponse = z.infer<typeof tokenPairSchema>;
export type AuthSessionResponse = z.infer<typeof authSessionSchema>;
