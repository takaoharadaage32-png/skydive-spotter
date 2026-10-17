// 結果画面の地図表示（spec.md 7.2）
//
// 背景地図は国土地理院の地理院タイル（標準地図・シームレス空中写真）。出典表示を必ず出す。
// ターゲットを原点とする位置ベクトルを、正距円筒近似（core/geo.ts）で緯度経度に変換して重ねる。

import { useEffect, useState } from 'react';
import { Circle, MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { offsetLatLon } from '../core/geo';
import { trueToMagnetic } from '../core/magnetic';
import { bearingDistanceToVector, scale, sub, unitVectorForBearing, vectorToBearingDistance, type Vec2 } from '../core/vector';
import type { WindLayer } from '../core/windProfile';

export type MapType = 'std' | 'photo' | 'none';

const GSI_ATTRIBUTION =
  '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener noreferrer">出典：国土地理院（地理院タイル）</a>';

const TILE_URLS: Record<Exclude<MapType, 'none'>, string> = {
  std: 'https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png',
  photo: 'https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg',
};

function dotIcon(color: string, size = 16, ring?: string): L.DivIcon {
  const border = ring ? `2px solid ${ring}` : '2px solid #ffffff';
  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:${border};box-shadow:0 0 0 1px rgba(0,0,0,0.15)"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

const TARGET_ICON = dotIcon('#15191e', 14);
const OPEN_ICON = dotIcon('#ffffff', 14, '#15191e');
const LOCATE_ICON = dotIcon('#1d4ed8', 12);

/** グループのExit点（先頭以外）：番号付きの小さな丸 */
function groupIcon(order: number): L.DivIcon {
  const size = 20;
  const html = `<div style="width:${size}px;height:${size}px;border-radius:50%;background:#15191e;border:2px solid #ffffff;box-shadow:0 0 0 1px rgba(0,0,0,0.15);display:flex;align-items:center;justify-content:center;color:#fff;font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700">${order}</div>`;
  return L.divIcon({ className: '', html, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
}

/** 層の風を示す矢羽根（矢印は風に流される向き＝吹いてくる方向+180°） */
function windBarbIcon(dirMagDeg: number, speedKt: number, altFt: number): L.DivIcon {
  const rotation = (Math.round(dirMagDeg) + 180) % 360;
  const dirLabel = String(Math.round(dirMagDeg)).padStart(3, '0');
  const html = `<div style="display:inline-flex;align-items:center;gap:4px;background:#ffffff;border:1px solid #D9DCD6;border-radius:8px;padding:2px 6px;box-shadow:0 1px 2px rgba(0,0,0,0.15);white-space:nowrap;font-family:'IBM Plex Mono',monospace;font-size:10px;line-height:1;color:#15191E">
    <svg width="13" height="13" viewBox="0 0 22 22" style="transform:rotate(${rotation}deg);flex:none" aria-hidden="true">
      <path d="M11 18V4M6 9L11 4L16 9" fill="none" stroke="#15191E" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <span>${altFt.toLocaleString('en-US')}ft ${dirLabel}°M ${Math.round(speedKt)}kt</span>
  </div>`;
  return L.divIcon({ className: '', html, iconSize: [150, 22], iconAnchor: [4, 11] });
}

interface FitBoundsProps {
  points: [number, number][];
}

function FitBounds({ points }: FitBoundsProps) {
  const map = useMap();
  // points は毎レンダーで新しい配列になるため、中身の値をキーにして
  // 「実際に位置が変わったとき」だけ fitBounds し直す（手動ズーム・パンを壊さない）
  const key = points.map((p) => `${p[0].toFixed(6)},${p[1].toFixed(6)}`).join('|');
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 15);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [28, 28] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);
  return null;
}

function FlyToLocation({ position }: { position: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.flyTo(position, Math.max(map.getZoom(), 15));
    }
  }, [map, position]);
  return null;
}

interface Props {
  targetLat: number;
  targetLon: number;
  openPosition?: Vec2;
  exitLevel1?: Vec2;
  exitLevel2?: Vec2;
  selectedLevel: 1 | 2;
  jumpRunTrueBearingDeg: number;
  windLayers?: WindLayer[];
  declinationDeg: number;
  /** 先頭グループ以降のExit点（先頭＝選択中Levelの Exit地点と一致するため別途描画しない） */
  groupExits?: { id: string; exitPosition: Vec2 }[];
}

export default function MapView({
  targetLat,
  targetLon,
  openPosition,
  exitLevel1,
  exitLevel2,
  selectedLevel,
  groupExits,
  jumpRunTrueBearingDeg,
  windLayers,
  declinationDeg,
}: Props) {
  const [mapType, setMapType] = useState<MapType>('std');
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locateError, setLocateError] = useState<string | null>(null);
  const [showWindBarbs, setShowWindBarbs] = useState(true);

  const targetPos: [number, number] = [targetLat, targetLon];
  const openPos = openPosition ? offsetLatLon(targetLat, targetLon, openPosition) : undefined;
  const exit1Pos = exitLevel1 ? offsetLatLon(targetLat, targetLon, exitLevel1) : undefined;
  const exit2Pos = exitLevel2 ? offsetLatLon(targetLat, targetLon, exitLevel2) : undefined;

  const selectedExitVec = selectedLevel === 1 ? exitLevel1 : exitLevel2;
  const selectedExitPos = selectedLevel === 1 ? exit1Pos : exit2Pos;
  const otherExitPos = selectedLevel === 1 ? exit2Pos : exit1Pos;

  // 先頭（index 0）は選択中Levelの Exit地点と同じなので、2番目以降だけ別マーカーとして描く
  const trailingGroups = (groupExits ?? []).slice(1);
  const trailingGroupPos = trailingGroups.map((g) => ({
    id: g.id,
    pos: offsetLatLon(targetLat, targetLon, g.exitPosition),
  }));

  const allPoints: [number, number][] = [
    targetPos,
    ...(openPos ? [[openPos.lat, openPos.lon] as [number, number]] : []),
    ...(exit1Pos ? [[exit1Pos.lat, exit1Pos.lon] as [number, number]] : []),
    ...(exit2Pos ? [[exit2Pos.lat, exit2Pos.lon] as [number, number]] : []),
    ...trailingGroupPos.map((g) => [g.pos.lat, g.pos.lon] as [number, number]),
  ];

  const maxDistanceM = Math.max(
    0,
    ...[openPosition, exitLevel1, exitLevel2, ...trailingGroups.map((g) => g.exitPosition)]
      .filter((v): v is Vec2 => v !== undefined)
      .map((v) => vectorToBearingDistance(v).distanceM),
  );
  const ringCount = Math.min(6, Math.max(1, Math.ceil((maxDistanceM || 500) / 500)));
  const rings = Array.from({ length: ringCount }, (_, i) => (i + 1) * 500);

  // ジャンプラン方向の直線（Exit地点を通る、グループの並びを覆うだけ両側に延長）
  const lastGroupVec = trailingGroups[trailingGroups.length - 1]?.exitPosition;
  const groupSpanM =
    selectedExitVec && lastGroupVec ? vectorToBearingDistance(sub(lastGroupVec, selectedExitVec)).distanceM : 0;
  const jumpRunSegment: [number, number][] | undefined = selectedExitVec
    ? (() => {
        const rHat = unitVectorForBearing(jumpRunTrueBearingDeg);
        const extend = scale(rHat, Math.max(1000, groupSpanM + 300));
        const p1 = offsetLatLon(targetLat, targetLon, {
          u: selectedExitVec.u - extend.u,
          v: selectedExitVec.v - extend.v,
        });
        const p2 = offsetLatLon(targetLat, targetLon, {
          u: selectedExitVec.u + extend.u,
          v: selectedExitVec.v + extend.v,
        });
        return [
          [p1.lat, p1.lon],
          [p2.lat, p2.lon],
        ];
      })()
    : undefined;

  // 各層の風の矢羽根：ジャンプラン方向と垂直な向きに、ターゲットから高度順に並べて表示する
  // （風テーブルは地理的な位置を持たないため、重ならないよう仮の並べ方をしている）
  const barbBearingDeg = (jumpRunTrueBearingDeg + 90) % 360;
  const barbStep = Math.max(70, Math.min(150, (maxDistanceM || 500) / 8));
  const sortedLayers = windLayers ? [...windLayers].sort((a, b) => a.altAglFt - b.altAglFt) : [];
  const barbs = showWindBarbs
    ? sortedLayers.map((layer, i) => {
        const offset = bearingDistanceToVector(barbBearingDeg, barbStep * (i + 1));
        const pos = offsetLatLon(targetLat, targetLon, offset);
        const dirMagDeg = trueToMagnetic(layer.dirDeg, declinationDeg);
        return { key: layer.altAglFt, pos: [pos.lat, pos.lon] as [number, number], dirMagDeg, speedKt: layer.speedKt, altFt: layer.altAglFt };
      })
    : [];

  const handleLocate = () => {
    setLocateError(null);
    if (!navigator.geolocation) {
      setLocateError('この端末では現在地を取得できません。');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation([pos.coords.latitude, pos.coords.longitude]),
      () => setLocateError('現在地を取得できませんでした。'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const gmapsLink = (lat: number, lon: number) => `https://www.google.com/maps?q=${lat.toFixed(6)},${lon.toFixed(6)}`;

  return (
    <section className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ height: 300, position: 'relative' }}>
        <MapContainer center={targetPos} zoom={14} style={{ height: '100%', width: '100%' }} attributionControl={mapType !== 'none'}>
          {mapType !== 'none' && <TileLayer url={TILE_URLS[mapType]} attribution={GSI_ATTRIBUTION} maxZoom={18} />}
          <FitBounds points={allPoints} />
          <FlyToLocation position={userLocation} />

          {rings.map((r) => (
            <Circle
              key={r}
              center={targetPos}
              radius={r}
              pathOptions={{ color: '#8d9688', weight: 1, dashArray: '3 4', fillOpacity: 0 }}
            />
          ))}

          {jumpRunSegment && (
            <Polyline positions={jumpRunSegment} pathOptions={{ color: '#c2410c', weight: 2.5, dashArray: '8 5' }} />
          )}

          <Marker position={targetPos} icon={TARGET_ICON} />
          {openPos && <Marker position={[openPos.lat, openPos.lon]} icon={OPEN_ICON} />}
          {otherExitPos && <Marker position={[otherExitPos.lat, otherExitPos.lon]} icon={dotIcon('#ffffff', 16, '#1d4ed8')} />}
          {selectedExitPos && <Marker position={[selectedExitPos.lat, selectedExitPos.lon]} icon={dotIcon('#c2410c', 16, '#ffffff')} />}
          {trailingGroupPos.map((g, i) => (
            <Marker key={g.id} position={[g.pos.lat, g.pos.lon]} icon={groupIcon(i + 2)} />
          ))}
          {userLocation && <Marker position={userLocation} icon={LOCATE_ICON} />}
          {barbs.map((b) => (
            <Marker key={b.key} position={b.pos} icon={windBarbIcon(b.dirMagDeg, b.speedKt, b.altFt)} />
          ))}
        </MapContainer>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderTop: '1px solid var(--border)' }}>
        <div role="group" aria-label="地図の種類" className="segmented">
          <button className={mapType === 'std' ? 'is-active' : ''} onClick={() => setMapType('std')}>
            地図
          </button>
          <button className={mapType === 'photo' ? 'is-active' : ''} onClick={() => setMapType('photo')}>
            航空写真
          </button>
          <button className={mapType === 'none' ? 'is-active' : ''} onClick={() => setMapType('none')}>
            なし
          </button>
        </div>
        {windLayers && windLayers.length > 0 && (
          <button
            type="button"
            aria-pressed={showWindBarbs}
            className="pill-button"
            onClick={() => setShowWindBarbs((v) => !v)}
          >
            風矢羽根{showWindBarbs ? ' ✓' : ''}
          </button>
        )}
        <button aria-label="現在地を表示" className="pill-button" style={{ marginLeft: 'auto' }} onClick={handleLocate}>
          現在地
        </button>
      </div>
      {locateError && <div className="warning-text" style={{ padding: '0 12px 10px' }}>{locateError}</div>}

      <div className="helper-text" style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span>Google Mapsで開く：</span>
        <span>
          <a href={gmapsLink(targetLat, targetLon)} target="_blank" rel="noopener noreferrer">
            ターゲット
          </a>
          {openPos && (
            <>
              {' '}
              ・{' '}
              <a href={gmapsLink(openPos.lat, openPos.lon)} target="_blank" rel="noopener noreferrer">
                オープン位置
              </a>
            </>
          )}
          {selectedExitPos && (
            <>
              {' '}
              ・{' '}
              <a href={gmapsLink(selectedExitPos.lat, selectedExitPos.lon)} target="_blank" rel="noopener noreferrer">
                Exit地点
              </a>
            </>
          )}
        </span>
      </div>
    </section>
  );
}
