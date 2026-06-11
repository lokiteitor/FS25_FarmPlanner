// Unit tests for the shared/lib/format helpers (es-ES locale, deterministic).

import { describe, expect, it } from 'vitest'
import { formatMoney, formatNumber, formatPercent } from '~/shared/lib/format'

describe('formatNumber', () => {
  it('groups thousands with the es-ES separator', () => {
    expect(formatNumber(1234567)).toBe('1.234.567')
  })

  it('honors the max fraction digits', () => {
    expect(formatNumber(12.3456, 2)).toBe('12,35')
  })

  it('renders an em dash for null/undefined/non-finite', () => {
    expect(formatNumber(null)).toBe('—')
    expect(formatNumber(undefined)).toBe('—')
    expect(formatNumber(Number.NaN)).toBe('—')
    expect(formatNumber(Number.POSITIVE_INFINITY)).toBe('—')
  })
})

describe('formatMoney', () => {
  it('prefixes the in-game money symbol', () => {
    expect(formatMoney(1500)).toBe('$1.500')
  })

  it('supports fractional prices', () => {
    expect(formatMoney(0.337, 3)).toBe('$0,337')
  })

  it('renders an em dash for null', () => {
    expect(formatMoney(null)).toBe('—')
  })
})

describe('formatPercent', () => {
  it('renders a ratio as a percentage', () => {
    expect(formatPercent(0.425)).toBe('42,5 %')
  })

  it('renders an em dash for null', () => {
    expect(formatPercent(null)).toBe('—')
  })
})
