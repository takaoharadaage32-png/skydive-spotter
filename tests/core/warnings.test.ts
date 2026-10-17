import { describe, expect, it } from 'vitest';
import {
  checkForecastTimeMismatchWarning,
  checkLevelDiffWarning,
  checkLowGsWarning,
} from '../../src/core/warnings';
import { ktToMs } from '../../src/core/units';

describe('checkLevelDiffWarning', () => {
  it('warns when the Level 1 / Level 2 exit points differ by more than 200m', () => {
    const warning = checkLevelDiffWarning({ u: 0, v: 0 }, { u: 250, v: 0 });
    expect(warning?.key).toBe('levelDiff');
  });

  it('does not warn when the difference is within 200m', () => {
    expect(checkLevelDiffWarning({ u: 0, v: 0 }, { u: 150, v: 0 })).toBeUndefined();
  });
});

describe('checkLowGsWarning', () => {
  it('warns when ground speed is below 40kt', () => {
    const warning = checkLowGsWarning(ktToMs(35));
    expect(warning?.key).toBe('lowGs');
  });

  it('does not warn at or above 40kt', () => {
    expect(checkLowGsWarning(ktToMs(45))).toBeUndefined();
  });
});

describe('checkForecastTimeMismatchWarning', () => {
  it('warns when the forecast time and jump time differ by 2 hours or more', () => {
    const warning = checkForecastTimeMismatchWarning('2026-01-01T10:00:00', '2026-01-01T13:00:00');
    expect(warning?.key).toBe('forecastMismatch');
  });

  it('does not warn for a small time difference', () => {
    expect(checkForecastTimeMismatchWarning('2026-01-01T10:00:00', '2026-01-01T11:00:00')).toBeUndefined();
  });
});
