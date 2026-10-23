import { describe, expect, it } from 'vitest';

import { timerPillClass, usdcToStroops } from './index';

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

describe('timerPillClass', () => {
  it('returns the approaching class for non-unlockable timers with three days or less remaining', () => {
    expect(timerPillClass(3, false)).toBe('timer-approaching');
    expect(timerPillClass(1, false)).toBe('timer-approaching');
  });

  it('returns the active class for timers with more than three days remaining', () => {
    expect(timerPillClass(4, false)).toBe('timer-active');
  });

  it('returns the ready class when unlockable or the countdown has elapsed', () => {
    expect(timerPillClass(3, true)).toBe('timer-ready');
    expect(timerPillClass(0, false)).toBe('timer-ready');
  });
});
