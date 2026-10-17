// 暫定値をまとめた定数ファイル（CLAUDE.md「進め方」参照）。
// ここにある数値は USPA SIM 6-3 等との照合前の暫定値。変更しやすいようここに集約する。

import { mileToM, mphToMs } from './units';
import type { FallModel } from './fallModel';

export const FALL_MODELS: Record<string, FallModel> = {
  belly: { name: 'ベリー', terminalMs: mphToMs(120), accelTimeS: 10, accelDropFt: 1000 },
  freefly: { name: 'フリーフライ', terminalMs: mphToMs(160), accelTimeS: 10, accelDropFt: 1000 },
  studentAff: { name: '学生AFF', terminalMs: mphToMs(120), accelTimeS: 10, accelDropFt: 1000 },
  tandem: { name: 'タンデム（ドローグ）', terminalMs: mphToMs(120), accelTimeS: 10, accelDropFt: 1000 },
};

// 無風時のForward throw（spec.md 6.4）。暫定値 0.2 マイル。
export const FORWARD_THROW_NO_WIND_M = mileToM(0.2);

// グループ間隔の必要距離（spec.md 6.5）。大グループの加算量はDZ設定にする値だが、
// 本体にその設定UIがまだ無いため、ここに暫定値として置く。
export const SEPARATION = {
  soloFt: 1000,
  smallGroupFt: 1500,
  smallGroupMaxSize: 4, // これ以下の人数を「小グループ」とみなす
  extraFtPerPersonAboveSmall: 150, // 大グループ：小グループを超えた1人ごとに加算（暫定値）
};

// 警告条件のしきい値（spec.md 6.7）。暫定値。
export const WARNING_THRESHOLDS = {
  levelDiffM: 200,
  minGsKt: 40,
  forecastTimeMismatchHours: 2,
};
