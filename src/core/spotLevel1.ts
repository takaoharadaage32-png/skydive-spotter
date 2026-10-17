// Level 1：USPA簡易方式（spec.md 6.2）
//
// フリーフォール：Exit高度〜オープン高度の層をベクトル平均し、フリーフォール時間をかける。
// キャノピー：0〜オープン高度の層をベクトル平均し、降下時間（オープン高度÷降下率）をかける。

import { timeBetween, type FallModel } from './fallModel';
import { average, scale, type Vec2 } from './vector';
import type { WindLayer } from './windProfile';

function layersBetween(layers: WindLayer[], lowFt: number, highFt: number): Vec2[] {
  return layers
    .filter((l) => l.altAglFt >= lowFt && l.altAglFt <= highFt)
    .map((l) => ({ u: l.u, v: l.v }));
}

export function levelOneCanopyDrift(
  layers: WindLayer[],
  openAltFt: number,
  descentRateFtPerMin: number,
): Vec2 {
  const avgWind = average(layersBetween(layers, 0, openAltFt));
  const descentTimeS = (openAltFt / descentRateFtPerMin) * 60;
  return scale(avgWind, descentTimeS);
}

export function levelOneFreefallDrift(
  layers: WindLayer[],
  fallModel: FallModel,
  exitAltFt: number,
  openAltFt: number,
): Vec2 {
  const avgWind = average(layersBetween(layers, openAltFt, exitAltFt));
  const freefallTimeS = timeBetween(fallModel, exitAltFt, exitAltFt, openAltFt);
  return scale(avgWind, freefallTimeS);
}
