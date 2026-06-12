import { z } from 'zod';

/**
 * Zod schemas for the Production Buildings module.
 *
 * Materialises the `/farms/:farmId/production-buildings` request/response
 * shapes as the single runtime + compile-time contract used by the routes
 * (fastify-type-provider-zod).
 *
 * Key design decisions:
 *  - The `chains` column is a JSONB array of UserChain objects (validated here
 *    by `userChainSchema`). The service validates them on every write; the route
 *    schema accepts any JSON array for the write path and delegates species-level
 *    validation to the service.
 *  - Request bodies are `.strict()` so unknown keys are rejected.
 *  - Override fields (cyclesPerMonth, inputs, outputs) are nullable: null means
 *    "use the catalog default"; the engine resolves this before calculating.
 *  - A null `catalogChainSlug` marks a fully custom (mod) chain with no catalog
 *    reference; in that case all fields must be present.
 */

// ---------------------------------------------------------------------------
// Envelope helper
// ---------------------------------------------------------------------------

export function dataEnvelope<T extends z.ZodTypeAny>(schema: T) {
  return z.object({ data: schema });
}

// ---------------------------------------------------------------------------
// ProductionIO (shared between catalog and user chains)
// ---------------------------------------------------------------------------

export const productionIOSchema = z.object({
  slug: z.string().min(1),
  quantityPerCycle: z.number().positive(),
});

export type ProductionIOValue = z.infer<typeof productionIOSchema>;

// ---------------------------------------------------------------------------
// UserChain — a single recipe entry in the building's `chains` JSONB array
// ---------------------------------------------------------------------------

export const userChainSchema = z
  .object({
    /** Client-generated UUID identifying this chain within the building. */
    id: z.string().uuid(),
    /** Slug of the catalog chain this is based on. null = fully custom (mod). */
    catalogChainSlug: z.string().min(1).nullable(),
    /** Display name (from catalog or user-specified). */
    name: z.string().min(1).max(150),
    /** When false, excluded from cycle-split and produces nothing. */
    isActive: z.boolean(),
    /**
     * Override cycles/month. null = use the catalog value.
     * For custom chains (catalogChainSlug=null) this field is required.
     */
    cyclesPerMonth: z.number().positive().nullable().optional(),
    /** Override inputs. null = use catalog. Required when catalogChainSlug=null. */
    inputs: z.array(productionIOSchema).nullable().optional(),
    /** Override outputs. null = use catalog. Required when catalogChainSlug=null. */
    outputs: z.array(productionIOSchema).nullable().optional(),
  })
  .strict()
  .superRefine((chain, ctx) => {
    // For custom chains (no catalog reference) all runtime fields must be provided.
    if (chain.catalogChainSlug === null) {
      if (chain.cyclesPerMonth == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['cyclesPerMonth'],
          message:
            'cyclesPerMonth is required for custom chains (catalogChainSlug is null)',
        });
      }
      if (!chain.inputs || chain.inputs.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['inputs'],
          message:
            'inputs is required and must be non-empty for custom chains (catalogChainSlug is null)',
        });
      }
      if (!chain.outputs || chain.outputs.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['outputs'],
          message:
            'outputs is required and must be non-empty for custom chains (catalogChainSlug is null)',
        });
      }
    }
  });

export type UserChainValue = z.infer<typeof userChainSchema>;

// ---------------------------------------------------------------------------
// Request bodies
// ---------------------------------------------------------------------------

/** POST /farms/:farmId/production-buildings */
export const productionBuildingCreateBody = z
  .object({
    name: z.string().min(1).max(100),
    buildingTypeSlug: z.string().min(1).max(50),
    chains: z.array(userChainSchema).optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .strict();

/** PATCH /farms/:farmId/production-buildings/:buildingId */
export const productionBuildingUpdateBody = z
  .object({
    name: z.string().min(1).max(100),
    buildingTypeSlug: z.string().min(1).max(50),
    chains: z.array(userChainSchema),
    notes: z.string().max(2000).nullable(),
  })
  .strict()
  .partial();

// ---------------------------------------------------------------------------
// Path params
// ---------------------------------------------------------------------------

export const productionBuildingParams = z.object({
  farmId: z.string().uuid(),
  buildingId: z.string().uuid(),
});

export const productionBuildingCollectionParams = z.object({
  farmId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// Response schema
// ---------------------------------------------------------------------------

export const productionBuildingSchema = z.object({
  id: z.string().uuid(),
  farmId: z.string().uuid(),
  name: z.string(),
  buildingTypeSlug: z.string(),
  chains: z.array(z.record(z.string(), z.unknown())),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ProductionBuildingDto = z.infer<typeof productionBuildingSchema>;

// ---------------------------------------------------------------------------
// Response envelopes
// ---------------------------------------------------------------------------

export const productionBuildingResponse = dataEnvelope(productionBuildingSchema);
export const productionBuildingsListResponse = dataEnvelope(
  z.array(productionBuildingSchema),
);

// ---------------------------------------------------------------------------
// Inferred input types
// ---------------------------------------------------------------------------

export type ProductionBuildingCreateInput = z.infer<
  typeof productionBuildingCreateBody
>;
export type ProductionBuildingUpdateInput = z.infer<
  typeof productionBuildingUpdateBody
>;
export type ProductionBuildingParams = z.infer<typeof productionBuildingParams>;
export type ProductionBuildingCollectionParams = z.infer<
  typeof productionBuildingCollectionParams
>;
