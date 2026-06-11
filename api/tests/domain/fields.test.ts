/**
 * Fields API integration tests (H4.3).
 *
 * Runs the real /api/v1/farms/:farmId/fields CRUD against a freshly-seeded
 * postgres:18-alpine. Covers docs/openapi.yaml + the two service business rules
 * from docs/base-de-datos.md §10:
 *   - create under a farm; duplicate fieldNumber → 409 DUPLICATE_FIELD_NUMBER
 *   - cropId from a DIFFERENT game version → 422 CROP_VERSION_MISMATCH
 *   - isSilage with a non-silage crop (onion) → 422 SILAGE_NOT_SUPPORTED_FOR_CROP
 *   - isSilage with a silage crop (wheat) → ok
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  bootstrapDomainApp,
  teardownDomainApp,
  registerUser,
  dataOf,
  errorOf,
  type DomainAppContext,
  type TestUser,
} from './_setup';

interface FieldDto {
  id: string;
  farmId: string;
  fieldNumber: number;
  hectares: number;
  cropId: string | null;
  isSilage: boolean;
  yieldBonus: number | null;
  purchasePrice: number | null;
}

interface CropLite {
  id: string;
  slug: string;
}

describe('Fields API (H4.3)', () => {
  let ctx: DomainAppContext;
  let user: TestUser;
  let farmId: string;
  let cropsBySlug: Map<string, CropLite>;
  /** A crop id fabricated under a SECOND game version (not the farm's version). */
  let foreignCropId: string;

  function fieldsUrl(): string {
    return `/api/v1/farms/${farmId}/fields`;
  }

  beforeAll(async () => {
    ctx = await bootstrapDomainApp();
    user = await registerUser(ctx.app, 'fields');
    farmId = user.defaultFarmId;

    // Cache the seeded crop catalog by slug.
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/catalog/crops',
      headers: user.authHeader,
    });
    cropsBySlug = new Map(dataOf<CropLite[]>(res.payload).map((c) => [c.slug, c]));

    // Fabricate a second game version + a crop in it, so we have a real crop id
    // that belongs to a DIFFERENT version than the farm's (for the mismatch test).
    const { gameVersions, crops } = await import('../../src/db/schema/catalog');
    const [otherVersion] = await ctx.db
      .insert(gameVersions)
      .values({ label: 'FS25 TEST-OTHER', isActive: false, releasedAt: null })
      .returning({ id: gameVersions.id });
    const [otherCrop] = await ctx.db
      .insert(crops)
      .values({
        gameVersionId: otherVersion.id,
        slug: 'wheat',
        nameEs: 'Trigo',
        nameEn: 'Wheat',
        yieldPerM2: 0.89,
        basePrice: 0.337,
        maxPriceFactor: 1.21,
        seedRate: 0.0308,
        weightPerLiter: 0.78,
      })
      .returning({ id: crops.id });
    foreignCropId = otherCrop.id;
  }, 120000);

  afterAll(async () => {
    await teardownDomainApp(ctx);
  });

  // -------------------------------------------------------------------------
  // create + duplicate
  // -------------------------------------------------------------------------
  it('201 creates a field with no crop', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: fieldsUrl(),
      headers: user.authHeader,
      payload: { fieldNumber: 1, hectares: 12.5 },
    });
    expect(res.statusCode).toBe(201);
    const field = dataOf<FieldDto>(res.payload);
    expect(field.fieldNumber).toBe(1);
    expect(field.hectares).toBe(12.5);
    expect(field.cropId).toBeNull();
    expect(field.isSilage).toBe(false);
    expect(field.farmId).toBe(farmId);
  });

  it('201 creates a field with a same-version crop', async () => {
    const wheat = cropsBySlug.get('wheat')!;
    const res = await ctx.app.inject({
      method: 'POST',
      url: fieldsUrl(),
      headers: user.authHeader,
      payload: { fieldNumber: 2, hectares: 4, cropId: wheat.id },
    });
    expect(res.statusCode).toBe(201);
    expect(dataOf<FieldDto>(res.payload).cropId).toBe(wheat.id);
  });

  it('409 DUPLICATE_FIELD_NUMBER for a repeated number in the same farm', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: fieldsUrl(),
      headers: user.authHeader,
      payload: { fieldNumber: 1, hectares: 9 },
    });
    expect(res.statusCode).toBe(409);
    expect(errorOf(res.payload).code).toBe('DUPLICATE_FIELD_NUMBER');
  });

  // -------------------------------------------------------------------------
  // crop ↔ version coherence
  // -------------------------------------------------------------------------
  it('422 CROP_VERSION_MISMATCH for a cropId from another game version', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: fieldsUrl(),
      headers: user.authHeader,
      payload: { fieldNumber: 10, hectares: 3, cropId: foreignCropId },
    });
    expect(res.statusCode).toBe(422);
    expect(errorOf(res.payload).code).toBe('CROP_VERSION_MISMATCH');
  });

  it('422 CROP_VERSION_MISMATCH for a non-existent cropId', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: fieldsUrl(),
      headers: user.authHeader,
      payload: {
        fieldNumber: 11,
        hectares: 3,
        cropId: '00000000-0000-0000-0000-000000000000',
      },
    });
    expect(res.statusCode).toBe(422);
    expect(errorOf(res.payload).code).toBe('CROP_VERSION_MISMATCH');
  });

  // -------------------------------------------------------------------------
  // silage support
  // -------------------------------------------------------------------------
  it('422 SILAGE_NOT_SUPPORTED_FOR_CROP with a non-silage crop (onion)', async () => {
    const onion = cropsBySlug.get('onion')!;
    const res = await ctx.app.inject({
      method: 'POST',
      url: fieldsUrl(),
      headers: user.authHeader,
      payload: { fieldNumber: 20, hectares: 2, cropId: onion.id, isSilage: true },
    });
    expect(res.statusCode).toBe(422);
    expect(errorOf(res.payload).code).toBe('SILAGE_NOT_SUPPORTED_FOR_CROP');
  });

  it('422 SILAGE_NOT_SUPPORTED_FOR_CROP for silage with no crop', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: fieldsUrl(),
      headers: user.authHeader,
      payload: { fieldNumber: 21, hectares: 2, isSilage: true },
    });
    expect(res.statusCode).toBe(422);
    expect(errorOf(res.payload).code).toBe('SILAGE_NOT_SUPPORTED_FOR_CROP');
  });

  it('201 isSilage with a silage-capable crop (wheat) is accepted', async () => {
    const wheat = cropsBySlug.get('wheat')!;
    const res = await ctx.app.inject({
      method: 'POST',
      url: fieldsUrl(),
      headers: user.authHeader,
      payload: { fieldNumber: 22, hectares: 2, cropId: wheat.id, isSilage: true },
    });
    expect(res.statusCode).toBe(201);
    const field = dataOf<FieldDto>(res.payload);
    expect(field.isSilage).toBe(true);
    expect(field.cropId).toBe(wheat.id);
  });

  // -------------------------------------------------------------------------
  // get / list / patch / delete
  // -------------------------------------------------------------------------
  it('GET list is ordered by fieldNumber; GET item 404s for unknown id', async () => {
    const list = await ctx.app.inject({
      method: 'GET',
      url: fieldsUrl(),
      headers: user.authHeader,
    });
    expect(list.statusCode).toBe(200);
    const numbers = dataOf<FieldDto[]>(list.payload).map((f) => f.fieldNumber);
    const sorted = [...numbers].sort((a, b) => a - b);
    expect(numbers).toEqual(sorted);

    const missing = await ctx.app.inject({
      method: 'GET',
      url: `${fieldsUrl()}/00000000-0000-0000-0000-000000000000`,
      headers: user.authHeader,
    });
    expect(missing.statusCode).toBe(404);
    expect(errorOf(missing.payload).code).toBe('FIELD_NOT_FOUND');
  });

  it('PATCH 422 when flipping isSilage on a field whose crop has no silage variant', async () => {
    const onion = cropsBySlug.get('onion')!;
    const created = await ctx.app.inject({
      method: 'POST',
      url: fieldsUrl(),
      headers: user.authHeader,
      payload: { fieldNumber: 30, hectares: 2, cropId: onion.id },
    });
    const fieldId = dataOf<FieldDto>(created.payload).id;

    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `${fieldsUrl()}/${fieldId}`,
      headers: user.authHeader,
      payload: { isSilage: true },
    });
    expect(res.statusCode).toBe(422);
    expect(errorOf(res.payload).code).toBe('SILAGE_NOT_SUPPORTED_FOR_CROP');
  });

  it('PATCH 200 clears the crop with null; DELETE 204 then 404', async () => {
    const wheat = cropsBySlug.get('wheat')!;
    const created = await ctx.app.inject({
      method: 'POST',
      url: fieldsUrl(),
      headers: user.authHeader,
      payload: { fieldNumber: 31, hectares: 2, cropId: wheat.id },
    });
    const fieldId = dataOf<FieldDto>(created.payload).id;

    const patch = await ctx.app.inject({
      method: 'PATCH',
      url: `${fieldsUrl()}/${fieldId}`,
      headers: user.authHeader,
      payload: { cropId: null },
    });
    expect(patch.statusCode).toBe(200);
    expect(dataOf<FieldDto>(patch.payload).cropId).toBeNull();

    const del = await ctx.app.inject({
      method: 'DELETE',
      url: `${fieldsUrl()}/${fieldId}`,
      headers: user.authHeader,
    });
    expect(del.statusCode).toBe(204);

    const again = await ctx.app.inject({
      method: 'DELETE',
      url: `${fieldsUrl()}/${fieldId}`,
      headers: user.authHeader,
    });
    expect(again.statusCode).toBe(404);
    expect(errorOf(again.payload).code).toBe('FIELD_NOT_FOUND');
  });

  it('422 VALIDATION_ERROR on non-positive hectares', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: fieldsUrl(),
      headers: user.authHeader,
      payload: { fieldNumber: 40, hectares: 0 },
    });
    expect(res.statusCode).toBe(422);
    expect(errorOf(res.payload).code).toBe('VALIDATION_ERROR');
  });
});
