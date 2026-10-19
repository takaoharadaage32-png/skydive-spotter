import { beforeEach, describe, expect, it, vi } from 'vitest';

// node環境には localStorage がないため、簡易実装をグローバルに用意する
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

vi.stubGlobal('localStorage', new MemoryStorage());

const { loadSettings, saveSettings } = await import('../../src/storage/settings');
const { defaultInputs, DEFAULT_DISPLAY_UNITS } = await import('../../src/ui/types');

// datetime-local 形式（ローカル時刻、オフセットなし）。toISOString() はUTCになってしまうため使えない。
function localIso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

describe('loadSettings: jumpTimeIso freshness', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when nothing is stored', () => {
    expect(loadSettings()).toBeNull();
  });

  // 実機で発覚したバグの回帰テスト：日付をまたいで古い jumpTimeIso が残っていると
  // 風データの取得範囲外になり「予報時刻が0時になる」不具合につながっていた
  it('replaces a stale (past) jumpTimeIso with a fresh "next full hour" on load', () => {
    const staleIso = localIso(new Date(Date.now() - 6 * 60 * 60 * 1000));
    saveSettings({ ...defaultInputs(), jumpTimeIso: staleIso }, DEFAULT_DISPLAY_UNITS);

    const loaded = loadSettings();
    expect(loaded?.inputs.jumpTimeIso).not.toBe(staleIso);
    const restoredMs = new Date(loaded!.inputs.jumpTimeIso).getTime();
    expect(restoredMs).toBeGreaterThan(Date.now() - 60 * 1000);
  });

  it('replaces an invalid jumpTimeIso with a fresh value on load', () => {
    saveSettings({ ...defaultInputs(), jumpTimeIso: '' }, DEFAULT_DISPLAY_UNITS);
    const loaded = loadSettings();
    expect(Number.isNaN(new Date(loaded!.inputs.jumpTimeIso).getTime())).toBe(false);
  });

  it('keeps a jumpTimeIso that is close to now (within 30 minutes in the past)', () => {
    const recentIso = localIso(new Date(Date.now() - 10 * 60 * 1000));
    saveSettings({ ...defaultInputs(), jumpTimeIso: recentIso }, DEFAULT_DISPLAY_UNITS);
    const loaded = loadSettings();
    expect(loaded?.inputs.jumpTimeIso).toBe(recentIso);
  });

  it('keeps a jumpTimeIso in the future untouched', () => {
    const futureIso = localIso(new Date(Date.now() + 5 * 60 * 60 * 1000));
    saveSettings({ ...defaultInputs(), jumpTimeIso: futureIso }, DEFAULT_DISPLAY_UNITS);
    const loaded = loadSettings();
    expect(loaded?.inputs.jumpTimeIso).toBe(futureIso);
  });
});
