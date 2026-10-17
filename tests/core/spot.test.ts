import { describe, expect, it } from 'vitest';
import { computeSpot, forwardThrow, groundSpeed } from '../../src/core/spot';
import { FALL_MODELS, FORWARD_THROW_NO_WIND_M } from '../../src/core/constants';
import { ktToMs, msToKt } from '../../src/core/units';
import { magnitude, windToVector } from '../../src/core/vector';
import type { WindLayer } from '../../src/core/windProfile';

function uniformLayers(topFt: number, dirDeg: number, speedMs: number): WindLayer[] {
  const vec = windToVector(dirDeg, speedMs);
  const layers: WindLayer[] = [];
  for (let alt = 0; alt <= topFt; alt += 1000) {
    layers.push({ altAglFt: alt, u: vec.u, v: vec.v, dirDeg, speedKt: msToKt(speedMs), source: 'manual' });
  }
  return layers;
}

describe('computeSpot: no wind', () => {
  // spec.md 8.3: 無風：ドリフト0、Exit地点 = オープン位置 − 322m（ジャンプラン方向）
  it.each([1, 2] as const)('level %i: drift is zero and exit = open - forward throw along jump run', (level) => {
    const layers = uniformLayers(13000, 0, 0);
    const result = computeSpot(level, {
      layers,
      fallModel: FALL_MODELS.belly,
      exitAltFt: 13000,
      openAltFt: 3000,
      descentRateFtPerMin: 1000,
      jumpRunTrueBearingDeg: 90, // 東
      tasMs: ktToMs(85),
      openPosition: { u: 0, v: 0 },
    });

    expect(result.canopyDrift.u).toBeCloseTo(0, 6);
    expect(result.canopyDrift.v).toBeCloseTo(0, 6);
    expect(result.freefallDrift.u).toBeCloseTo(0, 6);
    expect(result.freefallDrift.v).toBeCloseTo(0, 6);
    expect(result.groundSpeedMs).toBeCloseTo(ktToMs(85), 6);
    expect(result.exitPosition.u).toBeCloseTo(-FORWARD_THROW_NO_WIND_M, 4);
    expect(result.exitPosition.v).toBeCloseTo(0, 6);
  });
});

describe('computeSpot: uniform wind', () => {
  it('Level 1 and Level 2 produce the same exit position', () => {
    const layers = uniformLayers(13500, 250, 12);
    const commonInputs = {
      layers,
      fallModel: FALL_MODELS.belly,
      exitAltFt: 13500,
      openAltFt: 3200,
      descentRateFtPerMin: 1000,
      jumpRunTrueBearingDeg: 310,
      tasMs: ktToMs(85),
      openPosition: { u: 0, v: 0 },
    };

    const r1 = computeSpot(1, commonInputs);
    const r2 = computeSpot(2, commonInputs);

    expect(r1.exitPosition.u).toBeCloseTo(r2.exitPosition.u, 3);
    expect(r1.exitPosition.v).toBeCloseTo(r2.exitPosition.v, 3);
  });
});

describe('computeSpot: auto open position', () => {
  it('defaults open position to -canopyDrift when not provided', () => {
    const layers = uniformLayers(13000, 270, 8);
    const result = computeSpot(1, {
      layers,
      fallModel: FALL_MODELS.belly,
      exitAltFt: 13000,
      openAltFt: 3000,
      descentRateFtPerMin: 1000,
      jumpRunTrueBearingDeg: 0,
      tasMs: ktToMs(85),
    });

    expect(result.openPosition.u).toBeCloseTo(-result.canopyDrift.u, 6);
    expect(result.openPosition.v).toBeCloseTo(-result.canopyDrift.v, 6);
  });
});

describe('groundSpeed / forwardThrow', () => {
  it('adds a tailwind component to TAS and scales forward throw accordingly', () => {
    const tas = ktToMs(85);
    const bearing = 90; // 東
    const tailwind = { u: 10, v: 0 }; // 東向きの流れ（追い風成分）
    const gs = groundSpeed(tailwind, bearing, tas);
    expect(gs).toBeCloseTo(tas + 10, 6);

    const t = forwardThrow(tailwind, bearing, tas);
    expect(magnitude(t)).toBeCloseTo(FORWARD_THROW_NO_WIND_M * (gs / tas), 6);
    expect(t.u).toBeGreaterThan(FORWARD_THROW_NO_WIND_M); // 追い風でスローが伸びる
  });

  it('subtracts a headwind component from TAS', () => {
    const tas = ktToMs(85);
    const bearing = 90;
    const headwind = { u: -10, v: 0 };
    const gs = groundSpeed(headwind, bearing, tas);
    expect(gs).toBeCloseTo(tas - 10, 6);
  });
});
