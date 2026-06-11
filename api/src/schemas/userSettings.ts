/**
 * Zod schemas for the User Settings module (H4.6).
 *
 * Materialises the `/me/settings` request + response shapes from
 * docs/openapi.yaml (UserSettings / UserSettingsUpdate components) as the single
 * runtime + compile-time contract handed to the routes via
 * fastify-type-provider-zod. Also documents those shapes in Swagger.
 *
 * Conventions (mirroring schemas/auth.ts):
 *  - The PATCH body is `.strict()` so unknown keys surface as 422
 *    VALIDATION_ERROR instead of passing silently.
 *  - The response wrapper uses `dataEnvelope(schema)` to match the success
 *    envelope `{ data }` (docs/arquitectura-api.md §8).
 *  - `theme` is the enum system|dark|light; `locale` is capped at 10 chars to
 *    match the `varchar(10)` column.
 *  - `activeFarmId` is `uuid | null` on update: an explicit `null` clears the
 *    active farm, a uuid sets it (ownership is verified in the service →
 *    422 FARM_NOT_OWNED). Omitting the key leaves it untouched.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shared field schemas
// ---------------------------------------------------------------------------

/** UI theme (openapi.yaml UserSettings.theme enum). */
export const themeSchema = z.enum(['system', 'dark', 'light']);

/** Free-form UI preferences blob (JSONB column, additionalProperties: true). */
const preferencesSchema = z.record(z.string(), z.unknown());

// ---------------------------------------------------------------------------
// Request body: PATCH /me/settings
// ---------------------------------------------------------------------------

/**
 * UserSettingsUpdate (openapi.yaml #/components/schemas/UserSettingsUpdate).
 *
 * Every field is optional (partial patch). `activeFarmId` accepts a uuid or an
 * explicit null; the service validates ownership before applying it.
 */
export const userSettingsUpdateBody = z
  .object({
    locale: z.string().max(10),
    theme: themeSchema,
    activeFarmId: z.string().uuid().nullable(),
    preferences: preferencesSchema,
  })
  .partial()
  .strict();

// ---------------------------------------------------------------------------
// Response schema (serialisation contract)
// ---------------------------------------------------------------------------

/** UserSettings (openapi.yaml #/components/schemas/UserSettings). */
export const userSettingsSchema = z.object({
  userId: z.string().uuid(),
  locale: z.string(),
  theme: themeSchema,
  activeFarmId: z.string().uuid().nullable(),
  preferences: preferencesSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// ---------------------------------------------------------------------------
// Envelope wrapper
// ---------------------------------------------------------------------------

/** Wrap a payload schema in the success envelope `{ data }`. */
export function dataEnvelope<T extends z.ZodTypeAny>(schema: T) {
  return z.object({ data: schema });
}

/** Pre-wrapped envelope handed to both GET and PATCH routes. */
export const userSettingsResponse = dataEnvelope(userSettingsSchema);

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type UserSettingsUpdateInput = z.infer<typeof userSettingsUpdateBody>;
export type UserSettingsResponse = z.infer<typeof userSettingsSchema>;
