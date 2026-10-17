// 風データ・計算結果のオフライン保存（spec.md 8.1「風データと結果は IndexedDB に保存」、7章冒頭）
//
// 機上では電波が届かないため、地上で最後に取得した風テーブルをそのまま使えるよう保存・復元する。

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { WindProfile } from '../core/windProfile';

const DB_NAME = 'skydive-spotter';
const DB_VERSION = 1;
const STORE = 'windProfile';
const KEY = 'latest';

interface StoredWind {
  profile: WindProfile;
  fetchedAtIso: string;
}

interface SpotterDB extends DBSchema {
  windProfile: {
    key: string;
    value: StoredWind;
  };
}

let dbPromise: Promise<IDBPDatabase<SpotterDB>> | null = null;

function getDb(): Promise<IDBPDatabase<SpotterDB>> {
  if (!dbPromise) {
    dbPromise = openDB<SpotterDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
      },
    });
  }
  return dbPromise;
}

export async function saveWindProfile(profile: WindProfile, fetchedAt: Date): Promise<void> {
  try {
    const db = await getDb();
    await db.put(STORE, { profile, fetchedAtIso: fetchedAt.toISOString() }, KEY);
  } catch {
    // IndexedDBが使えない環境（プライベートブラウズ等）では保存をあきらめる
  }
}

export async function loadWindProfile(): Promise<{ profile: WindProfile; fetchedAt: Date } | null> {
  try {
    const db = await getDb();
    const stored = await db.get(STORE, KEY);
    if (!stored) return null;
    return { profile: stored.profile, fetchedAt: new Date(stored.fetchedAtIso) };
  } catch {
    return null;
  }
}
