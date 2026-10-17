import { describe, expect, it } from 'vitest';
import { timeBetween } from '../../src/core/fallModel';
import { ftToM } from '../../src/core/units';
import { FALL_MODELS } from '../../src/core/constants';

describe('timeBetween', () => {
  const belly = FALL_MODELS.belly;

  it('returns 0 for an identical start/end altitude', () => {
    expect(timeBetween(belly, 13000, 12000, 12000)).toBe(0);
  });

  it('throws if h1 < h2', () => {
    expect(() => timeBetween(belly, 13000, 11000, 12000)).toThrow();
  });

  it('computes time entirely within the acceleration zone', () => {
    // 1000ft の加速区間を10秒で落ちる想定なので、その半分の500ftなら5秒
    const t = timeBetween(belly, 13000, 13000, 12500);
    expect(t).toBeCloseTo(5, 5);
  });

  it('computes time entirely within the terminal-velocity zone', () => {
    const expected = ftToM(1000) / belly.terminalMs;
    const t = timeBetween(belly, 13000, 11000, 10000);
    expect(t).toBeCloseTo(expected, 5);
  });

  it('computes time spanning both the acceleration and terminal zones', () => {
    const expected = belly.accelTimeS + ftToM(1000) / belly.terminalMs;
    const t = timeBetween(belly, 13000, 13000, 11000);
    expect(t).toBeCloseTo(expected, 5);
  });
});
