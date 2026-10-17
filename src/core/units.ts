// 単位換算（spec.md 2章）
// 内部計算はSI単位（m, m/s）。表示のときだけ ft / kt / マイル に変換する。

export const FT_TO_M = 0.3048;
export const KT_TO_MS = 0.514444;
export const MPH_TO_MS = 0.44704;
export const MILE_TO_M = 1609.344;

export function ftToM(ft: number): number {
  return ft * FT_TO_M;
}

export function mToFt(m: number): number {
  return m / FT_TO_M;
}

export function ktToMs(kt: number): number {
  return kt * KT_TO_MS;
}

export function msToKt(ms: number): number {
  return ms / KT_TO_MS;
}

export function mphToMs(mph: number): number {
  return mph * MPH_TO_MS;
}

export function msToMph(ms: number): number {
  return ms / MPH_TO_MS;
}

export function mileToM(mile: number): number {
  return mile * MILE_TO_M;
}

export function mToMile(m: number): number {
  return m / MILE_TO_M;
}
