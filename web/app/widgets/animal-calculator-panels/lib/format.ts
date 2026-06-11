// widgets/animal-calculator-panels/lib/format — small Spanish-locale number
// formatters for the calculator panels. PURE; no Vue/stores.

const NUMBER = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 })
const NUMBER_2 = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})
const MONEY = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

/** Format liters / counts as a whole number (es-ES grouping). */
export function fmtInt(value: number): string {
  return NUMBER.format(Math.round(value))
}

/** Format with up to 2 decimals (e.g. hectares, prices). */
export function fmtDec(value: number): string {
  return NUMBER_2.format(value)
}

/** Format a currency amount in euros (the in-game currency symbol is generic). */
export function fmtMoney(value: number): string {
  return MONEY.format(value)
}

/** Format a 0..1 bonus fraction as a percentage string. */
export function fmtPercent(fraction: number): string {
  return `${NUMBER_2.format(fraction * 100)} %`
}
