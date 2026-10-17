// 真方位⇔磁方位の変換（spec.md 2.1）
//
// 磁方位 = 真方位 − 偏角（東偏を正）。日本は西偏（declination < 0）なので、
// 磁方位は真方位より数値が大きくなる。
//
// 偏角は WMM（世界磁気モデル）で、ターゲットの緯度経度と日付から計算する。
// 設定画面での手動上書きは、計算済みの declination を使わず、ユーザー入力値を
// そのまま trueToMagnetic / magneticToTrue に渡すことで実現する（呼び出し側の責務）。

import geomagnetism from 'geomagnetism';

function normalizeDeg(deg: number): number {
  const mod = deg % 360;
  return mod < 0 ? mod + 360 : mod;
}

/** 真方位 → 磁方位 */
export function trueToMagnetic(trueDeg: number, declinationDeg: number): number {
  return normalizeDeg(trueDeg - declinationDeg);
}

/** 磁方位 → 真方位 */
export function magneticToTrue(magDeg: number, declinationDeg: number): number {
  return normalizeDeg(magDeg + declinationDeg);
}

/**
 * WMM によって緯度経度・日付（省略時は現在日時）から偏角（度、東偏が正）を計算する。
 * altitudeKm は海抜高度（km）、省略時は 0。
 */
export function getDeclination(
  lat: number,
  lon: number,
  date: Date = new Date(),
  altitudeKm = 0,
): number {
  const model = geomagnetism.model(date, { allowOutOfBoundsModel: true });
  const info = model.point([lat, lon, altitudeKm]);
  return info.decl;
}
