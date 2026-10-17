// 位置ベクトル (u, v)（ターゲット原点、東・北 m）と緯度経度の相互変換（地図表示用）
//
// 正距円筒近似（equirectangular）。Exit地点などはターゲットから数km以内のため、
// この近似で地図表示には十分な精度になる（厳密な測地線計算はしない）。

import type { Vec2 } from './vector';

const METERS_PER_DEG_LAT = 111_320;

function metersPerDegLon(latDeg: number): number {
  return METERS_PER_DEG_LAT * Math.cos((latDeg * Math.PI) / 180);
}

/** ターゲット緯度経度 + オフセット(u=東, v=北, m) から緯度経度を求める */
export function offsetLatLon(originLat: number, originLon: number, offset: Vec2): { lat: number; lon: number } {
  const lat = originLat + offset.v / METERS_PER_DEG_LAT;
  const lon = originLon + offset.u / metersPerDegLon(originLat);
  return { lat, lon };
}

/** 緯度経度からターゲットを原点とするオフセット(u, v, m) を求める（offsetLatLon の逆関数） */
export function latLonToOffset(originLat: number, originLon: number, lat: number, lon: number): Vec2 {
  return {
    u: (lon - originLon) * metersPerDegLon(originLat),
    v: (lat - originLat) * METERS_PER_DEG_LAT,
  };
}
