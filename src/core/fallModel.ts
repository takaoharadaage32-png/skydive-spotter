// 落下モデル（spec.md 5章）
//
// 「加速区間＋一定速度」の2段で近似する。Exit直後の accelDropFt（AGL ft）を
// accelTimeS 秒かけて平均速度で落ち、それより下は終端速度 terminalMs で落ちるとみなす。

import { ftToM } from './units';

export interface FallModel {
  name: string;
  terminalMs: number; // 終端速度 m/s
  accelTimeS: number; // 加速区間の時間（秒）。暫定値 10
  accelDropFt: number; // 加速区間の高度差（ft）。暫定値 1000
}

/**
 * 高度 h1 → h2（AGL, ft。h1 > h2）の落下に要する時間（秒）を返す。
 * exitFt からの落下を前提とし、Exit直後の accelDropFt 分だけ加速区間として扱う。
 */
export function timeBetween(model: FallModel, exitFt: number, h1: number, h2: number): number {
  if (h1 < h2) {
    throw new Error('timeBetween: h1 must be >= h2');
  }
  if (h1 === h2) {
    return 0;
  }

  const accelBottomFt = exitFt - model.accelDropFt;
  const avgAccelSpeedMs = ftToM(model.accelDropFt) / model.accelTimeS;

  let timeS = 0;

  // 加速区間（accelBottomFt より上）にかかる部分
  const accelSegTop = h1;
  const accelSegBottom = Math.max(h2, accelBottomFt);
  if (accelSegTop > accelSegBottom) {
    timeS += ftToM(accelSegTop - accelSegBottom) / avgAccelSpeedMs;
  }

  // 終端速度区間（accelBottomFt より下）にかかる部分
  const termSegTop = Math.min(h1, accelBottomFt);
  const termSegBottom = h2;
  if (termSegTop > termSegBottom) {
    timeS += ftToM(termSegTop - termSegBottom) / model.terminalMs;
  }

  return timeS;
}
