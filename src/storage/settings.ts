// 入力値・表示単位をブラウザに保存し、次回起動時に復元する（spec.md 3章末尾）

import { DEFAULT_DISPLAY_UNITS, defaultInputs, type DisplayUnits, type Inputs } from '../ui/types';

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
    return {
      inputs: { ...defaultInputs(), ...parsed.inputs },
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
