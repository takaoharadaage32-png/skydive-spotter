import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildForecastUrl,
  fetchWindProfile,
  parseWindPoints,
  selectNearestHourIndex,
  type OpenMeteoHourly,
  type OpenMeteoResponse,
} from '../../src/api/openMeteo';
import sampleResponse from '../fixtures/openMeteoSample.json';

describe('buildForecastUrl', () => {
  it('includes the required query parameters from spec 4.1', () => {
    const url = new URL(buildForecastUrl({ latitude: 35.3, longitude: 139.4 }));
    expect(url.origin + url.pathname).toBe('https://api.open-meteo.com/v1/forecast');
    expect(url.searchParams.get('latitude')).toBe('35.3');
    expect(url.searchParams.get('longitude')).toBe('139.4');
    expect(url.searchParams.get('wind_speed_unit')).toBe('ms');
    expect(url.searchParams.get('timezone')).toBe('auto');
    expect(url.searchParams.get('forecast_days')).toBe('2');

    const hourly = url.searchParams.get('hourly')!;
    expect(hourly).toContain('wind_speed_10m');
    expect(hourly).toContain('wind_direction_180m');
    expect(hourly).toContain('wind_speed_500hPa');
    expect(hourly).toContain('wind_direction_500hPa');
    expect(hourly).toContain('geopotential_height_1000hPa');
  });
});

describe('selectNearestHourIndex', () => {
  const times = ['2026-01-01T00:00', '2026-01-01T01:00', '2026-01-01T02:00'];

  it('picks the closest hour', () => {
    expect(selectNearestHourIndex(times, new Date('2026-01-01T01:20'))).toBe(1);
    expect(selectNearestHourIndex(times, new Date('2026-01-01T01:40'))).toBe(2);
  });

  it('throws for an empty time list', () => {
    expect(() => selectNearestHourIndex([], new Date())).toThrow();
  });
});

describe('parseWindPoints', () => {
  it('extracts ground and pressure-level points, dropping underground pressure levels', () => {
    const hourly: OpenMeteoHourly = {
      time: ['2026-01-01T00:00'],
      wind_speed_10m: [5],
      wind_direction_10m: [270],
      wind_speed_80m: [8],
      wind_direction_80m: [275],
      wind_speed_120m: [9],
      wind_direction_120m: [280],
      wind_speed_180m: [10],
      wind_direction_180m: [285],
      wind_speed_1000hPa: [12],
      wind_direction_1000hPa: [290],
      geopotential_height_1000hPa: [50], // DZ標高600mより低い -> 除外される
      wind_speed_975hPa: [15],
      wind_direction_975hPa: [295],
      geopotential_height_975hPa: [900],
    };

    const points = parseWindPoints(hourly, 0, 600);

    expect(points).toHaveLength(5); // 地上4点 + 975hPa（1000hPaは地中なので除外）
    expect(points.find((p) => p.altAglM === 10)).toMatchObject({ dirDeg: 270, speedMs: 5 });
    expect(points.find((p) => p.altAglM === 180)).toMatchObject({ dirDeg: 285, speedMs: 10 });
    const pressurePoint = points.find((p) => p.source === 'forecast' && p.altAglM === 300);
    expect(pressurePoint).toMatchObject({ dirDeg: 295, speedMs: 15 }); // 900 - 600
    expect(points.some((p) => p.altAglM === -550)).toBe(false);
  });
});

describe('fetchWindProfile', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('converts a real saved open-meteo response into a WindProfile (snapshot-style)', async () => {
    const response = sampleResponse as unknown as OpenMeteoResponse;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => response,
    });
    vi.stubGlobal('fetch', fetchMock);

    const jumpTime = new Date(response.hourly.time[13]); // 固定サンプルの13時台
    const profile = await fetchWindProfile({
      latitude: 35.3,
      longitude: 139.4,
      jumpTime,
      exitAltFt: 13000,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(profile.validTime).toBe(response.hourly.time[13]);
    expect(profile.dzElevationM).toBe(response.elevation);
    expect(profile.layers).toHaveLength(14); // 0〜13000ft
    expect(profile.layers[0].altAglFt).toBe(0);
    expect(profile.layers[profile.layers.length - 1].altAglFt).toBe(13000);
    for (const layer of profile.layers) {
      expect(Number.isFinite(layer.u)).toBe(true);
      expect(Number.isFinite(layer.v)).toBe(true);
      expect(layer.speedKt).toBeGreaterThanOrEqual(0);
    }
  });

  it('throws a descriptive error when the request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: 'Internal Server Error' }),
    );

    await expect(
      fetchWindProfile({ latitude: 35.3, longitude: 139.4, jumpTime: new Date(), exitAltFt: 13000 }),
    ).rejects.toThrow(/500/);
  });
});
