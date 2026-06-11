// features/farm-switcher/lib/options — Spanish label maps and <select> option
// lists for the farm ("partida") form fields. Difficulty and sellPriceType are
// catalog/domain enums (re-used from entities/farm's public API); we centralize
// their human-readable Spanish labels here so the switcher dropdown and the
// manage modal stay consistent.

import type { Difficulty, SellPriceType } from '~/entities/farm'
import type { SelectOption } from '~/shared/ui'

/** Spanish labels for each difficulty level. */
export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Fácil',
  normal: 'Normal',
  hard: 'Difícil',
}

/** Spanish labels for each sell-price strategy. */
export const SELL_PRICE_TYPE_LABELS: Record<SellPriceType, string> = {
  baseline: 'Precio base',
  max_seasonal: 'Precio máximo estacional',
}

/** <AppSelect> options for the difficulty field. */
export const DIFFICULTY_OPTIONS: SelectOption[] = (
  ['easy', 'normal', 'hard'] satisfies Difficulty[]
).map((value) => ({ value, label: DIFFICULTY_LABELS[value] }))

/** <AppSelect> options for the sell-price-type field. */
export const SELL_PRICE_TYPE_OPTIONS: SelectOption[] = (
  ['baseline', 'max_seasonal'] satisfies SellPriceType[]
).map((value) => ({ value, label: SELL_PRICE_TYPE_LABELS[value] }))

/** Human-readable difficulty label (falls back to the raw value). */
export function difficultyLabel(difficulty: Difficulty): string {
  return DIFFICULTY_LABELS[difficulty] ?? difficulty
}

/** Human-readable sell-price-type label (falls back to the raw value). */
export function sellPriceTypeLabel(type: SellPriceType): string {
  return SELL_PRICE_TYPE_LABELS[type] ?? type
}
