// 画面間で共有する状態の型

import { groupLabel, type GroupInput } from '../core/groups';
import type { WindProfile } from '../core/windProfile';

export type FallModelKey = 'belly' | 'freefly' | 'studentAff' | 'tandem';

export interface ManualOpenPosition {
  bearingMagDeg: number; // 磁方位
  distanceM: number;
}

export interface Inputs {
  targetLat: number;
  targetLon: number;
  dzElevationM: number;
  dzElevationManual: boolean; // true なら open-meteo の elevation で上書きしない
  exitAltFt: number;
  openAltFt: number;
  openPositionManual: ManualOpenPosition | null; // null なら自動提案（-D_canopy）
  jumpRunManualMagDeg: number | null; // null なら自動提案（Exit高度の風に正対）
  fallModelKey: FallModelKey;
  descentRateFtPerMin: number;
  tasKt: number;
  jumpTimeIso: string; // ISO8601（ローカル、datetime-local の値をそのまま保持）
  groups: GroupInput[]; // セパレーション計算用（spec 3章・6.5）
}

export interface DisplayUnits {
  altitude: 'ft' | 'm';
  distance: 'm' | 'mile';
  speed: 'kt' | 'ms';
}

export const DEFAULT_DISPLAY_UNITS: DisplayUnits = {
  altitude: 'ft',
  distance: 'm',
  speed: 'kt',
};

export function nextFullHourIso(): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export interface WindState {
  status: 'idle' | 'loading' | 'error' | 'ready';
  profile?: WindProfile;
  error?: string;
  fetchedAt?: Date;
  /** true なら今回のセッションで取得したものではなく、端末に保存していたデータ（機上オフライン用） */
  fromCache?: boolean;
}

export function defaultInputs(): Inputs {
  return {
    targetLat: 35.3,
    targetLon: 139.4,
    dzElevationM: 0,
    dzElevationManual: false,
    exitAltFt: 13000,
    openAltFt: 3000,
    openPositionManual: null,
    jumpRunManualMagDeg: null,
    fallModelKey: 'belly',
    descentRateFtPerMin: 1000,
    tasKt: 85,
    jumpTimeIso: nextFullHourIso(),
    groups: [{ id: newGroupId(), label: groupLabel('belly', 1), headcount: 1, discipline: 'belly' }],
  };
}

export function newGroupId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `g-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
