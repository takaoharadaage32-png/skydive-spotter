// 入力値・表示単位をブラウザに保存し、次回起動時に復元する（spec.md 3章末尾）

import { DEFAULT_DISPLAY_UNITS, defaultInputs, nextFullHourIso, type DisplayUnits, type Inputs } from '../ui/types';

const STORAGE_KEY = 'skydive-spotter:settings/v1';

interface StoredSettings {
  inputs: Inputs;
  displayUnits: DisplayUnits;
}

export function loadSettings(): StoredSettings | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSettings>;
    if (!parsed.inputs) return null;
    // 保存後にInputsの項目が増えることがあるため、既定値とマージして欠けたフィールドを補う
    const inputs: Inputs = { ...defaultInputs(), ...parsed.inputs };

    // ジャンプ予定時刻は「次の正時」が初期値という時刻相対の項目なので、
    // 日付をまたいで前回の値（＝既に過去）がそのまま残っていると、風データの
    // 取得範囲外になり「予報時刻が0時になる」不具合につながる。古ければ作り直す。
    const savedTime = new Date(inputs.jumpTimeIso).getTime();
    if (Number.isNaN(savedTime) || savedTime < Date.now() - 30 * 60 * 1000) {
      inputs.jumpTimeIso = nextFullHourIso();
    }

    return {
      inputs,
      displayUnits: { ...DEFAULT_DISPLAY_UNITS, ...parsed.displayUnits },
    };
  } catch {
    return null;
  }
}

export function saveSettings(inputs: Inputs, displayUnits: DisplayUnits): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ inputs, displayUnits }));
  } catch {
    // ブラウザがlocalStorageを使えない場合は何もしない（保存は任意機能のため）
  }
}
