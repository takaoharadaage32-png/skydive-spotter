import { describe, expect, it } from 'vitest';
import {
  computeGroupExits,
  requiredSeparationFt,
  sortGroupsStandardOrder,
  type GroupInput,
} from '../../src/core/groups';
import { ftToM, ktToMs } from '../../src/core/units';
import { magnitude, sub, unitVectorForBearing } from '../../src/core/vector';

describe('requiredSeparationFt', () => {
  it('returns 1000ft for a solo jumper', () => {
    expect(requiredSeparationFt(1)).toBe(1000);
  });

  it('returns 1500ft for a small group (2-4 people)', () => {
    expect(requiredSeparationFt(2)).toBe(1500);
    expect(requiredSeparationFt(4)).toBe(1500);
  });

  it('adds extra distance per person beyond the small-group size', () => {
    const base = requiredSeparationFt(4);
    const bigger = requiredSeparationFt(6);
    expect(bigger).toBeGreaterThan(base);
  });
});

describe('sortGroupsStandardOrder', () => {
  it('orders by SIM 4-7 discipline sequence, then by headcount descending within a discipline', () => {
    const groups: GroupInput[] = [
      { id: 'tandem1', label: 'タンデム', headcount: 1, discipline: 'tandem' },
      { id: 'belly-small', label: 'ベリー小', headcount: 2, discipline: 'belly' },
      { id: 'movement1', label: 'ムーブメント1', headcount: 8, discipline: 'movement1' },
      { id: 'belly-large', label: 'ベリー大', headcount: 8, discipline: 'belly' },
      { id: 'aff1', label: 'AFF', headcount: 2, discipline: 'aff' },
    ];

    const sorted = sortGroupsStandardOrder(groups);

    expect(sorted.map((g) => g.id)).toEqual(['movement1', 'belly-large', 'belly-small', 'aff1', 'tandem1']);
  });
});

describe('computeGroupExits', () => {
  // spec.md 8.3: Exitウィンドウ：先頭グループのExit地点がP_exitと一致する
  it('places the lead group exactly at P_exit with zero interval', () => {
    const leadExit = { u: 120, v: -340 };
    const groups: GroupInput[] = [{ id: 'g1', label: 'FS 4人', headcount: 4, discipline: 'belly' }];

    const result = computeGroupExits(groups, leadExit, 270, ktToMs(60));

    expect(result[0].intervalS).toBe(0);
    expect(result[0].exitPosition).toEqual(leadExit);
  });

  it('places following groups along the jump run direction, spaced by interval * GS', () => {
    const leadExit = { u: 0, v: 0 };
    const bearing = 90; // 東
    const gsMs = ktToMs(60);
    const groups: GroupInput[] = [
      { id: 'g1', label: 'FS 4人', headcount: 4, discipline: 'belly' },
      { id: 'g2', label: 'FF 2人', headcount: 2, discipline: 'freefly' },
    ];

    const result = computeGroupExits(groups, leadExit, bearing, gsMs);

    const expectedIntervalS = Math.ceil(ftToM(requiredSeparationFt(2)) / gsMs);
    expect(result[1].intervalS).toBe(expectedIntervalS);

    const rHat = unitVectorForBearing(bearing);
    const expectedDistanceM = expectedIntervalS * gsMs;
    expect(result[1].exitPosition.u).toBeCloseTo(rHat.u * expectedDistanceM, 5);
    expect(result[1].exitPosition.v).toBeCloseTo(rHat.v * expectedDistanceM, 5);
  });

  it('accumulates distance across more than two groups', () => {
    const leadExit = { u: 0, v: 0 };
    const bearing = 0; // 北
    const gsMs = ktToMs(50);
    const groups: GroupInput[] = [
      { id: 'g1', label: 'タンデム', headcount: 1, discipline: 'tandem' },
      { id: 'g2', label: 'FS 4人', headcount: 4, discipline: 'belly' },
      { id: 'g3', label: 'FS 4人', headcount: 4, discipline: 'belly' },
    ];

    const result = computeGroupExits(groups, leadExit, bearing, gsMs);

    const d1 = magnitude(sub(result[1].exitPosition, leadExit));
    const d2 = magnitude(sub(result[2].exitPosition, leadExit));
    expect(d2).toBeGreaterThan(d1);
    expect(d1).toBeCloseTo(result[1].intervalS * gsMs, 3);
    expect(d2).toBeCloseTo((result[1].intervalS + result[2].intervalS) * gsMs, 3);
  });
});
