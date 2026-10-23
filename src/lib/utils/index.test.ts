import { describe, expect, it } from 'vitest';

import { usdcToStroops } from './index';

describe('usdcToStroops', () => {
  it('converts USDC amounts to stroops without losing precision', () => {
    expect(usdcToStroops('0')).toBe(0n);
    expect(usdcToStroops('1')).toBe(10_000_000n);
    expect(usdcToStroops('1.2')).toBe(12_000_000n);
    expect(usdcToStroops('0.0000001')).toBe(1n);
    expect(usdcToStroops('12.1234567')).toBe(121_234_567n);
  });

  it('rejects empty, negative, and malformed amounts with clear errors', () => {
    expect(() => usdcToStroops('')).toThrow(/cannot be empty/i);
    expect(() => usdcToStroops('-5')).toThrow(/must not be negative/i);
    expect(() => usdcToStroops('abc')).toThrow(/valid decimal number/i);
    expect(() => usdcToStroops('1.2.3')).toThrow(/valid decimal number/i);
  });

  it('rejects amounts with more than seven decimal places', () => {
    expect(() => usdcToStroops('0.00000001')).toThrow(
      /cannot have more than 7 decimal places/i,
    );
  });
});
