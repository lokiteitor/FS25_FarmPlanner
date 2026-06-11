// shared/lib/format — small, pure number/currency formatting helpers shared by
// the planning widgets and pages (Spanish locale). No stores, no network.
//
// We use a fixed 'es-ES' locale so the formatting is deterministic regardless of
// the host environment (important for happy-dom tests). Currency is rendered
// with the FS in-game money symbol ($) rather than a real currency code.

const LOCALE = 'es-ES'

/**
 * Format a number with grouping and up to `maxFractionDigits` decimals.
 * `null`/`undefined`/non-finite values render as an em dash.
 */
export function formatNumber(
  value: number | null | undefined,
  maxFractionDigits = 0,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFractionDigits,
    // es-ES omits grouping for 4-digit numbers by default ("min2" strategy);
    // force grouping so money/amounts read consistently (1500 -> "1.500").
    useGrouping: 'always',
  }).format(value)
}

/**
 * Format an in-game money amount: grouped integer with a leading `$`.
 * `null`/`undefined`/non-finite values render as an em dash.
 */
export function formatMoney(
  value: number | null | undefined,
  maxFractionDigits = 0,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return `$${formatNumber(value, maxFractionDigits)}`
}

/**
 * Format a 0..1-ish ratio as a percentage (e.g. 0.425 -> "42,5 %").
 * `null`/`undefined`/non-finite values render as an em dash.
 */
export function formatPercent(
  value: number | null | undefined,
  maxFractionDigits = 1,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat(LOCALE, {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFractionDigits,
  }).format(value)
}
