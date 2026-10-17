import { describe, expect, it } from 'vitest';
import { buildWindProfile, buildWindTable, toAglPoints, type RawWindPoint } from '../../src/core/windProfile';
import { lerpVec2, windToVector } from '../../src/core/vector';
import { ftToM, mToFt, msToKt } from '../../src/core/units';

describe('toAglPoints', () => {
  // spec.md 8.3: 気圧面の地中除外（DZ標高が1000hPaの高度より高い場合）
  it('drops levels whose AGL altitude is negative (underground)', () => {
    const dzElevationM = 600;
    const result = toAglPoints(
      [
        { mslM: 500, dirDeg: 270, speedMs: 10 }, // AGL -100 -> 地中、除外
        { mslM: 700, dirDeg: 270, speedMs: 12 }, // AGL 100
        { mslM: 1200, dirDeg: 280, speedMs: 15 }, // AGL 600
      ],
      dzElevationM,
    );

    expect(result).toHaveLength(2);
    expect(result[0].altAglM).toBeCloseTo(100, 5);
    expect(result[1].altAglM).toBeCloseTo(600, 5);
    expect(result.every((p) => p.source === 'forecast')).toBe(true);
  });
});

describe('buildWindTable', () => {
  const samplePoints: RawWindPoint[] = [
    { altAglM: 10, dirDeg: 270, speedMs: 5, source: 'forecast' },
    { altAglM: 1000, dirDeg: 280, speedMs: 10, source: 'forecast' },
    { altAglM: 4500, dirDeg: 300, speedMs: 20, source: 'forecast' },
  ];

  it('builds a layer every 1000ft from 0 up to the exit altitude', () => {
    const layers = buildWindTable(samplePoints, 13000);
    expect(layers).toHaveLength(14); // 0, 1000, ..., 13000
    expect(layers[0].altAglFt).toBe(0);
    expect(layers[layers.length - 1].altAglFt).toBe(13000);
  });

  it('clamps altitudes below the lowest data point to that point (no extrapolation/averaging)', () => {
    const layers = buildWindTable(samplePoints, 2000);
    const ground = layers.find((l) => l.altAglFt === 0)!;
    expect(ground.dirDeg).toBeCloseTo(270, 5);
    expect(ground.speedKt).toBeCloseTo(msToKt(5), 5);
  });

  it('interpolates (u, v) linearly between bracketing data points', () => {
    const layers = buildWindTable(samplePoints, 13000);
    const layer = layers.find((l) => l.altAglFt === 5000)!;

    const lo = { altFt: mToFt(1000), vec: windToVector(280, 10) };
    const hi = { altFt: mToFt(4500), vec: windToVector(300, 20) };
    const expectedVec = lerpVec2(lo.altFt, lo.vec, hi.altFt, hi.vec, 5000);

    expect(layer.u).toBeCloseTo(expectedVec.u, 5);
    expect(layer.v).toBeCloseTo(expectedVec.v, 5);
  });

  it('produces a uniform table when the wind is the same at every input point', () => {
    const uniform: RawWindPoint[] = [
      { altAglM: 10, dirDeg: 250, speedMs: 15, source: 'forecast' },
      { altAglM: 2000, dirDeg: 250, speedMs: 15, source: 'forecast' },
      { altAglM: 5000, dirDeg: 250, speedMs: 15, source: 'forecast' },
    ];
    const layers = buildWindTable(uniform, 13000);
    const expectedVec = windToVector(250, 15);
    for (const layer of layers) {
      expect(layer.u).toBeCloseTo(expectedVec.u, 5);
      expect(layer.v).toBeCloseTo(expectedVec.v, 5);
    }
  });

  it('marks a layer as manual only when both bracketing points are manual overrides', () => {
    const mixed: RawWindPoint[] = [
      { altAglM: 10, dirDeg: 270, speedMs: 5, source: 'manual' },
      { altAglM: 1000, dirDeg: 270, speedMs: 5, source: 'manual' },
      { altAglM: 4500, dirDeg: 300, speedMs: 20, source: 'forecast' },
    ];
    const layers = buildWindTable(mixed, 4000);
    const belowBothManual = layers.find((l) => l.altAglFt === 1000)!;
    const betweenManualAndForecast = layers.find((l) => l.altAglFt === 4000)!;

    expect(belowBothManual.source).toBe('manual');
    expect(betweenManualAndForecast.source).toBe('forecast');
  });

  it('throws when the exit altitude exceeds the topmost data point (no extrapolation above)', () => {
    const limited: RawWindPoint[] = [
      { altAglM: 10, dirDeg: 270, speedMs: 5, source: 'forecast' },
      { altAglM: ftToM(2000), dirDeg: 270, speedMs: 10, source: 'forecast' },
    ];
    expect(() => buildWindTable(limited, 13000)).toThrow();
  });

  it('throws for an empty point list', () => {
    expect(() => buildWindTable([], 13000)).toThrow();
  });
});

describe('buildWindProfile', () => {
  it('wraps the layer table with profile metadata', () => {
    const profile = buildWindProfile({
      validTime: '2026-01-01T00:00:00Z',
      model: 'jma_msm',
      dzElevationM: 50,
      rawPoints: [
        { altAglM: 10, dirDeg: 270, speedMs: 5, source: 'forecast' },
        { altAglM: 4500, dirDeg: 300, speedMs: 20, source: 'forecast' },
      ],
      exitAltFt: 13000,
    });

    expect(profile.model).toBe('jma_msm');
    expect(profile.dzElevationM).toBe(50);
    expect(profile.layers).toHaveLength(14);
  });
});
