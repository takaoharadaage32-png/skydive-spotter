// Exit地点計算の全体の流れ（spec.md 6.1・6.4）
//
// P_exit = P_open − D_ff − T。P_open 未入力なら P_open = −D_canopy とする。
// グループ間隔・Exitウィンドウ（6.5）と警告（6.7）はここでは扱わない（8.4 手順8）。

import { FORWARD_THROW_NO_WIND_M } from './constants';
import type { FallModel } from './fallModel';
import { levelOneCanopyDrift, levelOneFreefallDrift } from './spotLevel1';
import { levelTwoCanopyDrift, levelTwoFreefallDrift } from './spotLevel2';
import { dot, scale, sub, unitVectorForBearing, type Vec2 } from './vector';
import { vectorAt, type WindLayer } from './windProfile';

export type SpotLevel = 1 | 2;

export interface SpotInputs {
  layers: WindLayer[];
  fallModel: FallModel;
  exitAltFt: number;
  openAltFt: number;
  descentRateFtPerMin: number;
  jumpRunTrueBearingDeg: number; // 真方位
  tasMs: number; // 対気速度 m/s
  /** オープン位置（ターゲット原点、東=u・北=v、m）。未入力なら -D_canopy を自動計算する */
  openPosition?: Vec2;
}

export interface SpotResult {
  canopyDrift: Vec2;
  openPosition: Vec2;
  freefallDrift: Vec2;
  forwardThrow: Vec2;
  groundSpeedMs: number;
  exitPosition: Vec2;
}

/** GS = TAS + w_exit・r̂（spec 6.4・6.5で共通して使う） */
export function groundSpeed(windAtExit: Vec2, jumpRunTrueBearingDeg: number, tasMs: number): number {
  const rHat = unitVectorForBearing(jumpRunTrueBearingDeg);
  return tasMs + dot(windAtExit, rHat);
}

/** T = 322m × (GS / TAS) × r̂（spec 6.4） */
export function forwardThrow(windAtExit: Vec2, jumpRunTrueBearingDeg: number, tasMs: number): Vec2 {
  const rHat = unitVectorForBearing(jumpRunTrueBearingDeg);
  const gs = groundSpeed(windAtExit, jumpRunTrueBearingDeg, tasMs);
  return scale(rHat, FORWARD_THROW_NO_WIND_M * (gs / tasMs));
}

export function computeSpot(level: SpotLevel, inputs: SpotInputs): SpotResult {
  const canopyDrift =
    level === 1
      ? levelOneCanopyDrift(inputs.layers, inputs.openAltFt, inputs.descentRateFtPerMin)
      : levelTwoCanopyDrift(inputs.layers, inputs.openAltFt, inputs.descentRateFtPerMin);

  const openPosition = inputs.openPosition ?? scale(canopyDrift, -1);

  const freefallDrift =
    level === 1
      ? levelOneFreefallDrift(inputs.layers, inputs.fallModel, inputs.exitAltFt, inputs.openAltFt)
      : levelTwoFreefallDrift(inputs.layers, inputs.fallModel, inputs.exitAltFt, inputs.openAltFt);

  const windAtExit = vectorAt(inputs.layers, inputs.exitAltFt);
  const groundSpeedMs = groundSpeed(windAtExit, inputs.jumpRunTrueBearingDeg, inputs.tasMs);
  const throwVec = forwardThrow(windAtExit, inputs.jumpRunTrueBearingDeg, inputs.tasMs);

  const exitPosition = sub(sub(openPosition, freefallDrift), throwVec);

  return {
    canopyDrift,
    openPosition,
    freefallDrift,
    forwardThrow: throwVec,
    groundSpeedMs,
    exitPosition,
  };
}
