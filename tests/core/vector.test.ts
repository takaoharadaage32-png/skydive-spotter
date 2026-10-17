import { describe, expect, it } from 'vitest';
import {
  add,
  average,
  bearingDistanceToVector,
  dot,
  lerpVec2,
  magnitude,
  scale,
  sub,
  unitVectorForBearing,
  vectorToBearingDistance,
  vectorToWind,
  windToVector,
} from '../../src/core/vector';

describe('windToVector / vectorToWind', () => {
  it('converts a northerly wind (blowing from the north) to a southward drift', () => {
    const vec = windToVector(0, 10);
    expect(vec.u).toBeCloseTo(0, 5);
    expect(vec.v).toBeCloseTo(-10, 5);
  });

  it('converts an easterly wind (blowing from the east) to a westward drift', () => {
    const vec = windToVector(90, 10);
    expect(vec.u).toBeCloseTo(-10, 5);
    expect(vec.v).toBeCloseTo(0, 5);
  });

  it('round-trips direction and speed', () => {
    for (const dir of [0, 45, 90, 135, 180, 225, 270, 315]) {
      const { dirDeg, speed } = vectorToWind(windToVector(dir, 12));
      expect(dirDeg).toBeCloseTo(dir, 5);
      expect(speed).toBeCloseTo(12, 5);
    }
  });

  it('treats a zero vector as calm (0 deg, 0 speed)', () => {
    expect(vectorToWind({ u: 0, v: 0 })).toEqual({ dirDeg: 0, speed: 0 });
  });

  it('averages 359 deg and 1 deg wind directions to near 0 deg, not 180 deg', () => {
    const v1 = windToVector(359, 10);
    const v2 = windToVector(1, 10);
    const { dirDeg } = vectorToWind(average([v1, v2]));
    const distanceFromZero = Math.min(dirDeg, 360 - dirDeg);
    expect(distanceFromZero).toBeLessThan(1);
  });
});

describe('vector arithmetic', () => {
  it('adds, subtracts and scales', () => {
    const a = { u: 1, v: 2 };
    const b = { u: 3, v: -1 };
    expect(add(a, b)).toEqual({ u: 4, v: 1 });
    expect(sub(a, b)).toEqual({ u: -2, v: 3 });
    expect(scale(a, 2)).toEqual({ u: 2, v: 4 });
  });

  it('computes dot product and magnitude', () => {
    expect(dot({ u: 1, v: 0 }, { u: 0, v: 1 })).toBe(0);
    expect(magnitude({ u: 3, v: 4 })).toBe(5);
  });

  it('builds a unit vector pointing toward a bearing', () => {
    const east = unitVectorForBearing(90);
    expect(east.u).toBeCloseTo(1, 5);
    expect(east.v).toBeCloseTo(0, 5);
  });
});

describe('vectorToBearingDistance / bearingDistanceToVector', () => {
  it('converts a position vector to bearing/distance and back', () => {
    for (const bearing of [0, 45, 90, 180, 270, 350]) {
      const vec = bearingDistanceToVector(bearing, 500);
      const { bearingDeg, distanceM } = vectorToBearingDistance(vec);
      expect(bearingDeg).toBeCloseTo(bearing, 5);
      expect(distanceM).toBeCloseTo(500, 5);
    }
  });

  it('treats the origin as bearing 0, distance 0', () => {
    expect(vectorToBearingDistance({ u: 0, v: 0 })).toEqual({ bearingDeg: 0, distanceM: 0 });
  });

  it('points east (90 deg) toward +u', () => {
    const vec = bearingDistanceToVector(90, 100);
    expect(vec.u).toBeCloseTo(100, 5);
    expect(vec.v).toBeCloseTo(0, 5);
  });
});

describe('lerpVec2', () => {
  it('interpolates linearly between two altitudes', () => {
    const v1 = { u: 0, v: 0 };
    const v2 = { u: 10, v: 20 };
    expect(lerpVec2(0, v1, 1000, v2, 500)).toEqual({ u: 5, v: 10 });
  });
});
