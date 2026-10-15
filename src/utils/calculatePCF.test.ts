import { describe, expect, it } from 'vitest';
import { calculatePCF } from './calculatePCF';

describe('calculatePCF logic', () => {
  it('calculates PCF correctly when pallets is 0', () => {
    // volume = (40 * 48 * 60) / 1728 = 66.6667
    // PCF = 1000 / 66.6667 = 15.00
    const result = calculatePCF(40, 48, 60, 1000, 0);
    expect(result).toBe('15.00');
  });

  it('calculates PCF correctly when pallets > 0', () => {
    // volume = 66.6667
    // weight per pallet = 1000 / 2 = 500
    // PCF = 500 / 66.6667 = 7.50
    const result = calculatePCF(40, 48, 60, 1000, 2);
    expect(result).toBe('7.50');
  });

  it('calculates PCF correctly when pallets is 1', () => {
    // volume = 66.6667
    // weight per pallet = 1000 / 1 = 1000
    // PCF = 1000 / 66.6667 = 15.00
    const result = calculatePCF('40', '48', '60', '1000', '1');
    expect(result).toBe('15.00');
  });

  it('handles empty or undefined pallets as pallet 0', () => {
    const result = calculatePCF(40, 48, 60, 1000, '');
    expect(result).toBe('15.00');
  });

  it('returns empty string if length, width, or height is missing or 0', () => {
    expect(calculatePCF(0, 48, 60, 1000, 1)).toBe('');
    expect(calculatePCF('', 48, 60, 1000, 1)).toBe('');
    expect(calculatePCF(40, 0, 60, 1000, 1)).toBe('');
    expect(calculatePCF(40, 48, 0, 1000, 1)).toBe('');
    expect(calculatePCF(undefined, 48, 60, 1000, 1)).toBe('');
  });

  it('returns empty string if weight is missing or 0', () => {
    expect(calculatePCF(40, 48, 60, 0, 1)).toBe('');
    expect(calculatePCF(40, 48, 60, '', 1)).toBe('');
    expect(calculatePCF(40, 48, 60, undefined, 1)).toBe('');
  });

  it('formats decimals to 2 decimal places', () => {
    // volume = (48 * 40 * 48) / 1728 = 53.3333...
    // wt = 500, pallet = 1 => 500 / 53.3333... = 9.375 => 9.38
    expect(calculatePCF(48, 40, 48, 500, 1)).toBe('9.38');
  });

  it('shows precise decimals for very small PCF instead of 0.00', () => {
    // 48 x 43 x 65, weight = 60, pallets = 10000 => ~0.00007728
    const result = calculatePCF(48, 43, 65, 60, 10000);
    expect(result).toBe('0.00007728');
    expect(result).not.toBe('0.00');
  });
});
