import { describe, expect, it } from 'vitest';
import { getDeclination, magneticToTrue, trueToMagnetic } from '../../src/core/magnetic';

describe('trueToMagnetic / magneticToTrue', () => {
  // spec.md 8.3: 偏角8°Wのとき真方位270° → 278°M、入力278°M → 内部270°
  it('converts true 270 deg to magnetic 278 deg with 8 deg west declination', () => {
    expect(trueToMagnetic(270, -8)).toBeCloseTo(278, 5);
  });

  it('converts magnetic 278 deg back to true 270 deg with 8 deg west declination', () => {
    expect(magneticToTrue(278, -8)).toBeCloseTo(270, 5);
  });

  it('wraps around 0/360', () => {
    expect(trueToMagnetic(5, -8)).toBeCloseTo(13, 5);
    expect(magneticToTrue(355, 8)).toBeCloseTo(3, 5);
  });
});

describe('getDeclination', () => {
  it('returns a westward (negative) declination for Tokyo, matching spec 2.1', () => {
    const decl = getDeclination(35.6762, 139.6503, new Date('2026-01-01'));
    expect(decl).toBeLessThan(0);
    expect(decl).toBeGreaterThan(-15);
  });
});
