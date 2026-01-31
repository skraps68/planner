/**
 * Formats a numeric value as USD currency with dollar sign, thousand separators and two decimal places.
 * 
 * @param value - The numeric value to format
 * @returns Formatted currency string with dollar sign, thousand separators and 2 decimal places
 * 
 * @example
 * formatCurrency(1234567.89) // Returns "$1,234,567.89"
 * formatCurrency(-1234.5) // Returns "-$1,234.50"
 * formatCurrency(0) // Returns "$0.00"
 */
export function formatCurrency(value: number): string {
  // Handle negative values by preserving the sign
  const isNegative = value < 0;
  const absoluteValue = Math.abs(value);
  
  // Format with two decimal places and thousand separators
  const formatted = absoluteValue.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  
  // Add dollar sign and minus sign for negative values
  return isNegative ? `-$${formatted}` : `$${formatted}`;
}
