import { describe, expect, it } from 'vitest';
import { latLonToOffset, offsetLatLon } from '../../src/core/geo';

describe('offsetLatLon / latLonToOffset', () => {
  it('round-trips an offset through lat/lon and back', () => {
    const origin = { lat: 35.3, lon: 139.4 };
    const offset = { u: 450, v: -820 };
    const { lat, lon } = offsetLatLon(origin.lat, origin.lon, offset);
    const back = latLonToOffset(origin.lat, origin.lon, lat, lon);
    expect(back.u).toBeCloseTo(offset.u, 3);
    expect(back.v).toBeCloseTo(offset.v, 3);
  });

  it('moving ~111.32km north increases latitude by ~1 degree', () => {
    const { lat, lon } = offsetLatLon(35, 139, { u: 0, v: 111_320 });
    expect(lat).toBeCloseTo(36, 2);
    expect(lon).toBeCloseTo(139, 5);
  });

  it('moving east increases longitude more at low latitude than high latitude', () => {
    const eastAtEquator = offsetLatLon(0, 0, { u: 10_000, v: 0 });
    const eastAtHighLat = offsetLatLon(60, 0, { u: 10_000, v: 0 });
    expect(eastAtEquator.lon).toBeLessThan(eastAtHighLat.lon);
  });

  it('zero offset returns the origin', () => {
    const { lat, lon } = offsetLatLon(35.3, 139.4, { u: 0, v: 0 });
    expect(lat).toBeCloseTo(35.3, 6);
    expect(lon).toBeCloseTo(139.4, 6);
  });
});
