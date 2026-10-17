import { describe, expect, it } from 'vitest';
import { ftToM, mToFt, ktToMs, msToKt, mphToMs, msToMph, mileToM, mToMile } from '../../src/core/units';

describe('units', () => {
  it('converts ft <-> m', () => {
    expect(ftToM(1000)).toBeCloseTo(304.8, 5);
    expect(mToFt(ftToM(13000))).toBeCloseTo(13000, 5);
  });

  it('converts kt <-> m/s', () => {
    expect(ktToMs(1)).toBeCloseTo(0.514444, 6);
    expect(msToKt(ktToMs(85))).toBeCloseTo(85, 5);
  });

  it('converts mph <-> m/s', () => {
    expect(mphToMs(120)).toBeCloseTo(53.6448, 4);
    expect(msToMph(mphToMs(160))).toBeCloseTo(160, 5);
  });

  it('converts mile <-> m', () => {
    expect(mileToM(0.2)).toBeCloseTo(321.8688, 4);
    expect(mToMile(mileToM(1))).toBeCloseTo(1, 5);
  });
});
