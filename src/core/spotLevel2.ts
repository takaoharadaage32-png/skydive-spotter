// Level 2：層別計算（spec.md 6.3）
//
// 1,000ftごとの層iについて、その層にいる時間Δt_iを求め、層の風（上端・下端の平均）を
// かけて足し合わせる。層の境界にExit高度・オープン高度がかかる場合はその層を按分する。

import { timeBetween, type FallModel } from './fallModel';
import { add, average, scale, type Vec2 } from './vector';
import { ftToM } from './units';
import { vectorAt, type WindLayer } from './windProfile';

/**
 * topFt から bottomFt まで、1,000ft刻みの境界高度を降順で返す。
 * topFt・bottomFt が1,000ftの倍数でない場合は、そこで按分される部分境界になる。
 */
function altBoundaries(topFt: number, bottomFt: number): number[] {
  if (topFt <= bottomFt) {
    throw new Error('altBoundaries: topFt must be > bottomFt');
  }
  const boundaries = [topFt];
  let next = Math.floor(topFt / 1000) * 1000;
  if (next >= topFt) {
    next -= 1000;
  }
  while (next > bottomFt) {
    boundaries.push(next);
    next -= 1000;
  }
  boundaries.push(bottomFt);
  return boundaries;
}

function sumOverSegments(
  layers: WindLayer[],
  topFt: number,
  bottomFt: number,
  durationS: (hiFt: number, loFt: number) => number,
): Vec2 {
  const boundaries = altBoundaries(topFt, bottomFt);
  let total: Vec2 = { u: 0, v: 0 };
  for (let i = 0; i < boundaries.length - 1; i++) {
    const hiFt = boundaries[i];
    const loFt = boundaries[i + 1];
    const dt = durationS(hiFt, loFt);
    const w = average([vectorAt(layers, hiFt), vectorAt(layers, loFt)]);
    total = add(total, scale(w, dt));
  }
  return total;
}

export function levelTwoFreefallDrift(
  layers: WindLayer[],
  fallModel: FallModel,
  exitAltFt: number,
  openAltFt: number,
): Vec2 {
  return sumOverSegments(layers, exitAltFt, openAltFt, (hiFt, loFt) =>
    timeBetween(fallModel, exitAltFt, hiFt, loFt),
  );
}

export function levelTwoCanopyDrift(
  layers: WindLayer[],
  openAltFt: number,
  descentRateFtPerMin: number,
): Vec2 {
  const descentRateMs = ftToM(descentRateFtPerMin) / 60;
  return sumOverSegments(layers, openAltFt, 0, (hiFt, loFt) => ftToM(hiFt - loFt) / descentRateMs);
}
