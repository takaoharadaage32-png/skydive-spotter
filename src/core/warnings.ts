// 警告条件（spec.md 6.7）
//
// 「Exit高度が風データの範囲外」は計算不可（エラー）として別途扱うため、ここには含めない。
// しきい値はすべて暫定値（constants.ts の WARNING_THRESHOLDS）。

import { WARNING_THRESHOLDS } from './constants';
import { msToKt } from './units';
import { magnitude, sub, type Vec2 } from './vector';

export interface Warning {
  key: string;
  message: string;
}

/** Level 1 と Level 2 のExit地点の差が大きい（風のシアが大きい） */
export function checkLevelDiffWarning(level1Exit: Vec2, level2Exit: Vec2): Warning | undefined {
  const diffM = magnitude(sub(level1Exit, level2Exit));
  if (diffM > WARNING_THRESHOLDS.levelDiffM) {
    return {
      key: 'levelDiff',
      message: `Level 1とLevel 2のExit地点の差が${Math.round(diffM)}mあります。風のシアが大きい日です。Level 2を優先してください。`,
    };
  }
  return undefined;
}

/** 対地速度（GS）が弱い（上空の向かい風が強い） */
export function checkLowGsWarning(groundSpeedMs: number): Warning | undefined {
  const gsKt = msToKt(groundSpeedMs);
  if (gsKt < WARNING_THRESHOLDS.minGsKt) {
    return {
      key: 'lowGs',
      message: `対地速度（GS）が${Math.round(gsKt)}ktと弱く、上空の向かい風が強い状態です。グループ間隔を広げてください。`,
    };
  }
  return undefined;
}

/** 予報時刻とジャンプ予定時刻が大きくずれている */
export function checkForecastTimeMismatchWarning(validTimeIso: string, jumpTimeIso: string): Warning | undefined {
  const diffHours = Math.abs(new Date(validTimeIso).getTime() - new Date(jumpTimeIso).getTime()) / 3_600_000;
  if (diffHours >= WARNING_THRESHOLDS.forecastTimeMismatchHours) {
    return {
      key: 'forecastMismatch',
      message: `予報時刻とジャンプ予定時刻が${diffHours.toFixed(1)}時間ずれています。風の再取得をおすすめします。`,
    };
  }
  return undefined;
}
