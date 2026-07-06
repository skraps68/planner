import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { formatCurrency } from './currencyFormat';

describe('formatCurrency', () => {
  it('should format positive numbers with dollar sign, thousand separators and no decimal places', () => {
    expect(formatCurrency(1234567.89)).toBe('$1,234,568');
    expect(formatCurrency(1000)).toBe('$1,000');
    expect(formatCurrency(999.99)).toBe('$1,000');
  });

  it('should format negative numbers with minus sign', () => {
    expect(formatCurrency(-1234.5)).toBe('-$1,235');
    expect(formatCurrency(-1000000)).toBe('-$1,000,000');
  });

  it('should format zero correctly', () => {
    expect(formatCurrency(0)).toBe('$0');
  });

  it('should round to whole dollars', () => {
    expect(formatCurrency(100)).toBe('$100');
    expect(formatCurrency(100.1)).toBe('$100');
    expect(formatCurrency(100.5)).toBe('$101');
    expect(formatCurrency(0.4)).toBe('$0');
  });

  it('should handle large numbers', () => {
    expect(formatCurrency(1000000000)).toBe('$1,000,000,000');
    expect(formatCurrency(999999999.99)).toBe('$1,000,000,000');
  });

  // Feature: portfolio-dashboard, Property 10: Currency Formatting Consistency
  it('property test: formatting includes dollar sign, thousand separators, whole dollars, and sign handling for any numeric value', () => {
    const numericValueArbitrary = fc.double({
      min: -1e12,
      max: 1e12,
      noNaN: true,
      noDefaultInfinity: true
    });

    fc.assert(
      fc.property(numericValueArbitrary, (value) => {
        const formatted = formatCurrency(value);

        // Result must be a string
        expect(typeof formatted).toBe('string');

        // No decimal places: nothing after a decimal point
        expect(formatted).not.toMatch(/\./);

        // Negative values have the minus sign before the dollar sign
        if (value <= -0.5) {
          expect(formatted).toMatch(/^-\$/);
        } else if (value >= 0) {
          expect(formatted).toMatch(/^\$/);
        }

        // Thousand separators for values >= 1000
        const digitsOnly = formatted.replace(/[-$,]/g, '');
        if (Math.abs(value) >= 1000) {
          expect(formatted).toContain(',');
        }

        // Parses back to (approximately) the rounded original
        const parsed = parseFloat(formatted.replace(/[$,]/g, ''));
        expect(isNaN(parsed)).toBe(false);
        expect(Math.abs(parsed - Math.round(value))).toBeLessThanOrEqual(1);

        // Sanity: digits survive the round trip
        expect(digitsOnly.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });
});
