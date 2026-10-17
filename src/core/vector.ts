// 風向⇔(u,v) 変換とベクトル演算（spec.md 2章・4.2）
//
// Vec2 は東(+)・北(+) 成分 (u, v) を持つ平面ベクトル。方位はすべて真方位（度、北=0、時計回り）。
//
// 風は (u, v) に分解してから補間・平均する。風向を直接平均すると
// 359°と1°の平均が180°になってしまうため（6.1 風向の境界参照）。

export interface Vec2 {
  u: number; // 東成分
  v: number; // 北成分
}

function deg2rad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function rad2deg(rad: number): number {
  return (rad * 180) / Math.PI;
}

function normalizeDeg(deg: number): number {
  const mod = deg % 360;
  return mod < 0 ? mod + 360 : mod;
}

/**
 * 気象風（吹いてくる方向 dirDeg・風速 speed）をドリフトベクトル (u, v) に変換する。
 * u = -V sin θ, v = -V cos θ
 */
export function windToVector(dirDeg: number, speed: number): Vec2 {
  const theta = deg2rad(dirDeg);
  return {
    u: -speed * Math.sin(theta),
    v: -speed * Math.cos(theta),
  };
}

/**
 * ドリフトベクトル (u, v) から気象風（吹いてくる方向・風速）を逆算する。
 * 無風ベクトル（u=v=0）の方位は 0 とする。
 */
export function vectorToWind(vec: Vec2): { dirDeg: number; speed: number } {
  const speed = Math.hypot(vec.u, vec.v);
  if (speed === 0) {
    return { dirDeg: 0, speed: 0 };
  }
  const dirDeg = normalizeDeg(rad2deg(Math.atan2(-vec.u, -vec.v)));
  return { dirDeg, speed };
}

/**
 * ある方位（真方位）へ進む向きの単位ベクトルを返す。
 * 風の「吹いてくる方向」とは符号が逆（こちらは「進む方向」）であることに注意。
 */
export function unitVectorForBearing(bearingDeg: number): Vec2 {
  const theta = deg2rad(bearingDeg);
  return { u: Math.sin(theta), v: Math.cos(theta) };
}

export function add(a: Vec2, b: Vec2): Vec2 {
  return { u: a.u + b.u, v: a.v + b.v };
}

export function sub(a: Vec2, b: Vec2): Vec2 {
  return { u: a.u - b.u, v: a.v - b.v };
}

export function scale(a: Vec2, k: number): Vec2 {
  return { u: a.u * k, v: a.v * k };
}

export function dot(a: Vec2, b: Vec2): number {
  return a.u * b.u + a.v * b.v;
}

export function magnitude(a: Vec2): number {
  return Math.hypot(a.u, a.v);
}

/**
 * ベクトルの単純平均（Level 1 の層平均に使う）。
 */
export function average(vectors: Vec2[]): Vec2 {
  if (vectors.length === 0) {
    throw new Error('average: vectors must not be empty');
  }
  const sum = vectors.reduce((acc, v) => add(acc, v), { u: 0, v: 0 });
  return scale(sum, 1 / vectors.length);
}

/**
 * 位置ベクトル (u, v)（ターゲット原点、東・北 m）を、ターゲットからの方位・距離に変換する。
 * 「進む方向」と同じ符号規約（unitVectorForBearing の逆関数）。無風ならぬ無位置（原点）は方位0とする。
 */
export function vectorToBearingDistance(vec: Vec2): { bearingDeg: number; distanceM: number } {
  const distanceM = magnitude(vec);
  if (distanceM === 0) {
    return { bearingDeg: 0, distanceM: 0 };
  }
  const bearingDeg = normalizeDeg(rad2deg(Math.atan2(vec.u, vec.v)));
  return { bearingDeg, distanceM };
}

/**
 * ターゲットからの方位・距離から位置ベクトル (u, v) を作る。
 */
export function bearingDistanceToVector(bearingDeg: number, distanceM: number): Vec2 {
  return scale(unitVectorForBearing(bearingDeg), distanceM);
}

/**
 * 高度 h における (u, v) を、2点間の線形補間で求める。
 * h1Alt <= h <= h2Alt を想定（外挿はしない呼び出し側の責務）。
 */
export function lerpVec2(
  h1Alt: number,
  v1: Vec2,
  h2Alt: number,
  v2: Vec2,
  h: number,
): Vec2 {
  if (h2Alt === h1Alt) {
    return v1;
  }
  const t = (h - h1Alt) / (h2Alt - h1Alt);
  return add(v1, scale(sub(v2, v1), t));
}
