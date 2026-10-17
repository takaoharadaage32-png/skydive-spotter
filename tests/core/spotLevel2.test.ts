import { describe, expect, it } from 'vitest';
import { levelTwoCanopyDrift, levelTwoFreefallDrift } from '../../src/core/spotLevel2';
import { FALL_MODELS } from '../../src/core/constants';
import { timeBetween } from '../../src/core/fallModel';
import { add, magnitude, scale, windToVector, type Vec2 } from '../../src/core/vector';
import { ftToM, mileToM, msToKt } from '../../src/core/units';
import type { WindLayer } from '../../src/core/windProfile';

function uniformLayers(topFt: number, dirDeg: number, speedMs: number): WindLayer[] {
  const vec = windToVector(dirDeg, speedMs);
  const layers: WindLayer[] = [];
  for (let alt = 0; alt <= topFt; alt += 1000) {
    layers.push({ altAglFt: alt, u: vec.u, v: vec.v, dirDeg, speedKt: msToKt(speedMs), source: 'manual' });
  }
  return layers;
}

function twoLayerTable(windA: Vec2, windB: Vec2): WindLayer[] {
  return [
    { altAglFt: 0, u: windA.u, v: windA.v, dirDeg: 0, speedKt: 0, source: 'manual' },
    { altAglFt: 1000, u: windB.u, v: windB.v, dirDeg: 0, speedKt: 0, source: 'manual' },
  ];
}

describe('levelTwoCanopyDrift', () => {
  // spec.md 8.3: USPA例題。毎分1/4マイルの風で3,000ftから3分 → キャノピードリフト3/4マイル
  it('matches the USPA worked example (1/4 mile/min wind, 3000ft, 3min -> 3/4 mile drift)', () => {
    const speedMs = mileToM(0.25) / 60;
    const layers = uniformLayers(3000, 180, speedMs);
    const drift = levelTwoCanopyDrift(layers, 3000, 1000);
    expect(magnitude(drift)).toBeCloseTo(mileToM(0.75), 3);
  });

  it('apportions the top segment when openAltFt is not a multiple of 1000ft', () => {
    const windA: Vec2 = { u: 1, v: 0 };
    const windB: Vec2 = { u: 0, v: 2 };
    const layers = twoLayerTable(windA, windB);
    const descentRateFtPerMin = 1000;
    const openAltFt = 1500;

    const descentRateMs = ftToM(descentRateFtPerMin) / 60;
    const t1 = ftToM(500) / descentRateMs; // 1500ft -> 1000ft (windBでクランプ)
    const t2 = ftToM(1000) / descentRateMs; // 1000ft -> 0ft
    const expected = add(
      scale(windB, t1),
      scale({ u: (windA.u + windB.u) / 2, v: (windA.v + windB.v) / 2 }, t2),
    );

    const result = levelTwoCanopyDrift(layers, openAltFt, descentRateFtPerMin);
    expect(result.u).toBeCloseTo(expected.u, 5);
    expect(result.v).toBeCloseTo(expected.v, 5);
  });
});

describe('levelTwoFreefallDrift', () => {
  it('apportions the top and bottom segments when exit/open altitudes are not multiples of 1000ft', () => {
    const windA: Vec2 = { u: 2, v: 0 };
    const windB: Vec2 = { u: 0, v: 3 };
    const layers = twoLayerTable(windA, windB);
    const model = FALL_MODELS.belly;
    const exitAltFt = 1500;
    const openAltFt = 0;

    const t1 = timeBetween(model, exitAltFt, 1500, 1000); // windBでクランプされた区間
    const t2 = timeBetween(model, exitAltFt, 1000, 0);
    const expected = add(
      scale(windB, t1),
      scale({ u: (windA.u + windB.u) / 2, v: (windA.v + windB.v) / 2 }, t2),
    );

    const result = levelTwoFreefallDrift(layers, model, exitAltFt, openAltFt);
    expect(result.u).toBeCloseTo(expected.u, 5);
    expect(result.v).toBeCloseTo(expected.v, 5);
  });
});
