// 表示単位への変換・整形ヘルパー（spec.md 2.1・7.3）

import { ftToM, mToFt, mToMile, mileToM, msToKt, ktToMs } from '../core/units';
import type { DisplayUnits } from './types';

export function formatAltitude(altFt: number, unit: DisplayUnits['altitude']): string {
  if (unit === 'm') {
    return `${Math.round(ftToM(altFt)).toLocaleString('ja-JP')} m`;
  }
  return `${Math.round(altFt).toLocaleString('ja-JP')} ft`;
}

export function formatDistance(distanceM: number, unit: DisplayUnits['distance']): string {
  if (unit === 'mile') {
    return `${mToMile(distanceM).toFixed(2)} mi`;
  }
  return `${Math.round(distanceM).toLocaleString('ja-JP')} m`;
}

export function formatSpeed(speedMs: number, unit: DisplayUnits['speed']): string {
  if (unit === 'ms') {
    return `${speedMs.toFixed(1)} m/s`;
  }
  return `${Math.round(msToKt(speedMs))} kt`;
}

export function formatBearingMag(bearingMagDeg: number): string {
  const rounded = Math.round(bearingMagDeg) % 360;
  return `${String(rounded).padStart(3, '0')}°M`;
}

export { ftToM, mToFt, mileToM, ktToMs };
