import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { formatCurrency } from './currencyFormat';

describe('formatCurrency', () => {
  it('should format positive numbers with thousand separators and two decimal places', () => {
    expect(formatCurrency(1234567.89)).toBe('1,234,567.89');
    expect(formatCurrency(1000)).toBe('1,000.00');
    expect(formatCurrency(999.99)).toBe('999.99');
  });

  it('should format negative numbers with minus sign', () => {
    expect(formatCurrency(-1234.5)).toBe('-1,234.50');
    expect(formatCurrency(-1000000)).toBe('-1,000,000.00');
    expect(formatCurrency(-0.01)).toBe('-0.01');
  });

  it('should format zero correctly', () => {
    expect(formatCurrency(0)).toBe('0.00');
  });

  it('should always display exactly two decimal places', () => {
    expect(formatCurrency(100)).toBe('100.00');
    expect(formatCurrency(100.1)).toBe('100.10');
    expect(formatCurrency(100.123)).toBe('100.12');
  });

  it('should handle large numbers', () => {
    expect(formatCurrency(1000000000)).toBe('1,000,000,000.00');
    expect(formatCurrency(999999999.99)).toBe('999,999,999.99');
  });

  it('should handle small decimal values', () => {
    expect(formatCurrency(0.01)).toBe('0.01');
    expect(formatCurrency(0.99)).toBe('0.99');
    expect(formatCurrency(0.001)).toBe('0.00');
  });

  // Feature: portfolio-dashboard, Property 10: Currency Formatting Consistency
  // Validates: Requirements 7.1, 7.2, 7.3, 7.4
  it('property test: formatting includes thousand separators, two decimals, and consistent styling for any numeric value', () => {
    // Generate arbitrary numeric values including positive, negative, zero, and edge cases
    const numericValueArbitrary = fc.double({
      min: -1e12,
      max: 1e12,
      noNaN: true,
      noDefaultInfinity: true
    });

    fc.assert(
      fc.property(numericValueArbitrary, (value) => {
        const formatted = formatCurrency(value);

        // Property 1: Result must be a string
        expect(typeof formatted).toBe('string');

        // Property 2: Must have exactly two decimal places (Requirements 7.2)
        // Check that the string ends with a decimal point followed by exactly 2 digits
        const decimalMatch = formatted.match(/\.(\d+)$/);
        expect(decimalMatch).not.toBeNull();
        expect(decimalMatch![1].length).toBe(2);

        // Property 3: Must have thousand separators for values >= 1000 (Requirements 7.1)
        // Remove the minus sign if present for checking absolute value
        const absoluteFormatted = formatted.replace('-', '');
        const absoluteValue = Math.abs(value);
        
        if (absoluteValue >= 1000) {
          // Should contain at least one comma
          expect(absoluteFormatted).toContain(',');
          
          // Verify comma placement: commas should appear every 3 digits from the right
          // Extract the integer part (before the decimal point)
          const integerPart = absoluteFormatted.split('.')[0];
          
          // If the integer part has more than 3 digits, it should have commas
          if (integerPart.replace(/,/g, '').length > 3) {
            expect(integerPart).toContain(',');
          }
        }

        // Property 4: Negative values must have minus sign prefix (Requirements 7.3, 7.4)
        if (value < 0) {
          expect(formatted).toMatch(/^-/);
        } else {
          expect(formatted).not.toMatch(/^-/);
        }

        // Property 5: Consistent formatting - can be parsed back to a number
        // Remove commas and parse to verify it's a valid number format
        const numericString = formatted.replace(/,/g, '');
        const parsedValue = parseFloat(numericString);
        expect(isNaN(parsedValue)).toBe(false);

        // Property 6: The parsed value should be close to the original (within rounding tolerance)
        // Account for rounding to 2 decimal places
        const roundedOriginal = Math.round(value * 100) / 100;
        const epsilon = 0.01; // Allow for rounding differences
        expect(Math.abs(parsedValue - roundedOriginal)).toBeLessThan(epsilon);
      }),
      { numRuns: 100 }
    );
  });
});
