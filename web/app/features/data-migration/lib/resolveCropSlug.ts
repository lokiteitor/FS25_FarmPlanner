// features/data-migration/lib/resolveCropSlug — resolve a prototype crop label
// (a Spanish name, an English name, or an already-resolved slug) to a catalog
// crop slug, using the LIVE catalog (crops carry `slug` + `nameEs` + `nameEn`)
// rather than a hardcoded map. A small PUNCTUAL fallback map covers known
// prototype spellings that differ from the catalog `nameEs`. Unresolved labels
// return `null` so the importer can report them without aborting (H8 acceptance).
//
// FSD: pure lib (no stores/network). Takes the crop list as an argument so it is
// trivially testable and reusable from the importer.

/** The subset of a catalog crop this resolver needs (slug + display names). */
export interface ResolverCrop {
  slug: string
  nameEs: string
  nameEn?: string
}

/**
 * Punctual fallback: prototype Spanish spelling (normalized) -> catalog slug.
 * ONLY for names that differ from the seed `nameEs` (accents/case are already
 * handled by normalization, so these are genuine spelling/wording differences).
 * Exported so it is auditable and testable.
 *
 * The keys are pre-normalized (see {@link normalize}); add entries here when a
 * real prototype dump surfaces a label the catalog does not match by name.
 */
export const CROP_NAME_FALLBACKS: Readonly<Record<string, string>> = Object.freeze({
  // Generic / older prototype wordings.
  maiz: 'corn',
  trigo: 'wheat',
  cebada: 'barley',
  avena: 'oat',
  // The seed uses "Patatas"; the prototype/game often says "Patata".
  patata: 'potato',
  patatas: 'potato',
  // "Remolacha" alone is the red beet; sugar beet is "Remolacha Azucarera".
  remolacha: 'redbeet',
  'remolacha roja': 'redbeet',
  'remolacha azucarera': 'sugarbeet',
  // Onion: seed says "Cebollas"; singular variant.
  cebolla: 'onion',
  cebollas: 'onion',
  // Wood-chip poplar shorthands (seed nameEs: "Álamo (Astillas de Madera)").
  alamo: 'poplar',
  'astillas de madera': 'poplar',
  // Rice variants the prototype may shorten.
  arroz: 'rice',
  'arroz largo': 'rice_long_grain',
  'arroz corto': 'rice',
  // Misc spelling/wording.
  'judias verdes': 'green_beans',
  'cana de azucar': 'sugarcane',
  aceituna: 'olive',
  aceitunas: 'olive',
  girasoles: 'sunflower',
})

/**
 * Normalize a label for comparison: strip diacritics (NFD + combining marks),
 * lowercase, collapse internal whitespace and trim. Returns '' for blank input.
 */
export function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Resolve a crop label to a catalog slug, or `null` if unresolved.
 *
 * Resolution order:
 *   1. exact slug match (the label is already a slug present in the catalog);
 *   2. exact `nameEs` match (accent/case-insensitive);
 *   3. exact `nameEn` match (accent/case-insensitive);
 *   4. punctual fallback map ({@link CROP_NAME_FALLBACKS}) — only if the target
 *      slug actually exists in the catalog;
 *   5. `null`.
 */
export function resolveCropSlug(
  name: string | null | undefined,
  catalogCrops: readonly ResolverCrop[],
): string | null {
  if (name == null) return null
  const raw = name.trim()
  if (raw === '') return null

  const norm = normalize(raw)

  // 1. Already a slug present in the catalog (exact, case-sensitive: slugs are
  //    lowercase + underscores). Also accept a case-insensitive slug match.
  const bySlug = catalogCrops.find((c) => c.slug === raw || c.slug.toLowerCase() === norm)
  if (bySlug) return bySlug.slug

  // 2. Exact Spanish name (normalized).
  const byEs = catalogCrops.find((c) => normalize(c.nameEs) === norm)
  if (byEs) return byEs.slug

  // 3. Exact English name (normalized).
  const byEn = catalogCrops.find((c) => c.nameEn != null && normalize(c.nameEn) === norm)
  if (byEn) return byEn.slug

  // 4. Punctual fallback — but only if the mapped slug exists in this catalog.
  const fallbackSlug = CROP_NAME_FALLBACKS[norm]
  if (fallbackSlug && catalogCrops.some((c) => c.slug === fallbackSlug)) {
    return fallbackSlug
  }

  // 5. Unresolved.
  return null
}
