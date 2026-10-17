// open-meteo Forecast API からの風データ取得と変換（spec.md 4.1・4.2 手順1〜2）
//
// 非商用の無料枠で使う。画面には必ず「Weather data by Open-Meteo.com」の帰属表示を出すこと（4.1）。

import { buildWindProfile, toAglPoints, type RawWindPoint, type WindProfile } from '../core/windProfile';

const GROUND_LEVELS_M = [10, 80, 120, 180] as const;
const PRESSURE_LEVELS_HPA = [1000, 975, 950, 925, 900, 850, 800, 700, 600, 500] as const;

function buildHourlyVarList(): string[] {
  const vars: string[] = [];
  for (const m of GROUND_LEVELS_M) {
    vars.push(`wind_speed_${m}m`, `wind_direction_${m}m`);
  }
  for (const p of PRESSURE_LEVELS_HPA) {
    vars.push(`wind_speed_${p}hPa`, `wind_direction_${p}hPa`, `geopotential_height_${p}hPa`);
  }
  return vars;
}

export function buildForecastUrl(params: { latitude: number; longitude: number }): string {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(params.latitude));
  url.searchParams.set('longitude', String(params.longitude));
  url.searchParams.set('hourly', buildHourlyVarList().join(','));
  url.searchParams.set('wind_speed_unit', 'ms');
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('forecast_days', '2');
  return url.toString();
}

export interface OpenMeteoHourly {
  time: string[];
  [variable: string]: string[] | number[];
}

export interface OpenMeteoResponse {
  elevation: number;
  hourly: OpenMeteoHourly;
}

/** hourly.time のうち、指定時刻に最も近いインデックスを返す（spec 4.2 手順1） */
export function selectNearestHourIndex(times: string[], targetTime: Date): number {
  if (times.length === 0) {
    throw new Error('selectNearestHourIndex: times must not be empty');
  }
  let bestIndex = 0;
  let bestDiffMs = Infinity;
  times.forEach((t, i) => {
    const diffMs = Math.abs(new Date(t).getTime() - targetTime.getTime());
    if (diffMs < bestDiffMs) {
      bestDiffMs = diffMs;
      bestIndex = i;
    }
  });
  return bestIndex;
}

function numberAt(hourly: OpenMeteoHourly, variable: string, index: number): number | undefined {
  const series = hourly[variable];
  const value = series?.[index];
  return typeof value === 'number' ? value : undefined;
}

/** open-meteo のレスポンス（1時刻分）を RawWindPoint[] に変換する（spec 4.2 手順2〜3） */
export function parseWindPoints(
  hourly: OpenMeteoHourly,
  hourIndex: number,
  dzElevationM: number,
): RawWindPoint[] {
  const points: RawWindPoint[] = [];

  for (const m of GROUND_LEVELS_M) {
    const speedMs = numberAt(hourly, `wind_speed_${m}m`, hourIndex);
    const dirDeg = numberAt(hourly, `wind_direction_${m}m`, hourIndex);
    if (speedMs !== undefined && dirDeg !== undefined) {
      points.push({ altAglM: m, dirDeg, speedMs, source: 'forecast' });
    }
  }

  const pressurePoints: { mslM: number; dirDeg: number; speedMs: number }[] = [];
  for (const p of PRESSURE_LEVELS_HPA) {
    const speedMs = numberAt(hourly, `wind_speed_${p}hPa`, hourIndex);
    const dirDeg = numberAt(hourly, `wind_direction_${p}hPa`, hourIndex);
    const mslM = numberAt(hourly, `geopotential_height_${p}hPa`, hourIndex);
    if (speedMs !== undefined && dirDeg !== undefined && mslM !== undefined) {
      pressurePoints.push({ mslM, dirDeg, speedMs });
    }
  }
  points.push(...toAglPoints(pressurePoints, dzElevationM));

  return points;
}

export interface FetchWindProfileParams {
  latitude: number;
  longitude: number;
  jumpTime: Date;
  exitAltFt: number;
  /** DZ標高の手動上書き（省略時は open-meteo の elevation を使う） */
  dzElevationM?: number;
}

/**
 * open-meteo から風データを取得し、WindProfile に変換する。
 * open-meteo のレスポンスは「使用モデル名」を返さないため、model は固定文字列にする。
 */
export async function fetchWindProfile(params: FetchWindProfileParams): Promise<WindProfile> {
  const url = buildForecastUrl(params);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`open-meteo request failed: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as OpenMeteoResponse;

  const hourIndex = selectNearestHourIndex(data.hourly.time, params.jumpTime);
  const validTime = data.hourly.time[hourIndex];
  const dzElevationM = params.dzElevationM ?? data.elevation;
  const rawPoints = parseWindPoints(data.hourly, hourIndex, dzElevationM);

  return buildWindProfile({
    validTime,
    model: 'open-meteo (auto)',
    dzElevationM,
    rawPoints,
    exitAltFt: params.exitAltFt,
  });
}
