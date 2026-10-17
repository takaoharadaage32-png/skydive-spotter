// 風テーブルの生成（spec.md 4.2・4.3）
//
// 気圧面・地上風などの生の観測点（RawWindPoint）から、0ftからExit高度まで
// 1,000ftごとに (u, v) を線形補間した WindLayer の配列（風テーブル）を作る。
// 風向は直接補間せず、必ず (u, v) に分解してから補間する（359°/1°問題の回避）。

import { msToKt } from './units';
import { lerpVec2, vectorToWind, windToVector, type Vec2 } from './vector';

export interface RawWindPoint {
  altAglM: number; // AGL高度 m
  dirDeg: number; // 吹いてくる方向（真方位）
  speedMs: number; // 風速 m/s
  source: 'forecast' | 'manual';
}

export interface WindLayer {
  altAglFt: number; // 0, 1000, 2000, …
  u: number; // 流される向き 東成分 m/s
  v: number; // 流される向き 北成分 m/s
  dirDeg: number; // 表示用：吹いてくる方向（真方位。表示時に磁方位へ変換）
  speedKt: number; // 表示用
  source: 'forecast' | 'manual';
}

export interface WindProfile {
  validTime: string; // ISO8601
  model: string; // 例 "jma_msm"
  dzElevationM: number;
  layers: WindLayer[];
}

/**
 * 気圧面データ（海抜高度 mslM）を DZ標高から AGL高度に変換し、
 * AGLが負（地中）になる面を捨てる（spec 4.2 手順2）。
 */
export function toAglPoints(
  points: { mslM: number; dirDeg: number; speedMs: number }[],
  dzElevationM: number,
): RawWindPoint[] {
  return points
    .map((p) => ({
      altAglM: p.mslM - dzElevationM,
      dirDeg: p.dirDeg,
      speedMs: p.speedMs,
      source: 'forecast' as const,
    }))
    .filter((p) => p.altAglM >= 0);
}

interface AltVec {
  altFt: number;
  vec: Vec2;
  source: 'forecast' | 'manual';
}

function interpolateAt(points: AltVec[], altFt: number): Vec2 {
  // 最下点より低い高度は、データがないため最下点の値をそのまま使う（外挿も平均もしない）。
  if (altFt <= points[0].altFt) {
    return points[0].vec;
  }
  for (let i = 0; i < points.length - 1; i++) {
    const lo = points[i];
    const hi = points[i + 1];
    if (altFt >= lo.altFt && altFt <= hi.altFt) {
      return lerpVec2(lo.altFt, lo.vec, hi.altFt, hi.vec, altFt);
    }
  }
  // 呼び出し側で topGridFt <= topAltFt を保証しているため、ここには到達しない想定
  throw new Error(`interpolateAt: altitude ${altFt}ft is outside the available data range`);
}

function sourceAt(points: AltVec[], altFt: number): 'forecast' | 'manual' {
  if (altFt <= points[0].altFt) {
    return points[0].source;
  }
  for (let i = 0; i < points.length - 1; i++) {
    const lo = points[i];
    const hi = points[i + 1];
    if (altFt >= lo.altFt && altFt <= hi.altFt) {
      return lo.source === 'manual' && hi.source === 'manual' ? 'manual' : 'forecast';
    }
  }
  return 'forecast';
}

/**
 * 生の観測点から、0ftからExit高度まで1,000ftごとの風テーブルを作る（spec 4.2 手順3〜6）。
 * Exit高度が最上点の高度を超える場合はエラーを投げる（外挿はしない）。
 */
export function buildWindTable(rawPoints: RawWindPoint[], exitAltFt: number): WindLayer[] {
  if (rawPoints.length === 0) {
    throw new Error('buildWindTable: rawPoints must not be empty');
  }

  const points: AltVec[] = [...rawPoints]
    .sort((a, b) => a.altAglM - b.altAglM)
    .map((p) => ({
      altFt: p.altAglM / 0.3048,
      vec: windToVector(p.dirDeg, p.speedMs),
      source: p.source,
    }));

  const topAltFt = points[points.length - 1].altFt;
  const topGridFt = Math.ceil(exitAltFt / 1000) * 1000;
  if (topGridFt > topAltFt) {
    throw new Error(
      `buildWindTable: Exit高度 ${exitAltFt}ft が風データの範囲外です（最上点 ${topAltFt.toFixed(0)}ft）`,
    );
  }

  const layers: WindLayer[] = [];
  for (let altFt = 0; altFt <= topGridFt; altFt += 1000) {
    const vec = interpolateAt(points, altFt);
    const { dirDeg, speed } = vectorToWind(vec);
    layers.push({
      altAglFt: altFt,
      u: vec.u,
      v: vec.v,
      dirDeg,
      speedKt: msToKt(speed),
      source: sourceAt(points, altFt),
    });
  }
  return layers;
}

/**
 * 風テーブルの任意の高度（ft）における (u, v) を、隣接する層から線形補間して返す。
 * テーブルの範囲外は端点の値でクランプする（spot.ts でExit/オープン高度の風を引くために使う）。
 */
export function vectorAt(layers: WindLayer[], altFt: number): Vec2 {
  const sorted = [...layers].sort((a, b) => a.altAglFt - b.altAglFt);
  const bottom = sorted[0];
  const top = sorted[sorted.length - 1];
  if (altFt <= bottom.altAglFt) {
    return { u: bottom.u, v: bottom.v };
  }
  if (altFt >= top.altAglFt) {
    return { u: top.u, v: top.v };
  }
  for (let i = 0; i < sorted.length - 1; i++) {
    const lo = sorted[i];
    const hi = sorted[i + 1];
    if (altFt >= lo.altAglFt && altFt <= hi.altAglFt) {
      return lerpVec2(lo.altAglFt, { u: lo.u, v: lo.v }, hi.altAglFt, { u: hi.u, v: hi.v }, altFt);
    }
  }
  throw new Error(`vectorAt: altitude ${altFt}ft is outside the available data range`);
}

export function buildWindProfile(params: {
  validTime: string;
  model: string;
  dzElevationM: number;
  rawPoints: RawWindPoint[];
  exitAltFt: number;
}): WindProfile {
  return {
    validTime: params.validTime,
    model: params.model,
    dzElevationM: params.dzElevationM,
    layers: buildWindTable(params.rawPoints, params.exitAltFt),
  };
}
