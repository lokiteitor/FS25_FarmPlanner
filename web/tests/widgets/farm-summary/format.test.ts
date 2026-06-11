// tests/widgets/farm-summary/format — unit tests for the pure formatting
// helpers. Locale-grouping characters vary by environment, so we assert on
// digit content / structure rather than exact separators.

import { describe, expect, it } from 'vitest'
// Import the pure helpers directly (not via the widget index, which also
// re-exports the .vue component — vitest has no Vue plugin configured).
import {
  formatCurrency,
  formatHectares,
  formatInteger,
  speciesLabel,
} from '~/widgets/farm-summary/lib/format'

describe('speciesLabel', () => {
  it('maps known species to Spanish names', () => {
    expect(speciesLabel('cow')).toBe('Vacas')
    expect(speciesLabel('chicken')).toBe('Gallinas')
    expect(speciesLabel('horse')).toBe('Caballos')
  })

  it('falls back to the raw key for unknown species', () => {
    expect(speciesLabel('dragon')).toBe('dragon')
  })
})

describe('formatInteger', () => {
  it('rounds to a whole number', () => {
    expect(formatInteger(0)).toBe('0')
    expect(formatInteger(12.7)).toBe('13')
    // Grouping separator differs by ICU build; only assert the digits survive.
    expect(formatInteger(1500).replace(/\D/g, '')).toBe('1500')
  })
})

describe('formatHectares', () => {
  it('keeps up to one decimal', () => {
    expect(formatHectares(0)).toBe('0')
    expect(formatHectares(2.5)).toMatch(/2[.,]5/)
    expect(formatHectares(10)).toBe('10')
  })
})

describe('formatCurrency', () => {
  it('prefixes a dollar sign and rounds', () => {
    expect(formatCurrency(0)).toBe('$0')
    expect(formatCurrency(1234.6)).toMatch(/^\$/)
    expect(formatCurrency(1234.6).replace(/[^\d]/g, '')).toBe('1235')
  })
})
