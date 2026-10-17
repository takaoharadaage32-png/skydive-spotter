import { describe, expect, it } from 'vitest';
import { levelOneCanopyDrift, levelOneFreefallDrift } from '../../src/core/spotLevel1';
import { FALL_MODELS } from '../../src/core/constants';
import { magnitude, windToVector } from '../../src/core/vector';
import { mileToM, msToKt } from '../../src/core/units';
import type { WindLayer } from '../../src/core/windProfile';

function uniformLayers(topFt: number, dirDeg: number, speedMs: number): WindLayer[] {
  const vec = windToVector(dirDeg, speedMs);
  const layers: WindLayer[] = [];
  for (let alt = 0; alt <= topFt; alt += 1000) {
    layers.push({ altAglFt: alt, u: vec.u, v: vec.v, dirDeg, speedKt: msToKt(speedMs), source: 'manual' });
  }
  return layers;
}

describe('levelOneCanopyDrift', () => {
  // spec.md 8.3: USPA例題。毎分1/4マイルの風で3,000ftから3分 → キャノピードリフト3/4マイル
  it('matches the USPA worked example (1/4 mile/min wind, 3000ft, 3min -> 3/4 mile drift)', () => {
    const speedMs = mileToM(0.25) / 60;
    const layers = uniformLayers(3000, 180, speedMs);
    const drift = levelOneCanopyDrift(layers, 3000, 1000); // 1000ft/min descent => 3 min
    expect(magnitude(drift)).toBeCloseTo(mileToM(0.75), 3);
  });

  it('is zero when there is no wind', () => {
    const layers = uniformLayers(3000, 0, 0);
    const drift = levelOneCanopyDrift(layers, 3000, 1000);
    expect(drift.u).toBeCloseTo(0, 6);
    expect(drift.v).toBeCloseTo(0, 6);
  });
});

describe('levelOneFreefallDrift', () => {
  it('scales with the average wind over [openAltFt, exitAltFt] and the freefall time', () => {
    const dirDeg = 270;
    const speedMs = 10;
    const layers = uniformLayers(13000, dirDeg, speedMs);
    const drift = levelOneFreefallDrift(layers, FALL_MODELS.belly, 13000, 3000);

    const expectedVec = windToVector(dirDeg, speedMs);
    const freefallTimeS =
      FALL_MODELS.belly.accelTimeS + (((13000 - 3000) - FALL_MODELS.belly.accelDropFt) * 0.3048) / FALL_MODELS.belly.terminalMs;

    expect(drift.u).toBeCloseTo(expectedVec.u * freefallTimeS, 2);
    expect(drift.v).toBeCloseTo(expectedVec.v * freefallTimeS, 2);
  });
});
